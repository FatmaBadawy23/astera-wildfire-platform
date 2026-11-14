import React from "react";
import type { NisarStatusResponse } from "../types";

interface Props {
  nisar: NisarStatusResponse | null;
  loading: boolean;
  error: string | null;
}

export const NisarStatusView: React.FC<Props> = ({ nisar, loading, error }) => {
  if (loading && !nisar) {
    return <div className="card">Loading NISAR L-band status and NASA CMR discovery manifest...</div>;
  }

  if (error || !nisar) {
    return (
      <div className="alert-banner alert-danger">
        <strong>Error loading NISAR status:</strong> {error || "NISAR status unavailable."}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
      <div className="alert-banner alert-warning">
        <div>
          <strong>Scientific Transparency & Sensor Provenance Statement:</strong> All SAR backscatter features, change maps, and model predictions in this platform use <strong>real Sentinel-1 C-band (5.405 GHz) RTC imagery</strong>. While real NASA NISAR L2 GCOV (`C3622241360-ASF`) pre/post wildfire granule pairs were discovered via NASA CMR, downloading the HDF5 science granules requires interactive NASA Earthdata Login OAuth2 credentials and ASF EULA acceptance. Therefore, <strong>zero NISAR pixels were used in model training or evaluation</strong>.
        </div>
      </div>

      {/* Mandatory Truthful NISAR Status Panel (Section 9.6 of Phase G) */}
      <div className="card">
        <div className="section-header">
          <h2 style={{ fontSize: "1.3rem" }}>Truthful NISAR L2 GCOV Operational Status</h2>
          <span className="badge badge-warning">is_nisar: false | CROSS_SENSOR_PROTOTYPE</span>
        </div>

        <div className="kpi-grid">
          <div className="card" style={{ background: "var(--bg-secondary)" }}>
            <div className="kpi-label">Metadata Discovered</div>
            <div className="kpi-value" style={{ color: "var(--success-valid)" }}>
              {nisar.metadata_discovered ? "Yes" : "No"}
            </div>
            <div className="kpi-sub mono">
              {nisar.total_validated_granules_discovered} granules ({nisar.matched_same_geometry_pairs_count} matched pairs)
            </div>
          </div>

          <div className="card" style={{ background: "var(--bg-secondary)" }}>
            <div className="kpi-label">Authentication Required</div>
            <div className="kpi-value" style={{ color: "var(--warning-burn)" }}>
              {nisar.authentication_required ? "Yes" : "No"}
            </div>
            <div className="kpi-sub mono">Earthdata OAuth2 + ASF EULA</div>
          </div>

          <div className="card" style={{ background: "var(--bg-secondary)" }}>
            <div className="kpi-label">Download Blocked</div>
            <div className="kpi-value" style={{ color: "var(--danger-fire)" }}>
              {nisar.download_blocked ? "Yes" : "No"}
            </div>
            <div className="kpi-sub mono">HTTP {nisar.http_status_on_unauthenticated_download} Unauthorized</div>
          </div>

          <div className="card" style={{ background: "var(--bg-secondary)" }}>
            <div className="kpi-label">NISAR Granules Downloaded</div>
            <div className="kpi-value">{nisar.nisar_granules_downloaded ? "Yes" : "No"}</div>
            <div className="kpi-sub mono">0 local HDF5 science files</div>
          </div>

          <div className="card" style={{ background: "var(--bg-secondary)" }}>
            <div className="kpi-label">NISAR Pixels Used</div>
            <div className="kpi-value mono">{nisar.nisar_pixels_used}</div>
            <div className="kpi-sub mono">Used in training/eval: False</div>
          </div>

          <div className="card" style={{ background: "var(--bg-secondary)" }}>
            <div className="kpi-label">Current SAR Model Input</div>
            <div className="kpi-value" style={{ color: "var(--accent-radar)", fontSize: "1.3rem" }}>
              {nisar.current_sar_model_input}
            </div>
            <div className="kpi-sub mono">{nisar.current_sar_sensor_detail}</div>
          </div>
        </div>
      </div>

      {/* Discovered NASA CMR Same-Geometry NISAR Pairs Table */}
      <div className="card">
        <div className="section-header">
          <div>
            <h3 className="section-title">
              Discovered NASA CMR NISAR L2 GCOV (`{nisar.validated_collection_concept_id}`) Pre/Post Granule Pairs
            </h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
              Metadata-verified via live NASA Common Metadata Repository queries. Ready for ingestion via `NISARGCOVReader` once Earthdata credentials with ASF EULA are supplied.
            </p>
          </div>
        </div>

        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Event ID</th>
                <th>Wildfire Name</th>
                <th className="num-col">Validated Granules</th>
                <th className="num-col">Same-Geometry Pairs</th>
                <th>Track / Frame / Pass</th>
                <th>Primary Pre-Fire Granule UR</th>
                <th>Primary Post-Fire Granule UR</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(nisar.events).map((ev) => (
                <tr key={ev.event_id}>
                  <td className="mono">
                    <strong>{ev.event_id}</strong>
                  </td>
                  <td>{ev.fire_name}</td>
                  <td className="num-col">{ev.validated_granules_count}</td>
                  <td className="num-col">{ev.matched_pairs_count}</td>
                  <td className="mono" style={{ fontSize: "0.75rem" }}>
                    {ev.track_frame_pass || "—"}
                  </td>
                  <td className="mono" style={{ fontSize: "0.73rem" }}>
                    {ev.pre_granule_ur || "—"}
                  </td>
                  <td className="mono" style={{ fontSize: "0.73rem" }}>
                    {ev.post_granule_ur || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
