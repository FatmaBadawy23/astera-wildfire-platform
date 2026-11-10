"""Read-only verification of the Astera Watch PostgreSQL + PostGIS setup.

Run with:  conda run -n astera python docs/setup/verify_db.py

What it does
- Reads DATABASE_URL and TEST_DATABASE_URL from the project's .env file
  (without loading them into the process environment).
- Connects to each database as the app user in a READ-ONLY session
  (default_transaction_read_only=on), runs SELECT queries only, rolls back.
- Never prints passwords, full connection URLs or raw driver error messages
  (only the exception type and SQLSTATE code).
- Never creates, alters or drops anything.
- Any failure (connection, query, unexpected exception) is recorded as a failed
  check, and the final RESULT line is always printed (FAIL if anything failed).

Note on the role-membership check: it verifies that the app user has no
DIRECT memberships in other roles (pg_auth_members). It does not evaluate every
possible effective privilege (e.g. grants to PUBLIC or object-level grants).
"""
from __future__ import annotations

import sys
from pathlib import Path

import psycopg
from dotenv import dotenv_values
from sqlalchemy.engine import make_url

PROJECT_ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = PROJECT_ROOT / ".env"

EXPECTED_MAIN_DB = "astera_watch"
EXPECTED_TEST_DB = "astera_watch_test"
EXPECTED_PG_MAJOR = 18
EXPECTED_POSTGIS_PREFIX = "3.7"
# Area of a 1 deg x 1 deg cell at the equator in an equal-area CRS (EPSG:6933), m^2
AREA_MIN, AREA_MAX = 1.20e10, 1.26e10

results: list[tuple[str, bool, str]] = []


def check(label: str, passed: bool, detail: str = "") -> None:
    results.append((label, passed, detail))
    print(f"  {'PASS' if passed else 'FAIL'}  {label}" + (f"  ({detail})" if detail else ""))


def safe_target(url) -> str:
    """Describe a connection target without the password."""
    return f"user={url.username} host={url.host} port={url.port or 5432} db={url.database}"


def describe_error(e: BaseException) -> str:
    """Exception type + SQLSTATE only; never the raw message (it may contain connection details)."""
    sqlstate = getattr(e, "sqlstate", None) or getattr(getattr(e, "diag", None), "sqlstate", None)
    return f"{type(e).__name__}, SQLSTATE={sqlstate or 'n/a'}"


