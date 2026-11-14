"""Credential-free access to Microsoft Planetary Computer STAC assets.

Only public, openly licensed collections are used here. Signed URLs are obtained from
the Planetary Computer SAS endpoint at request time and are never written to disk.

This module deliberately contains no Earthdata Login handling. NISAR GCOV remains a
separate, credential-gated path (see ``reports/PHASE1_DATA_RESEARCH.md``).
"""

from __future__ import annotations

import logging
import time
from contextlib import contextmanager
from typing import Any, Dict, Iterable, Iterator, List, Optional, Tuple

import requests

logger = logging.getLogger(__name__)

STAC_SEARCH_URL = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
SAS_SIGN_URL = "https://planetarycomputer.microsoft.com/api/sas/v1/sign"
SAS_TOKEN_URL = "https://planetarycomputer.microsoft.com/api/sas/v1/token"

DEFAULT_TIMEOUT = 90
MAX_RETRIES = 5

# collection -> (container token, expiry epoch seconds)
_TOKEN_CACHE: Dict[str, Tuple[str, float]] = {}


class PlanetaryComputerError(RuntimeError):
    """Raised when a Planetary Computer request cannot be completed."""


def _request_with_retry(method: str, url: str, **kwargs: Any) -> requests.Response:
    last_error: Optional[Exception] = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.request(method, url, timeout=DEFAULT_TIMEOUT, **kwargs)
            if response.status_code < 400:
                return response
            if response.status_code == 429:
                retry_after = response.headers.get("Retry-After")
                wait = float(retry_after) if retry_after else 12.0 + 3.0 * attempt
                logger.warning("Planetary Computer rate limit; waiting %.0fs", wait)
                time.sleep(wait)
                last_error = PlanetaryComputerError(f"HTTP 429 on {url}")
                continue
            last_error = PlanetaryComputerError(
                f"{method} {url} -> HTTP {response.status_code}: {response.text[:200]}"
            )
        except Exception as exc:  # network errors, timeouts
            last_error = exc
        if attempt < MAX_RETRIES:
            time.sleep(3.0 * attempt)
    raise PlanetaryComputerError(str(last_error))


def get_collection_token(collection: str) -> Optional[str]:
    """Return a cached container-scoped SAS token for a collection, if supported.

    This is much cheaper than signing every asset individually and avoids the
    per-asset signing rate limit for Sentinel-1/2.
    """
    cached = _TOKEN_CACHE.get(collection)
    if cached and cached[1] > time.time() + 60:
        return cached[0]
    try:
        response = _request_with_retry("GET", f"{SAS_TOKEN_URL}/{collection}")
        payload = response.json()
        token = payload.get("token")
        if not token:
            return None
        expiry_text = payload.get("msft:expiry", "")
        expiry = time.time() + 3600
        if expiry_text:
            try:
                from datetime import datetime

                expiry = datetime.fromisoformat(expiry_text.replace("Z", "+00:00")).timestamp()
            except ValueError:
                pass
        _TOKEN_CACHE[collection] = (token, expiry)
        return token
    except PlanetaryComputerError as exc:
        logger.debug("No container token for %s: %s", collection, exc)
        return None


def stac_search(
    collection: str,
    bbox: Iterable[float],
    datetime_range: str,
    limit: int = 200,
    query: Optional[Dict[str, Any]] = None,
    ids: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """Search a Planetary Computer collection and return STAC features."""
    payload: Dict[str, Any] = {
        "collections": [collection],
        "bbox": list(bbox),
        "datetime": datetime_range,
        "limit": limit,
    }
    if query:
        payload["query"] = query
    if ids:
        payload["ids"] = ids
    response = _request_with_retry("POST", STAC_SEARCH_URL, json=payload)
    data = response.json()
    features = data.get("features", [])
    if not features:
        logger.warning(
            "No STAC features for %s bbox=%s datetime=%s", collection, list(bbox), datetime_range
        )
    return features


def sign_href(href: str, collection: Optional[str] = None) -> str:
    """Return a short-lived signed URL for a Planetary Computer asset.

    When ``collection`` is given and a container token is available, the token is
    appended directly. Otherwise the per-asset signing endpoint is used (rate limited,
    so callers should pass a collection whenever possible).
    """
    if not href.startswith("http"):
        raise PlanetaryComputerError(f"Only HTTP(S) assets can be signed: {href}")
    if collection:
        token = get_collection_token(collection)
        if token:
            separator = "&" if "?" in href else "?"
            return f"{href}{separator}{token}"
    response = _request_with_retry("GET", SAS_SIGN_URL, params={"href": href})
    payload = response.json()
    signed = payload.get("href")
    if not signed:
        raise PlanetaryComputerError(f"No signed href returned for {href}")
    return signed


@contextmanager
def open_signed(href: str, collection: Optional[str] = None, **open_kwargs: Any) -> Iterator[Any]:
    """Open a signed raster asset with rasterio for the duration of the context."""
    import rasterio

    signed = sign_href(href, collection=collection)
    with rasterio.open(signed, **open_kwargs) as dataset:
        yield dataset


def asset_href(item: Dict[str, Any], key: str) -> str:
    assets = item.get("assets", {})
    if key not in assets:
        available = ", ".join(sorted(assets))
        raise KeyError(f"Asset '{key}' not in item {item.get('id')}. Available: {available}")
    return assets[key]["href"]


def item_datetime(item: Dict[str, Any]) -> str:
    props = item.get("properties", {})
    return str(props.get("datetime") or props.get("start_datetime") or "")
