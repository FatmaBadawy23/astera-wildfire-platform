import React, { useState } from "react";
import type { EventAnalysisResponse, FireEvent } from "../types";
import { resolveApiAssetUrl } from "../api";
import { RASTER_LAYERS } from "./WildfireMapView";

interface Props {
  events: FireEvent[];
  selectedEventId: string;
  onSelectEvent: (eventId: string) => void;
  analysis: EventAnalysisResponse | null;
  loading: boolean;
  error: string | null;
}

export const EventDetailsView: React.FC<Props> = ({
  events,
  selectedEventId,
  onSelectEvent,
  analysis,
  loading,
  error,
}) => {
  const [leftCompareLayer, setLeftCompareLayer] = useState<string>("pre_fire_vh_db");
  const [rightCompareLayer, setRightCompareLayer] = useState<string>("post_fire_vh_db");

  if (loading && !analysis) {
    return <div className="card">Loading verified event analysis for {selectedEventId}...</div>;
  }

  if (error || !analysis) {
    return (
      <div className="alert-banner alert-danger">
        <strong>Error loading event details:</strong> {error || "No event analysis available."}
      </div>
    );
  }

  const tv = analysis.before_after_verification.temporal_verification;
  const sgv = analysis.before_after_verification.spatial_grid_verification;
  const gpv = analysis.before_after_verification.geometry_and_polarization_verification;
  const sarStats = analysis.sar_change_statistics;
  const firms = analysis.firms_active_fire_summary;
  const areas = analysis.area_estimates;

  const leftUrl = resolveApiAssetUrl(
    analysis.web_overlay_urls[leftCompareLayer] || `/api/events/${analysis.event_id}/layers/${leftCompareLayer}.png`
  );
  const rightUrl = resolveApiAssetUrl(
    analysis.web_overlay_urls[rightCompareLayer] || `/api/events/${analysis.event_id}/layers/${rightCompareLayer}.png`
  );
  const overviewUrl = resolveApiAssetUrl(analysis.overview_figure_url);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
      {/* Event Selector Header */}
      <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
            <h2 style={{ fontSize: "1.35rem" }}>
              {analysis.fire_name} ({analysis.event_id})
            </h2>
            <span className={`badge ${analysis.include_in_training ? "badge-radar" : "badge-warning"}`}>
              Split: {analysis.include_in_training ? analysis.split : "EXCLUDED FROM TRAINING"}
            </span>
            <span className="badge badge-success">Run: {analysis.run_id}</span>
            <span className="badge badge-warning">Sensor: Sentinel-1 C-band (is_nisar: false)</span>
          </div>
          <div style={{ fontSize: "0.84rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            Region: {analysis.state_region} | Center: {analysis.center_lat.toFixed(4)}°N, {analysis.center_lon.toFixed(4)}°E | Reported Size:{" "}
            {analysis.reported_acres.toLocaleString()} acres
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <label htmlFor="detail-event-select" style={{ fontSize: "0.84rem", fontWeight: 600 }}>
            Switch Event:
          </label>
          <select
            id="detail-event-select"
            className="select-input"
            value={selectedEventId}
            onChange={(e) => onSelectEvent(e.target.value)}
          >
            {events.map((ev) => (
              <option key={ev.event_id} value={ev.event_id}>
                {ev.fire_name} ({ev.event_id}) [{ev.include_in_training ? ev.split_assignment : "EXCLUDED"}]
              </option>
            ))}
          </select>
        </div>
      </div>

      {!analysis.include_in_training && (
        <div className="alert-banner alert-warning">
          <div>
            <strong>Why {analysis.event_id} is Excluded from Supervised Training:</strong> {analysis.exclusion_reason}
          </div>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="kpi-grid">
        <div className="card">
          <div className="kpi-label">U-Net Predicted Burned Area</div>
          <div className="kpi-value" style={{ color: "var(--accent-primary)" }}>
            {areas.primary_model_burned_area.burned_area_km2.toFixed(2)} km²
          </div>
          <div className="kpi-sub mono">
            {areas.primary_model_burned_area.burned_area_ha.toFixed(1)} ha | 95% CI: [
            {areas.primary_model_burned_area.burned_area_km2_ci95[0].toFixed(1)},{" "}
            {areas.primary_model_burned_area.burned_area_km2_ci95[1].toFixed(1)}] km²
          </div>
        </div>

        <div className="card">
          <div className="kpi-label">Sentinel-2 dNBR Reference (20 m)</div>
          <div className="kpi-value">{areas.sentinel2_dnbr_reference.burned_area_km2.toFixed(2)} km²</div>
          <div className="kpi-sub mono">
            {areas.sentinel2_dnbr_reference.burned_area_ha.toFixed(1)} ha ({areas.sentinel2_dnbr_reference.burned_percent_of_valid_area}% of valid land)
          </div>
        </div>

        <div className="card">
          <div className="kpi-label">NASA MODIS MCD64A1 Ref (QA-Filtered)</div>
          <div className="kpi-value" style={{ color: "var(--accent-radar)" }}>
            {areas.nasa_mcd64a1_reference.burned_area_km2.toFixed(2)} km²
          </div>
          <div className="kpi-sub mono">
            {areas.nasa_mcd64a1_reference.burned_area_ha.toFixed(1)} ha ({areas.nasa_mcd64a1_reference.burned_percent_of_valid_area}% of valid land)
          </div>
        </div>

        <div className="card">
          <div className="kpi-label">Mean SAR Backscatter Change (ΔVH)</div>
          <div className="kpi-value mono">{sarStats.delta_vh_mean_db.toFixed(2)} dB</div>
          <div className="kpi-sub mono">
            Pre: {sarStats.vh_pre_mean_db.toFixed(2)} dB → Post: {sarStats.vh_post_mean_db.toFixed(2)} dB
          </div>
        </div>

        <div className="card">
          <div className="kpi-label">FIRMS Active Thermal Hotspots</div>
          <div className="kpi-value" style={{ color: "var(--danger-fire)" }}>
            {firms.total_hotspots.toLocaleString()}
          </div>
          <div className="kpi-sub mono">
            Peak FRP: {firms.max_frp_mw.toFixed(1)} MW | High Conf: {firms.high_confidence_hotspots}
          </div>
        </div>
      </div>

      {/* Acquisition Timeline & Co-registration Verification */}
      <div className="grid-2">
        <div className="card">
          <h3 className="section-title" style={{ marginBottom: "0.75rem" }}>
            Temporal & Sensor Acquisition Provenance
          </h3>
          <table className="data-table">
            <tbody>
              <tr>
                <th>Reported Ignition Date</th>
                <td className="mono">{tv.reported_ignition_date}</td>
              </tr>
              <tr>
                <th>Sentinel-1 Pre-Fire Dates</th>
                <td className="mono">{tv.s1_pre_dates.join(", ")}</td>
              </tr>
              <tr>
                <th>Sentinel-1 Post-Fire Dates</th>
                <td className="mono">{tv.s1_post_dates.join(", ")}</td>
              </tr>
              <tr>
                <th>Sentinel-2 Pre / Post Dates</th>
                <td className="mono">
                  {tv.s2_pre_date} → {tv.s2_post_date}
                </td>
              </tr>
              <tr>
                <th>SAR Sensor & Polarizations</th>
                <td className="mono">
                  {gpv.sensor} ({gpv.polarizations_verified.join(", ")})
                </td>
              </tr>
              <tr>
                <th>Shared Relative Orbit Geometry</th>
                <td className="mono" style={{ color: "var(--success-valid)" }}>
                  Orbit {gpv.pre_relative_orbits.join(",")} ({gpv.shared_orbit_geometry ? "Verified Same-Geometry" : "Mixed"})
                </td>
              </tr>
              <tr>
                <th>Spatial Co-Registration & Water Mask</th>
                <td className="mono" style={{ color: "var(--success-valid)" }}>
                  {sgv.crs} | {sgv.dimensions_hw[0]}×{sgv.dimensions_hw[1]} @ {sgv.resolution_m}m | {analysis.water_pixels_excluded_scl6.toLocaleString()} SCL=6 water px excluded (0 remaining)
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 className="section-title" style={{ marginBottom: "0.75rem" }}>
            Burned Area Comparison Across Models & Reference Products
          </h3>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Model / Reference Product</th>
                  <th className="num-col">Burned Pixels</th>
                  <th className="num-col">Area (km²)</th>
                  <th className="num-col">Area (ha)</th>
                  <th className="num-col">% Valid Land</th>
                  <th className="num-col">95% CI (km²)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>Sentinel-2 dNBR ≥ 0.11 (Primary Ref)</strong>
                  </td>
                  <td className="num-col">{areas.sentinel2_dnbr_reference.burned_pixels.toLocaleString()}</td>
                  <td className="num-col">{areas.sentinel2_dnbr_reference.burned_area_km2.toFixed(2)}</td>
                  <td className="num-col">{areas.sentinel2_dnbr_reference.burned_area_ha.toFixed(1)}</td>
                  <td className="num-col">{areas.sentinel2_dnbr_reference.burned_percent_of_valid_area.toFixed(2)}%</td>
                  <td className="num-col">
                    [{areas.sentinel2_dnbr_reference.burned_area_km2_ci95[0].toFixed(1)},{" "}
                    {areas.sentinel2_dnbr_reference.burned_area_km2_ci95[1].toFixed(1)}]
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>NASA MODIS MCD64A1.061 (QA Ref)</strong>
                  </td>
                  <td className="num-col">{areas.nasa_mcd64a1_reference.burned_pixels.toLocaleString()}</td>
                  <td className="num-col">{areas.nasa_mcd64a1_reference.burned_area_km2.toFixed(2)}</td>
                  <td className="num-col">{areas.nasa_mcd64a1_reference.burned_area_ha.toFixed(1)}</td>
                  <td className="num-col">{areas.nasa_mcd64a1_reference.burned_percent_of_valid_area.toFixed(2)}%</td>
                  <td className="num-col">
                    [{areas.nasa_mcd64a1_reference.burned_area_km2_ci95[0].toFixed(1)},{" "}
                    {areas.nasa_mcd64a1_reference.burned_area_km2_ci95[1].toFixed(1)}]
                  </td>
                </tr>
                {Object.entries(areas.by_model).map(([modelKey, item]) => (
                  <tr key={modelKey}>
                    <td>
                      <span className="mono" style={{ fontWeight: modelKey === "unet" ? 700 : 500 }}>
                        {modelKey.toUpperCase()}
                      </span>
                    </td>
                    <td className="num-col">{item.burned_pixels.toLocaleString()}</td>
                    <td className="num-col">{item.burned_area_km2.toFixed(2)}</td>
                    <td className="num-col">{item.burned_area_ha.toFixed(1)}</td>
                    <td className="num-col">{item.burned_percent_of_valid_area.toFixed(2)}%</td>
                    <td className="num-col">
                      [{item.burned_area_km2_ci95[0].toFixed(1)}, {item.burned_area_km2_ci95[1].toFixed(1)}]
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Interactive Side-by-Side Before/After Visual Comparison */}
      <div className="card">
        <div className="section-header">
          <h3 className="section-title">Interactive Side-by-Side Before / After & Model Output Comparison</h3>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div>
              <label style={{ fontSize: "0.78rem", marginRight: "0.4rem", color: "var(--text-muted)" }}>
                Left Panel:
              </label>
              <select
                className="select-input"
                value={leftCompareLayer}
                onChange={(e) => setLeftCompareLayer(e.target.value)}
              >
                {RASTER_LAYERS.map((l) => (
                  <option key={l.key} value={l.key}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.78rem", marginRight: "0.4rem", color: "var(--text-muted)" }}>
                Right Panel:
              </label>
              <select
                className="select-input"
                value={rightCompareLayer}
                onChange={(e) => setRightCompareLayer(e.target.value)}
              >
                {RASTER_LAYERS.map((l) => (
                  <option key={l.key} value={l.key}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid-2">
          <div style={{ background: "#070b14", borderRadius: "10px", padding: "0.75rem", border: "1px solid var(--border-color)", textAlign: "center" }}>
            <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.5rem", color: "#f8fafc" }}>
              {RASTER_LAYERS.find((l) => l.key === leftCompareLayer)?.label}
            </div>
            <img
              src={leftUrl}
              alt={leftCompareLayer}
              style={{ width: "100%", maxHeight: "420px", objectFit: "contain", borderRadius: "6px" }}
            />
          </div>
          <div style={{ background: "#070b14", borderRadius: "10px", padding: "0.75rem", border: "1px solid var(--border-color)", textAlign: "center" }}>
            <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.5rem", color: "#f8fafc" }}>
              {RASTER_LAYERS.find((l) => l.key === rightCompareLayer)?.label}
            </div>
            <img
              src={rightUrl}
              alt={rightCompareLayer}
              style={{ width: "100%", maxHeight: "420px", objectFit: "contain", borderRadius: "6px" }}
            />
          </div>
        </div>
      </div>

      {/* 6-Panel Publication Overview Figure */}
      <div className="card">
        <h3 className="section-title" style={{ marginBottom: "0.75rem" }}>
          Verified 6-Panel Geospatial Before/After & Multi-Reference Overview ({analysis.event_id})
        </h3>
        <div style={{ background: "#070b14", borderRadius: "10px", padding: "0.75rem", textAlign: "center" }}>
          <img
            src={overviewUrl}
            alt={`6-panel overview for ${analysis.event_id}`}
            style={{ width: "100%", maxHeight: "560px", objectFit: "contain", borderRadius: "6px" }}
          />
        </div>
      </div>
    </div>
  );
};
