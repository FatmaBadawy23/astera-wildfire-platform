import React, { useState } from "react";
import type { EventAnalysisResponse, EventGeoJSONResponse, FireEvent } from "../types";
import { resolveApiAssetUrl } from "../api";

export interface LayerSpec {
  key: string;
  label: string;
  sensor: string;
  unit: string;
  legendGradient: string;
  legendMin: string;
  legendMax: string;
  description: string;
}

export const RASTER_LAYERS: LayerSpec[] = [
  {
    key: "burn_probability",
    label: "Predicted Burn Probability (U-Net)",
    sensor: "UNetResNet34 (MaskedBCEDiceLoss)",
    unit: "Probability [0, 1]",
    legendGradient: "linear-gradient(90deg, #000004, #721f81, #f1605d, #fcfdbf)",
    legendMin: "0.00 (Unburned)",
    legendMax: "1.00 (Burned)",
    description: "Continuous burn probability predicted from 5-channel Sentinel-1 C-band SAR stack.",
  },
  {
    key: "predicted_burn_mask",
    label: "Predicted Burn Mask (Thresholded)",
    sensor: "UNetResNet34 (p >= 0.66)",
    unit: "Binary Mask {0, 1}",
    legendGradient: "linear-gradient(90deg, rgba(30,41,59,0.4), #f97316)",
    legendMin: "0 (Unburned Land)",
    legendMax: "1 (Predicted Burned)",
    description: "Binary burned-area classification mask at validation-calibrated threshold p >= 0.66.",
  },
  {
    key: "pre_fire_vh_db",
    label: "Sentinel-1 Pre-Fire VH Backscatter",
    sensor: "Sentinel-1 RTC C-band (20 m)",
    unit: "Gamma0 (dB)",
    legendGradient: "linear-gradient(90deg, #0f172a, #64748b, #f8fafc)",
    legendMin: "-26 dB",
    legendMax: "-8 dB",
    description: "Pre-ignition cross-polarized VH radar backscatter (canopy volume scattering baseline).",
  },
  {
    key: "post_fire_vh_db",
    label: "Sentinel-1 Post-Fire VH Backscatter",
    sensor: "Sentinel-1 RTC C-band (20 m)",
    unit: "Gamma0 (dB)",
    legendGradient: "linear-gradient(90deg, #0f172a, #64748b, #f8fafc)",
    legendMin: "-26 dB",
    legendMax: "-8 dB",
    description: "Post-fire cross-polarized VH radar backscatter over the exact co-registered 20 m UTM grid.",
  },
  {
    key: "delta_vh_db",
    label: "SAR Backscatter Change (ΔVH = Post - Pre)",
    sensor: "Sentinel-1 RTC C-band (20 m)",
    unit: "ΔVH (dB)",
    legendGradient: "linear-gradient(90deg, #b2182b, #f7f7f7, #2166ac)",
    legendMin: "-6.0 dB (Canopy Loss)",
    legendMax: "+6.0 dB (Increase)",
    description: "C-band VH log-ratio change; negative values (red) indicate canopy consumption by fire.",
  },
  {
    key: "dnbr_reference",
    label: "Sentinel-2 Optical dNBR Reference",
    sensor: "Sentinel-2 L2A (20 m)",
    unit: "dNBR Index",
    legendGradient: "linear-gradient(90deg, #1a9850, #ffffbf, #d73027)",
    legendMin: "-0.20 (Unburned)",
    legendMax: "+0.80 (High Severity)",
    description: "Optical differenced Normalized Burn Ratio reference (burned label defined at dNBR >= 0.11).",
  },
  {
    key: "mcd64a1_reference",
    label: "NASA MODIS MCD64A1.061 Reference",
    sensor: "MODIS Terra/Aqua (500 m QA-Filtered)",
    unit: "Burn Mask",
    legendGradient: "linear-gradient(90deg, rgba(30,41,59,0.4), #ef4444)",
    legendMin: "0 (Unburned)",
    legendMax: "Burned DOY > 0",
    description: "Independent NASA MODIS MCD64A1.061 monthly burned area product (QA bits 0=1, 1=1, 2=0).",
  },
  {
    key: "valid_land_mask",
    label: "Valid Land Observation Mask (Water Excluded)",
    sensor: "S1 Valid & S2 SCL {4,5,7} (SCL=6 Excluded)",
    unit: "Valid Mask",
    legendGradient: "linear-gradient(90deg, #0b1020, #22c55e)",
    legendMin: "0 (Water / Cloud / NoData)",
    legendMax: "1 (Valid Land Pixel)",
    description: "Strict land mask guaranteeing 0 SCL=6 water pixels in training, loss, or evaluation.",
  },
];

