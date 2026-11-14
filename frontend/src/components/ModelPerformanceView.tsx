import React, { useState } from "react";
import type { ModelComparisonResponse, SegmentationMetrics } from "../types";

interface Props {
  comparison: ModelComparisonResponse | null;
  loading: boolean;
  error: string | null;
}

type SplitKey = "TEST" | "VAL" | "TRAIN";
type ReferenceTab = "dnbr_20m" | "mcd_20m" | "mcd_500m";

export const ModelPerformanceView: React.FC<Props> = ({ comparison, loading, error }) => {
  const [selectedSplit, setSelectedSplit] = useState<SplitKey>("TEST");
  const [activeRefTab, setActiveRefTab] = useState<ReferenceTab>("dnbr_20m");

  if (loading && !comparison) {
    return <div className="card">Loading verified model evaluation leaderboards...</div>;
  }

  if (error || !comparison) {
    return (
      <div className="alert-banner alert-danger">
        <strong>Error loading model comparison:</strong> {error || "Model comparison unavailable."}
      </div>
    );
  }

  const splitEvents = comparison.splits[selectedSplit]?.join(", ") || "";
  const dnbrLeaderboard = comparison.leaderboards?.vs_sentinel2_dnbr_20m || comparison.models;
  const mcd20mLeaderboard = comparison.leaderboards?.vs_nasa_mcd64a1_20m || {};
  const mcd500mLeaderboard = comparison.leaderboards?.vs_nasa_mcd64a1_500m_blocks || {};

  const render20mTable = (
    leaderboard: Record<string, { description: string; role: string; threshold_used: number; metrics: Record<SplitKey, SegmentationMetrics> }>,
    refTitle: string,
    refBadge: string
  ) => {
    const entries = Object.entries(leaderboard).sort(
      (a, b) => (b[1].metrics[selectedSplit]?.f1_score ?? 0) - (a[1].metrics[selectedSplit]?.f1_score ?? 0)
    );

    return (
      <div className="card">
        <div className="section-header">
          <div>
            <h3 className="section-title">{refTitle}</h3>
            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
              Evaluated on <strong>{selectedSplit}</strong> split ({splitEvents}) — Run ID:{" "}
              <code className="mono">{comparison.run_id}</code>
            </div>
          </div>
          <span className="badge badge-radar">{refBadge}</span>
        </div>

        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Role</th>
                <th className="num-col">Threshold</th>
                <th className="num-col">F1 Score</th>
                <th className="num-col">95% CI (Block)</th>
                <th className="num-col">IoU</th>
                <th className="num-col">Precision</th>
                <th className="num-col">Recall</th>
                <th className="num-col">Specificity</th>
                <th className="num-col">ROC-AUC</th>
                <th className="num-col">PR-AUC</th>
                <th className="num-col">TP / FP / FN / TN</th>
                <th className="num-col">Pred vs Ref (km²)</th>
                <th className="num-col">Area Bias</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([modelName, entry]) => {
                const m = entry.metrics[selectedSplit];
                if (!m) return null;
                return (
                  <tr key={modelName}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{modelName}</div>
                      <div style={{ fontSize: "0.73rem", color: "var(--text-muted)" }}>{entry.description}</div>
                    </td>
                    <td>
                      <span className={`badge ${entry.role === "candidate" ? "badge-success" : "badge-warning"}`}>
                        {entry.role}
                      </span>
                    </td>
                    <td className="num-col">{entry.threshold_used}</td>
                    <td className="num-col" style={{ fontWeight: 700, color: "var(--accent-primary)" }}>
                      {m.f1_score.toFixed(4)}
                    </td>
                    <td className="num-col">
                      {m.f1_ci95_block_bootstrap
                        ? `[${m.f1_ci95_block_bootstrap[0].toFixed(4)}, ${m.f1_ci95_block_bootstrap[1].toFixed(4)}]`
                        : "—"}
                    </td>
                    <td className="num-col">{m.iou.toFixed(4)}</td>
                    <td className="num-col">{m.precision.toFixed(4)}</td>
                    <td className="num-col">{m.recall.toFixed(4)}</td>
                    <td className="num-col">{m.specificity.toFixed(4)}</td>
                    <td className="num-col">{m.roc_auc != null ? m.roc_auc.toFixed(4) : "—"}</td>
                    <td className="num-col">{m.pr_auc != null ? m.pr_auc.toFixed(4) : "—"}</td>
                    <td className="num-col" style={{ fontSize: "0.73rem" }}>
                      {m.true_positives.toLocaleString()} / {m.false_positives.toLocaleString()} /{" "}
                      {m.false_negatives.toLocaleString()} / {m.true_negatives.toLocaleString()}
                    </td>
                    <td className="num-col">
                      {m.predicted_area_km2.toFixed(2)} / {m.reference_area_km2.toFixed(2)}
                    </td>
                    <td className="num-col">
                      {m.area_error_percent > 0 ? `+${m.area_error_percent.toFixed(2)}%` : `${m.area_error_percent.toFixed(2)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
      {/* Scientific Separation Notice & Controls */}
      <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ fontSize: "1.3rem" }}>Scientific Model Evaluation & Separate Reference Leaderboards</h2>
          <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
            Metrics against <strong>Sentinel-2 dNBR (20 m)</strong> and <strong>NASA MODIS MCD64A1.061 (500 m)</strong> are strictly separated and never mixed into a single table.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.65rem", alignItems: "center", flexWrap: "wrap" }}>
          <label htmlFor="perf-split-select" style={{ fontSize: "0.84rem", fontWeight: 600 }}>
            Evaluation Split:
          </label>
          <select
            id="perf-split-select"
            className="select-input"
            value={selectedSplit}
            onChange={(e) => setSelectedSplit(e.target.value as SplitKey)}
          >
            <option value="TEST">HELD-OUT TEST — CA_BUG_2026 (465,828 valid land px)</option>
            <option value="VAL">VALIDATION — CA_DOME_2026 (608,150 valid land px)</option>
            <option value="TRAIN">TRAINING (Resubstitution) — CA_GANN_2026 (600,831 valid land px)</option>
          </select>
        </div>
      </div>

      {/* Reference Product Leaderboard Selector Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          className={`nav-tab ${activeRefTab === "dnbr_20m" ? "active" : ""}`}
          onClick={() => setActiveRefTab("dnbr_20m")}
          style={{ border: "1px solid var(--border-color)" }}
        >
          Leaderboard 1: vs Sentinel-2 L2A dNBR ≥ 0.11 (20 m)
        </button>
        <button
          className={`nav-tab ${activeRefTab === "mcd_20m" ? "active" : ""}`}
          onClick={() => setActiveRefTab("mcd_20m")}
          style={{ border: "1px solid var(--border-color)" }}
        >
          Leaderboard 2: vs NASA MODIS MCD64A1.061 QA-Filtered (20 m)
        </button>
        <button
          className={`nav-tab ${activeRefTab === "mcd_500m" ? "active" : ""}`}
          onClick={() => setActiveRefTab("mcd_500m")}
          style={{ border: "1px solid var(--border-color)" }}
        >
          Leaderboard 3: vs NASA MODIS MCD64A1.061 Native 500 m Blocks
        </button>
      </div>

      {activeRefTab === "dnbr_20m" &&
        render20mTable(
          dnbrLeaderboard,
          "Leaderboard 1 — Evaluated Against Sentinel-2 L2A dNBR ≥ 0.11 (20 m Grid)",
          "Primary Optical Reference (20 m)"
        )}

      {activeRefTab === "mcd_20m" &&
        render20mTable(
          mcd20mLeaderboard,
          "Leaderboard 2 — Evaluated Against NASA MODIS MCD64A1.061 QA-Filtered (20 m Grid)",
          "Independent Thermal/Surface Reflectance Reference"
        )}

      {activeRefTab === "mcd_500m" && (
        <div className="card">
          <div className="section-header">
            <div>
              <h3 className="section-title">
                Leaderboard 3 — Evaluated Against NASA MODIS MCD64A1.061 Native 500 m (25×25 px) Blocks
              </h3>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                Scale-reconciled evaluation on <strong>{selectedSplit}</strong> ({splitEvents}) — 1 block = 500 m × 500 m (0.25 km²)
              </div>
            </div>
            <span className="badge badge-radar">Native 500 m Resolution</span>
          </div>

          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th className="num-col">Valid 500m Blocks</th>
                  <th className="num-col">Block F1</th>
                  <th className="num-col">Block IoU</th>
                  <th className="num-col">Block Precision</th>
                  <th className="num-col">Block Recall</th>
                  <th className="num-col">Block Specificity</th>
                  <th className="num-col">Fractional MAE</th>
                  <th className="num-col">Fractional RMSE</th>
                  <th className="num-col">Pearson r</th>
                  <th className="num-col">Pred vs Ref (km²)</th>
                  <th className="num-col">Area Bias</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(mcd500mLeaderboard).map(([modelName, entry]) => {
                  const b = entry.metrics[selectedSplit];
                  if (!b) return null;
                  const cm = b.block_classification_metrics;
                  return (
                    <tr key={modelName}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{modelName}</div>
                        <div style={{ fontSize: "0.73rem", color: "var(--text-muted)" }}>{entry.description}</div>
                      </td>
                      <td className="num-col">{b.valid_500m_blocks}</td>
                      <td className="num-col" style={{ fontWeight: 700, color: "var(--accent-primary)" }}>
                        {cm.f1_score.toFixed(4)}
                      </td>
                      <td className="num-col">{cm.iou.toFixed(4)}</td>
                      <td className="num-col">{cm.precision.toFixed(4)}</td>
                      <td className="num-col">{cm.recall.toFixed(4)}</td>
                      <td className="num-col">{cm.specificity.toFixed(4)}</td>
                      <td className="num-col">{b.fractional_burn_mae.toFixed(4)}</td>
                      <td className="num-col">{b.fractional_burn_rmse.toFixed(4)}</td>
                      <td className="num-col">{b.fractional_burn_pearson_r.toFixed(4)}</td>
                      <td className="num-col">
                        {cm.predicted_area_km2.toFixed(2)} / {cm.reference_area_km2.toFixed(2)}
                      </td>
                      <td className="num-col">
                        {cm.area_error_percent > 0 ? `+${cm.area_error_percent.toFixed(2)}%` : `${cm.area_error_percent.toFixed(2)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Training & Checkpoint Provenance Details */}
      <div className="grid-2">
        <div className="card">
          <h3 className="section-title" style={{ marginBottom: "0.75rem" }}>
            U-Net ResNet-34 (`MaskedBCEDiceLoss`) Training Provenance
          </h3>
          <table className="data-table">
            <tbody>
              <tr>
                <th>Loss Function</th>
                <td className="mono">{comparison.training.unet.loss_function}</td>
              </tr>
              <tr>
                <th>Masked Loss Active (`valid_mask &gt; 0`)</th>
                <td className="mono" style={{ color: "var(--success-valid)" }}>
                  {comparison.training.unet.masked_loss_used ? "TRUE (0 gradient on water/invalid px)" : "FALSE"}
                </td>
              </tr>
              <tr>
                <th>Input Channels ({comparison.training.unet.in_channels})</th>
                <td className="mono">{comparison.training.unet.channels.join(", ")}</td>
              </tr>
              <tr>
                <th>Best Epoch / Validation IoU</th>
                <td className="mono">
                  Epoch {comparison.training.unet.best_epoch} / {comparison.training.unet.epochs_trained} | VAL IoU ={" "}
                  {comparison.training.unet.best_val_iou.toFixed(4)} (VAL Dice = {comparison.training.unet.best_val_dice.toFixed(4)})
                </td>
              </tr>
              <tr>
                <th>Epoch Train Losses</th>
                <td className="mono">[{comparison.training.unet.train_losses.join(", ")}]</td>
              </tr>
              <tr>
                <th>Epoch Masked Val IoUs</th>
                <td className="mono">[{comparison.training.unet.val_ious.join(", ")}]</td>
              </tr>
              <tr>
                <th>Selected Probability Threshold (VAL)</th>
                <td className="mono">{comparison.training.unet.selected_probability_threshold}</td>
              </tr>
              <tr>
                <th>Checkpoint Path & SHA-256</th>
                <td className="mono" style={{ fontSize: "0.73rem", wordBreak: "break-all" }}>
                  {comparison.training.unet.checkpoint_path}
                  <br />
                  SHA-256: {comparison.training.unet.checkpoint_sha256}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 className="section-title" style={{ marginBottom: "0.75rem" }}>
            LightGBM (`Phase G2 Config D`) Training Provenance
          </h3>
          <table className="data-table">
            <tbody>
              <tr>
                <th>Configuration ID</th>
                <td className="mono">{comparison.training.lightgbm.config_id}</td>
              </tr>
              <tr>
                <th>Best Iteration & Total Splits</th>
                <td className="mono" style={{ color: "var(--success-valid)" }}>
                  Iteration {comparison.training.lightgbm.best_iteration} ({comparison.training.lightgbm.total_splits} splits — single-tree collapse resolved)
                </td>
              </tr>
              <tr>
                <th>Class Weighting & Early Stopping</th>
                <td className="mono">
                  scale_pos_weight = {comparison.training.lightgbm.scale_pos_weight}, eval_metric = "{comparison.training.lightgbm.eval_metric}"
                </td>
              </tr>
              <tr>
                <th>Subsampled Valid Land Pixels</th>
                <td className="mono">
                  TRAIN: {comparison.training.lightgbm.training_pixels.toLocaleString()} px | VAL:{" "}
                  {comparison.training.lightgbm.validation_pixels.toLocaleString()} px
                </td>
              </tr>
              <tr>
                <th>Selected Probability Threshold (VAL)</th>
                <td className="mono">{comparison.training.lightgbm.selected_probability_threshold}</td>
              </tr>
              <tr>
                <th>Top Split Features</th>
                <td className="mono">
                  {comparison.training.lightgbm.top_features.map(([f, c]) => `${f} (${c})`).join(", ")}
                </td>
              </tr>
              <tr>
                <th>Checkpoint Path & SHA-256</th>
                <td className="mono" style={{ fontSize: "0.73rem", wordBreak: "break-all" }}>
                  {comparison.training.lightgbm.checkpoint_path}
                  <br />
                  SHA-256: {comparison.training.lightgbm.checkpoint_sha256}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