def verify_database(var_name: str, raw_url: str | None, expected_db: str) -> None:
    print(f"\n== {var_name}")
    if not raw_url:
        check(f"{var_name} is set in .env", False, "missing or empty")
        return
    try:
        url = make_url(raw_url)
    except Exception as e:  # noqa: BLE001
        check(f"{var_name} is a valid URL", False, type(e).__name__)  # message could echo the URL
        return
    print(f"  target: {safe_target(url)}")

    if url.password in (None, "", "CHANGE_ME"):
        check("password is filled in", False, "still empty or CHANGE_ME")
        return
    check(f"{var_name} points to database '{expected_db}'", url.database == expected_db, f"found '{url.database}'")
    if url.database != expected_db:
        return  # never connect to an unexpected database

    try:
        conn = psycopg.connect(
            host=url.host or "localhost",
            port=url.port or 5432,
            dbname=url.database,
            user=url.username,
            password=url.password,
            connect_timeout=10,
            options="-c default_transaction_read_only=on",
        )
    except Exception as e:  # noqa: BLE001
        check("connect", False, describe_error(e))
        return


    step = "start"
    try:
        with conn.cursor() as cur:

            def one(label: str, sql: str) -> tuple:
                """Run one read-only query and return its single row; a missing row is a failure."""
                nonlocal step
                step = label
                cur.execute(sql)
                row = cur.fetchone()
                if row is None:
                    raise LookupError(f"no row returned for: {label}")
                return row

            (ro,) = one("read-only setting", "SHOW default_transaction_read_only")
            check("session is read-only", ro == "on")

            num, ver = one("server version",
                           "SELECT current_setting('server_version_num')::int, current_setting('server_version')")
            check(f"PostgreSQL major version is {EXPECTED_PG_MAJOR}", num // 10000 == EXPECTED_PG_MAJOR, ver)

            user, db = one("current user/database", "SELECT current_user, current_database()")
            check("connected as expected user/database", user == url.username and db == url.database, f"{user} @ {db}")

            su, cr, cd, rep, bypass, inherit = one(
                "role attributes",
                "SELECT rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls, rolinherit "
                "FROM pg_roles WHERE rolname = current_user",
            )
            check("app user is NOT superuser / createrole / createdb", not (su or cr or cd),
                  f"superuser={su} createrole={cr} createdb={cd}")
            check("app user has NO replication / bypassrls", not (rep or bypass),
                  f"replication={rep} bypassrls={bypass}")

            (memberships,) = one(
                "direct role memberships",
                "SELECT count(*) FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.member "
                "WHERE r.rolname = current_user",
            )
            # Direct memberships only (pg_auth_members); not a full effective-privilege audit.
            check("app user has no DIRECT memberships in other roles", memberships == 0,
                  f"direct memberships={memberships} inherit={inherit}")

            (owner,) = one("database owner",
                           "SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = current_database()")
            check("database is owned by the app user", owner == user, f"owner={owner}")

            (can_create,) = one("schema privilege", "SELECT has_schema_privilege(current_user, 'public', 'CREATE')")
            check("app user may create tables in schema public (privilege check only)", can_create is True)

            step = "postgis extension"
            cur.execute("SELECT extversion FROM pg_extension WHERE extname = 'postgis'")
            ext = cur.fetchone()
            check("PostGIS extension enabled in this database", ext is not None, ext[0] if ext else "not enabled")
            if ext is not None:
                (pv,) = one("PostGIS version", "SELECT PostGIS_Version()")
                check(f"PostGIS version is {EXPECTED_POSTGIS_PREFIX}.x", str(pv).startswith(EXPECTED_POSTGIS_PREFIX), pv)

                (n_crs,) = one("CRS definitions", "SELECT count(*) FROM spatial_ref_sys WHERE srid IN (4326, 6933)")
                check("CRS definitions EPSG:4326 and EPSG:6933 available", n_crs == 2)

                (area,) = one(
                    "equal-area calculation",
                    "SELECT ST_Area(ST_Transform("
                    "ST_GeomFromText('POLYGON((0 0, 1 0, 1 1, 0 1, 0 0))', 4326), 6933))",
                )
                check("PostGIS equal-area calculation works", AREA_MIN <= area <= AREA_MAX,
                      f"1x1 deg cell at equator = {area / 1e6:,.0f} km2")
    except Exception as e:  # noqa: BLE001  -- any failure becomes a FAILED check
        check(f"query failed at step '{step}'", False, describe_error(e))
    finally:
        try:
            conn.rollback()  # nothing was written; make that explicit
        except Exception as e:  # noqa: BLE001
            check("rollback", False, describe_error(e))
        finally:
            conn.close()


def main() -> int:
    print("Astera Watch database verification (read-only)")
    print(f"  .env file: {ENV_FILE}")
    if not ENV_FILE.is_file():
        check(".env file exists", False, "create it from .env.example first")
        return 1
    try:
        env = dotenv_values(ENV_FILE)  # does not modify os.environ
    except Exception as e:  # noqa: BLE001
        check(".env file readable", False, type(e).__name__)
        env = {}

    main_url = env.get("DATABASE_URL")
    test_url = env.get("TEST_DATABASE_URL")
    for var_name, raw, expected in (("DATABASE_URL", main_url, EXPECTED_MAIN_DB),
                                    ("TEST_DATABASE_URL", test_url, EXPECTED_TEST_DB)):
        try:
            verify_database(var_name, raw, expected)
        except Exception as e:  # noqa: BLE001  -- never let an error skip the final result
            check(f"{var_name} verification", False, describe_error(e))

    if main_url and test_url:
        try:
            same = make_url(main_url).database == make_url(test_url).database
        except Exception:  # noqa: BLE001
            same = True
        print("\n== Separation")
        check("main and test databases are different", not same)
    return 0


def report() -> int:
    failed = [r for r in results if not r[1]]
    ok = bool(results) and not failed
    print(f"\nRESULT: {'PASS' if ok else 'FAIL'}  ({len(results) - len(failed)}/{len(results)} checks passed)")
    return 0 if ok else 1


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001
        check("verification run", False, describe_error(e))
    finally:
        code = report()  # always printed; FAIL if any check failed or none ran
    sys.exit(code)
