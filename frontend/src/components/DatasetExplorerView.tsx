import React from "react";
import type { DatasetStatsResponse } from "../types";

interface Props {
  stats: DatasetStatsResponse | null;
  loading: boolean;
  error: string | null;
}

export const DatasetExplorerView: React.FC<Props> = ({ stats, loading, error }) => {
  if (loading && !stats) {
    return <div className="card">Loading dataset accounting and provenance statistics...</div>;
  }

  if (error || !stats) {
    return (
      <div className="alert-banner alert-danger">
        <strong>Error loading dataset stats:</strong> {error || "Dataset statistics unavailable."}
      </div>
    );
  }

  const unique3 = stats.pixel_accounting.unique_scene_pixels_supervised_3_events;
  const overlap336 = stats.pixel_accounting.overlapping_patch_pixels_336_patches;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
      <div className="card">
        <div className="section-header">
          <div>
            <h2 style={{ fontSize: "1.3rem" }}>
              Dataset Explorer & Pixel Accounting ({stats.dataset_version})
            </h2>
            <p style={{ fontSize: "0.83rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
              {stats.pixel_accounting.explanation}
            </p>
          </div>
          <span className="badge badge-success">Water SCL=6 Strictly Excluded (0 Water Px in Valid Mask)</span>
        </div>

        {/* Side-by-Side Comparison: Unique Scene Pixels vs Overlapping Patch Pixels */}
        <div className="grid-2" style={{ marginTop: "0.75rem" }}>
          <div style={{ background: "var(--bg-secondary)", padding: "1rem", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
            <h3 className="section-title" style={{ color: "var(--accent-radar)", marginBottom: "0.6rem" }}>
              1. Unique Non-Overlapping Scene Pixels (3 Supervised Events)
            </h3>
            <table className="data-table">
              <tbody>
                <tr>
                  <th>Total Grid Pixels (3 × 800 × 800 @ 20 m)</th>
                  <td className="num-col">{unique3.total_scene_pixels.toLocaleString()}</td>
                </tr>
                <tr>
                  <th>Valid Land Pixels (Used in Scene Evaluation)</th>
                  <td className="num-col" style={{ color: "var(--success-valid)", fontWeight: 700 }}>
                    {unique3.valid_land_pixels.toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <th>SCL=6 Water Pixels Excluded</th>
                  <td className="num-col">{unique3.water_pixels_excluded_scl6.toLocaleString()}</td>
                </tr>
                <tr>
                  <th>Other Invalid / Cloud / Shadow Pixels Excluded</th>
                  <td className="num-col">{unique3.other_invalid_pixels.toLocaleString()}</td>
                </tr>
                <tr>
                  <th>Burned Valid Land Pixels (Sentinel-2 dNBR ≥ 0.11)</th>
                  <td className="num-col">{unique3.burned_dnbr_pixels.toLocaleString()}</td>
                </tr>
                <tr>
                  <th>Unburned Valid Land Pixels (Sentinel-2 dNBR &lt; 0.11)</th>
                  <td className="num-col">{unique3.unburned_dnbr_pixels.toLocaleString()}</td>
                </tr>
                <tr>
                  <th>Burned Valid Land Pixels (MODIS MCD64A1 QA-Filtered)</th>
                  <td className="num-col">{unique3.burned_mcd64a1_pixels.toLocaleString()}</td>
                </tr>
                <tr>
                  <th>LightGBM Subsampled Pixels (Every 2nd Row/Col)</th>
                  <td className="num-col">
                    TRAIN: {unique3.lightgbm_subsampled_train_pixels.toLocaleString()} | VAL:{" "}
                    {unique3.lightgbm_subsampled_val_pixels.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ background: "var(--bg-secondary)", padding: "1rem", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
            <h3 className="section-title" style={{ color: "var(--accent-primary)", marginBottom: "0.6rem" }}>
              2. Overlapping Sliding-Window Patch Pixels (336 Patches, 128×128, Stride 64)
            </h3>
            <table className="data-table">
              <tbody>
                <tr>
                  <th>Total Nominal Patch Pixels (336 × 16,384)</th>
                  <td className="num-col">{overlap336.total_nominal_patch_pixels.toLocaleString()}</td>
                </tr>
                <tr>
                  <th>Valid Land Patch Pixels (`valid &gt; 0` in Masked Loss)</th>
                  <td className="num-col" style={{ color: "var(--success-valid)", fontWeight: 700 }}>
                    {overlap336.valid_land_patch_pixels.toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <th>Invalid / Water Patch Pixels (`valid == 0`, Zero Gradient)</th>
                  <td className="num-col">{overlap336.invalid_or_water_masked_patch_pixels.toLocaleString()}</td>
                </tr>
                <tr>
                  <th>Burned Valid Patch Pixels (dNBR ≥ 0.11)</th>
                  <td className="num-col">{overlap336.burned_valid_patch_pixels.toLocaleString()}</td>
                </tr>
                <tr>
                  <th>Unburned Valid Patch Pixels (dNBR &lt; 0.11)</th>
                  <td className="num-col">{overlap336.unburned_valid_patch_pixels.toLocaleString()}</td>
                </tr>
                <tr>
                  <th>Patches per Split (TRAIN / VAL / TEST)</th>
                  <td className="num-col">
                    {stats.patch_configuration.patches_per_split.TRAIN} /{" "}
                    {stats.patch_configuration.patches_per_split.VAL} /{" "}
                    {stats.patch_configuration.patches_per_split.TEST} (Total: {stats.patch_configuration.total_patches})
                  </td>
                </tr>
                <tr>
                  <th>U-Net Channels ({stats.patch_configuration.unet_in_channels})</th>
                  <td className="num-col">{stats.patch_configuration.unet_channel_names.join(", ")}</td>
                </tr>
                <tr>
                  <th>Channel Normalization Scope</th>
                  <td className="num-col">{stats.patch_configuration.normalization.fitted_on}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Per-Event Scene Breakdown (Including Excluded CA_TIMBER_2026) */}
      <div className="card">
        <h3 className="section-title" style={{ marginBottom: "0.75rem" }}>
          Per-Event Scene & Acquisition Accounting (All 4 Catalog Events)
        </h3>
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Event ID & Name</th>
                <th>Split & Status</th>
                <th className="num-col">Scene Grid</th>
                <th className="num-col">Valid Land Px</th>
                <th className="num-col">Water Excluded (SCL=6)</th>
                <th className="num-col">Water in Valid</th>
                <th className="num-col">Burned dNBR Px (%)</th>
                <th className="num-col">Burned MCD64A1 Px (%)</th>
                <th>S1 Date Window (4 Scenes)</th>
                <th>S2 Pre / Post</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(stats.pixel_accounting.per_event).map((ev) => (
                <tr key={ev.event_id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>
                      {ev.fire_name} ({ev.event_id})
                    </div>
                    {ev.exclusion_reason && (
                      <div style={{ fontSize: "0.73rem", color: "var(--warning-burn)", maxWidth: "420px" }}>
                        {ev.exclusion_reason}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${ev.include_in_training ? "badge-success" : "badge-warning"}`}>
                      {ev.split}
                    </span>
                  </td>
                  <td className="num-col">
                    {ev.grid_dimensions_hw[0]}×{ev.grid_dimensions_hw[1]}
                  </td>
                  <td className="num-col">{ev.valid_land_pixels.toLocaleString()}</td>
                  <td className="num-col">{ev.water_pixels_excluded_scl6.toLocaleString()}</td>
                  <td className="num-col" style={{ color: "var(--success-valid)" }}>
                    {ev.water_pixels_in_valid_mask}
                  </td>
                  <td className="num-col">
                    {ev.burned_dnbr_pixels.toLocaleString()} ({(ev.burned_dnbr_prevalence * 100).toFixed(2)}%)
                  </td>
                  <td className="num-col">
                    {ev.burned_mcd64a1_pixels.toLocaleString()} ({(ev.burned_mcd64a1_prevalence * 100).toFixed(2)}%)
                  </td>
                  <td className="mono" style={{ fontSize: "0.75rem" }}>
                    {ev.s1_date_range[0]} → {ev.s1_date_range[1]}
                  </td>
                  <td className="mono" style={{ fontSize: "0.75rem" }}>
                    {ev.s2_pre_date} / {ev.s2_post_date}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-Split Patch NPZ Cryptographic Manifest */}
      <div className="card">
        <h3 className="section-title" style={{ marginBottom: "0.75rem" }}>
          Split Patch Tensors (`.npz`) & Cryptographic Checksums
        </h3>
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Split</th>
                <th>Relative Path</th>
                <th className="num-col">Patches</th>
                <th className="num-col">Nominal Px</th>
                <th className="num-col">Valid Land Px</th>
                <th className="num-col">Invalid/Water Px</th>
                <th className="num-col">Burned Valid Px</th>
                <th className="num-col">Positive %</th>
                <th>SHA-256 Checksum</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(overlap336.by_split).map(([split, info]) => (
                <tr key={split}>
                  <td>
                    <strong>{split}</strong>
                  </td>
                  <td className="mono" style={{ fontSize: "0.75rem" }}>
                    {info.path}
                  </td>
                  <td className="num-col">{info.samples}</td>
                  <td className="num-col">{info.nominal_patch_pixels.toLocaleString()}</td>
                  <td className="num-col">{info.valid_patch_pixels.toLocaleString()}</td>
                  <td className="num-col">{info.invalid_patch_pixels.toLocaleString()}</td>
                  <td className="num-col">{info.burned_valid_patch_pixels.toLocaleString()}</td>
                  <td className="num-col">{(info.positive_pixel_fraction_valid * 100).toFixed(2)}%</td>
                  <td className="mono" style={{ fontSize: "0.72rem" }}>
                    {info.sha256.slice(0, 24)}…
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Data Provenance Breakdown */}
      <div className="grid-2">
        <div className="card">
          <h3 className="section-title" style={{ marginBottom: "0.65rem" }}>
            Data Provenance: Live Network vs. Cached Real Rasters
          </h3>
          <table className="data-table">
            <tbody>
              {Object.entries(stats.data_provenance.newly_acquired_live_network_data).map(([k, v]) => (
                <tr key={k}>
                  <th>Live Network: {k}</th>
                  <td className="mono">{v}</td>
                </tr>
              ))}
              {Object.entries(stats.data_provenance.cached_real_satellite_rasters).map(([k, v]) => (
                <tr key={k}>
                  <th>Verified Raster Cache: {k}</th>
                  <td className="mono">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 className="section-title" style={{ marginBottom: "0.65rem" }}>
            Valid-Only Channel Normalization (`TRAIN` Land Pixels)
          </h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Channel Index</th>
                <th>Channel Name</th>
                <th className="num-col">Mean (dB)</th>
                <th className="num-col">Std Dev (dB)</th>
              </tr>
            </thead>
            <tbody>
              {stats.patch_configuration.unet_channel_names.map((chName, idx) => (
                <tr key={chName}>
                  <td className="mono">Channel {idx}</td>
                  <td className="mono">
                    <strong>{chName}</strong>
                  </td>
                  <td className="num-col">{stats.patch_configuration.normalization.mean[idx]?.toFixed(4)}</td>
                  <td className="num-col">{stats.patch_configuration.normalization.std[idx]?.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