interface Props {
  events: FireEvent[];
  selectedEventId: string;
  onSelectEvent: (eventId: string) => void;
  analysis: EventAnalysisResponse | null;
  geojson: EventGeoJSONResponse | null;
  loading: boolean;
  error: string | null;
}

export const WildfireMapView: React.FC<Props> = ({
  events,
  selectedEventId,
  onSelectEvent,
  analysis,
  geojson,
  loading,
  error,
}) => {
  const [primaryLayer, setPrimaryLayer] = useState<string>("burn_probability");
  const [comparisonLayer, setComparisonLayer] = useState<string>("pre_fire_vh_db");
  const [enableComparison, setEnableComparison] = useState<boolean>(true);
  const [primaryOpacity, setPrimaryOpacity] = useState<number>(0.82);
  const [showAoiBoundary, setShowAoiBoundary] = useState<boolean>(true);
  const [showFirmsHotspots, setShowFirmsHotspots] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(1);
  const [cursorCoords, setCursorCoords] = useState<{ lon: number; lat: number } | null>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<{
    lon: number;
    lat: number;
    frp?: number;
    confidence?: string;
    acq_date?: string;
    acq_time?: string;
  } | null>(null);
  const [layerLoadError, setLayerLoadError] = useState<string | null>(null);

  const activeLayerSpec = RASTER_LAYERS.find((l) => l.key === primaryLayer) || RASTER_LAYERS[0];
  const baseLayerSpec = RASTER_LAYERS.find((l) => l.key === comparisonLayer) || RASTER_LAYERS[2];

  const bounds = analysis?.bounds_wgs84 || [-120.0, 39.75, -119.79, 39.9];
  const [west, south, east, north] = bounds;

  const lonToX = (lon: number) => ((lon - west) / Math.max(1e-6, east - west)) * 800;
  const latToY = (lat: number) => ((north - lat) / Math.max(1e-6, north - south)) * 800;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const relY = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    const lon = west + relX * (east - west);
    const lat = north - relY * (north - south);
    setCursorCoords({ lon, lat });
  };

  const primaryOverlayUrl = analysis?.web_overlay_urls?.[primaryLayer]
    ? resolveApiAssetUrl(analysis.web_overlay_urls[primaryLayer])
    : `/api/events/${selectedEventId}/layers/${primaryLayer}.png`;

  const comparisonOverlayUrl = analysis?.web_overlay_urls?.[comparisonLayer]
    ? resolveApiAssetUrl(analysis.web_overlay_urls[comparisonLayer])
    : `/api/events/${selectedEventId}/layers/${comparisonLayer}.png`;

  const activeRasterAudit = analysis?.raster_quality_audit?.layers?.[primaryLayer];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <label htmlFor="map-event-select" style={{ fontWeight: 700, fontSize: "0.88rem" }}>
            Wildfire Event AOI:
          </label>
          <select
            id="map-event-select"
            className="select-input"
            value={selectedEventId}
            onChange={(e) => {
              setSelectedHotspot(null);
              setLayerLoadError(null);
              onSelectEvent(e.target.value);
            }}
          >
            {events.map((ev) => (
              <option key={ev.event_id} value={ev.event_id}>
                {ev.fire_name} ({ev.event_id}) — [{ev.include_in_training ? ev.split_assignment : "EXCLUDED"}]
              </option>
            ))}
          </select>
          {analysis && (
            <>
              <span className={`badge ${analysis.include_in_training ? "badge-radar" : "badge-warning"}`}>
                Split: {analysis.include_in_training ? analysis.split : "EXCLUDED FROM TRAINING"}
              </span>
              <span className="badge badge-success">
                CRS: {analysis.raster_quality_audit.crs} (800×800 @ 20 m)
              </span>
              <span className="badge badge-success">
                Water in Valid Mask: {analysis.water_pixels_remaining_in_valid} px
              </span>
            </>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button className="btn-secondary" onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))}>
            Zoom -
          </button>
          <span className="mono" style={{ fontSize: "0.82rem", minWidth: "52px", textAlign: "center" }}>
            {Math.round(zoom * 100)}%
          </span>
          <button className="btn-secondary" onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.25).toFixed(2)))}>
            Zoom +
          </button>
          <button className="btn-secondary" onClick={() => setZoom(1)}>
            Reset
          </button>
        </div>
      </div>

      {analysis && !analysis.include_in_training && (
        <div className="alert-banner alert-warning">
          <div>
            <strong>Diagnostic Excluded Event ({analysis.event_id}):</strong> {analysis.exclusion_reason}
          </div>
        </div>
      )}

      {error && (
        <div className="alert-banner alert-danger">
          <strong>Map Data Error:</strong> {error}
        </div>
      )}

      <div className="map-layout">
        {/* Left Layer Controls Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="card">
            <div className="section-header">
              <h3 className="section-title">Primary Raster Layer</h3>
            </div>
            <div className="layer-list">
              {RASTER_LAYERS.map((layer) => (
                <div
                  key={layer.key}
                  className={`layer-item ${primaryLayer === layer.key ? "active" : ""}`}
                  onClick={() => {
                    setLayerLoadError(null);
                    setPrimaryLayer(layer.key);
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{layer.label}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{layer.sensor}</div>
                  </div>
                  <input
                    type="radio"
                    checked={primaryLayer === layer.key}
                    onChange={() => setPrimaryLayer(layer.key)}
                    aria-label={layer.label}
                  />
                </div>
              ))}
            </div>

            <div style={{ marginTop: "1rem", paddingTop: "0.85rem", borderTop: "1px solid var(--border-color)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: "0.35rem" }}>
                <span>Primary Overlay Opacity</span>
                <span className="mono">{Math.round(primaryOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={primaryOpacity}
                onChange={(e) => setPrimaryOpacity(parseFloat(e.target.value))}
                style={{ width: "100%" }}
                aria-label="Primary Overlay Opacity"
              />
            </div>

            <div style={{ marginTop: "0.85rem", paddingTop: "0.85rem", borderTop: "1px solid var(--border-color)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.83rem", fontWeight: 600, marginBottom: "0.45rem" }}>
                <input
                  type="checkbox"
                  checked={enableComparison}
                  onChange={(e) => setEnableComparison(e.target.checked)}
                />
                Underlay Base SAR / Reference Layer
              </label>
              {enableComparison && (
                <select
                  className="select-input"
                  style={{ width: "100%" }}
                  value={comparisonLayer}
                  onChange={(e) => setComparisonLayer(e.target.value)}
                  aria-label="Underlay Base Layer"
                >
                  {RASTER_LAYERS.map((l) => (
                    <option key={l.key} value={l.key}>
                      Base: {l.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="section-title" style={{ marginBottom: "0.65rem" }}>
              Vector Overlays (GeoJSON)
            </h3>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.84rem", marginBottom: "0.55rem" }}>
              <span>AOI Co-Registered Boundary</span>
              <input
                type="checkbox"
                checked={showAoiBoundary}
                onChange={(e) => setShowAoiBoundary(e.target.checked)}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.84rem" }}>
              <span>
                NASA FIRMS Thermal Hotspots ({geojson?.firms_hotspot_count_in_aoi ?? 0} in AOI)
              </span>
              <input
                type="checkbox"
                checked={showFirmsHotspots}
                onChange={(e) => setShowFirmsHotspots(e.target.checked)}
              />
            </label>
            <p style={{ fontSize: "0.73rem", color: "var(--text-muted)", marginTop: "0.55rem" }}>
              Note: FIRMS hotspots are plotted strictly as instantaneous VIIRS thermal anomaly points, never as burned-area polygons.
            </p>
          </div>

          {activeRasterAudit && (
            <div className="card">
              <h3 className="section-title" style={{ marginBottom: "0.5rem" }}>
                Verified GeoTIFF Metadata
              </h3>
              <div style={{ fontSize: "0.78rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.35rem" }}>
                <span style={{ color: "var(--text-muted)" }}>File:</span>
                <span className="mono">{activeRasterAudit.file}</span>
                <span style={{ color: "var(--text-muted)" }}>CRS:</span>
                <span className="mono">{activeRasterAudit.crs}</span>
                <span style={{ color: "var(--text-muted)" }}>Dimensions:</span>
                <span className="mono">
                  {activeRasterAudit.dimensions_hw[0]} × {activeRasterAudit.dimensions_hw[1]} px
                </span>
                <span style={{ color: "var(--text-muted)" }}>Resolution:</span>
                <span className="mono">
                  {activeRasterAudit.resolution_m[0]} m × {activeRasterAudit.resolution_m[1]} m
                </span>
                <span style={{ color: "var(--text-muted)" }}>Valid Range:</span>
                <span className="mono">
                  [{activeRasterAudit.min_valid_value}, {activeRasterAudit.max_valid_value}]
                </span>
                <span style={{ color: "var(--text-muted)" }}>NoData Value:</span>
                <span className="mono">{activeRasterAudit.nodata}</span>
                <span style={{ color: "var(--text-muted)" }}>Co-Registered:</span>
                <span className="mono" style={{ color: "var(--success-valid)" }}>
                  {activeRasterAudit.aligned_to_event_grid ? "YES (Exact)" : "NO"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Interactive Georeferenced Map Canvas */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <div className="map-viewport" onMouseMove={handleMouseMove} onMouseLeave={() => setCursorCoords(null)}>
            {loading && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(11,16,32,0.75)",
                  zIndex: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 600,
                }}
              >
                Loading georeferenced SAR & optical layers for {selectedEventId}...
              </div>
            )}

            <div
              style={{
                width: "100%",
                height: "100%",
                 position: "relative",
                transform: `scale(${zoom})`,
                transformOrigin: "center center",
                transition: "transform 0.15s ease-out",
              }}
            >
              {enableComparison && (
                <img
                  src={comparisonOverlayUrl}
                  alt={baseLayerSpec.label}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    imageRendering: "pixelated",
                  }}
                />
              )}

              <img
                src={primaryOverlayUrl}
                alt={activeLayerSpec.label}
                onError={() => setLayerLoadError(`Raster overlay ${primaryLayer} failed to load.`)}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  opacity: primaryOpacity,
                  imageRendering: "pixelated",
                }}
              />

              {/* Co-registered SVG GeoJSON Overlay (800x800 viewBox mapped to WGS84 bounds) */}
              <svg
                viewBox="0 0 800 800"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  pointerEvents: "auto",
                }}
              >
                {/* Coordinate graticule lines */}
                {[160, 320, 480, 640].map((pos) => (
                  <React.Fragment key={pos}>
                    <line
                      x1={pos}
                      y1={0}
                      x2={pos}
                      y2={800}
                      stroke="rgba(148, 163, 184, 0.18)"
                      strokeDasharray="4 4"
                      strokeWidth={1}
                    />
                    <line
                      x1={0}
                      y1={pos}
                      x2={800}
                      y2={pos}
                      stroke="rgba(148, 163, 184, 0.18)"
                      strokeDasharray="4 4"
                      strokeWidth={1}
                    />
                  </React.Fragment>
                ))}

                {/* AOI Boundary Polygon */}
                {showAoiBoundary &&
                  geojson?.aoi_boundary?.features?.map((feat, idx) => {
                    const ring = feat.geometry?.coordinates?.[0] || [];
                    const pointsStr = ring
                      .map(([lon, lat]) => `${lonToX(lon).toFixed(1)},${latToY(lat).toFixed(1)}`)
                      .join(" ");
                    return (
                      <polygon
                        key={`aoi-${idx}`}
                        points={pointsStr}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth={4}
                        strokeDasharray="10 6"
                      />
                    );
                  })}

                {/* FIRMS Active Fire Thermal Hotspot Points */}
                {showFirmsHotspots &&
                  geojson?.firms_hotspots?.features?.map((feat, idx) => {
                    const [lon, lat] = feat.geometry.coordinates;
                    const cx = lonToX(lon);
                    const cy = latToY(lat);
                    const frp = feat.properties?.frp ?? 10;
                    const radius = Math.min(11, Math.max(4.5, 3.5 + Math.log10(Math.max(1, frp)) * 2.5));
                    const isHigh = feat.properties?.confidence === "h" || feat.properties?.confidence === "high";
                    return (
                      <circle
                        key={`firms-${idx}`}
                        cx={cx}
                        cy={cy}
                        r={radius}
                        fill={isHigh ? "#ef4444" : "#f97316"}
                        fillOpacity={0.85}
                        stroke="#ffffff"
                        strokeWidth={1.3}
                        style={{ cursor: "pointer" }}
                        onClick={() =>
                          setSelectedHotspot({
                            lon,
                            lat,
                            frp: feat.properties?.frp,
                            confidence: feat.properties?.confidence,
                            acq_date: feat.properties?.acq_date,
                            acq_time: feat.properties?.acq_time,
                          })
                        }
                      >
                        <title>
                          {`FIRMS Thermal Hotspot | FRP: ${feat.properties?.frp ?? "N/A"} MW | Date: ${
                            feat.properties?.acq_date ?? ""
                          } ${feat.properties?.acq_time ?? ""} UTC | Confidence: ${feat.properties?.confidence ?? ""}`}
                        </title>
                      </circle>
                    );
                  })}
              </svg>
            </div>

            {/* Top-left HUD badge */}
            <div
              style={{
                position: "absolute",
                top: "12px",
                left: "12px",
                background: "rgba(11, 16, 32, 0.86)",
                border: "1px solid rgba(56, 189, 248, 0.4)",
                borderRadius: "8px",
                padding: "0.5rem 0.75rem",
                color: "#f8fafc",
                fontSize: "0.76rem",
                pointerEvents: "none",
              }}
            >
              <div style={{ fontWeight: 700, color: "#f97316" }}>{activeLayerSpec.label}</div>
              <div>{activeLayerSpec.description}</div>
              {enableComparison && (
                <div style={{ color: "#38bdf8", marginTop: "0.2rem" }}>
                  Underlay: {baseLayerSpec.label}
                </div>
              )}
            </div>

            {/* Bottom-left WGS84 cursor readout & scalebar */}
            <div
              style={{
                position: "absolute",
                bottom: "12px",
                left: "12px",
                background: "rgba(11, 16, 32, 0.88)",
                border: "1px solid #334155",
                borderRadius: "8px",
                padding: "0.4rem 0.7rem",
                color: "#cbd5e1",
                fontSize: "0.74rem",
              }}
              className="mono"
            >
              {cursorCoords
                ? `Cursor WGS84: ${cursorCoords.lat.toFixed(5)}° N, ${cursorCoords.lon.toFixed(5)}° E`
                : `AOI Bounds: [${west.toFixed(3)}°, ${south.toFixed(3)}°] to [${east.toFixed(3)}°, ${north.toFixed(3)}°] | 16.0 km × 16.0 km`}
            </div>

            {/* Selected FIRMS hotspot inspector popup */}
            {selectedHotspot && (
              <div
                style={{
                  position: "absolute",
                  bottom: "12px",
                  right: "12px",
                  background: "rgba(15, 23, 42, 0.95)",
                  border: "1px solid #ef4444",
                  borderRadius: "8px",
                  padding: "0.65rem 0.85rem",
                  color: "#f8fafc",
                  fontSize: "0.76rem",
                  maxWidth: "280px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                  <strong style={{ color: "#f97316" }}>FIRMS Thermal Anomaly Point</strong>
                  <button
                    onClick={() => setSelectedHotspot(null)}
                    style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
                  >
                    ✕
                  </button>
                </div>
                <div className="mono">
                  <div>
                    Coords: {selectedHotspot.lat.toFixed(4)}°N, {selectedHotspot.lon.toFixed(4)}°E
                  </div>
                  <div>Fire Radiative Power: {selectedHotspot.frp ?? "N/A"} MW</div>
                  <div>
                    Timestamp: {selectedHotspot.acq_date} {selectedHotspot.acq_time} UTC
                  </div>
                  <div>Confidence: {selectedHotspot.confidence}</div>
                </div>
              </div>
            )}
          </div>

          {layerLoadError && (
            <div className="alert-banner alert-danger">
              <strong>Layer Warning:</strong> {layerLoadError}
            </div>
          )}

          {/* Legend & Area Summary Bar */}
          <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ flex: "1 1 280px" }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                Color Scale — {activeLayerSpec.label} ({activeLayerSpec.unit})
              </div>
              <div
                style={{
                  height: "12px",
                  borderRadius: "6px",
                  background: activeLayerSpec.legendGradient,
                  border: "1px solid var(--border-color)",
                }}
              />
              <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                <span>{activeLayerSpec.legendMin}</span>
                <span>{activeLayerSpec.legendMax}</span>
              </div>
            </div>

            {analysis && (
              <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
                <div>
                  <div className="kpi-label">U-Net Predicted Burned</div>
                  <div className="mono" style={{ fontWeight: 700, fontSize: "1rem", color: "var(--accent-primary)" }}>
                    {analysis.area_estimates.primary_model_burned_area.burned_area_km2.toFixed(2)} km²
                  </div>
                </div>
                <div>
                  <div className="kpi-label">Sentinel-2 dNBR Ref</div>
                  <div className="mono" style={{ fontWeight: 700, fontSize: "1rem" }}>
                    {analysis.area_estimates.sentinel2_dnbr_reference.burned_area_km2.toFixed(2)} km²
                  </div>
                </div>
                <div>
                  <div className="kpi-label">MODIS MCD64A1 Ref</div>
                  <div className="mono" style={{ fontWeight: 700, fontSize: "1rem", color: "var(--accent-radar)" }}>
                    {analysis.area_estimates.nasa_mcd64a1_reference.burned_area_km2.toFixed(2)} km²
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
