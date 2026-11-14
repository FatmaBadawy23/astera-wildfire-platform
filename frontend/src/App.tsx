import React, { useEffect, useState } from "react";
import { api } from "./api";
import type {
  DatasetStatsResponse,
  EventAnalysisResponse,
  EventGeoJSONResponse,
  FireEvent,
  HealthResponse,
  LatestRunResponse,
  ModelComparisonResponse,
  NisarStatusResponse,
} from "./types";
import { WildfireMapView } from "./components/WildfireMapView";
import { EventDetailsView } from "./components/EventDetailsView";
import { ModelPerformanceView } from "./components/ModelPerformanceView";
import { DatasetExplorerView } from "./components/DatasetExplorerView";
import { NisarStatusView } from "./components/NisarStatusView";
import { UploadAndAnalyzeView } from "./components/UploadAndAnalyzeView";

type ActiveTab =
  | "dashboard"
  | "upload-analyze"
  | "map"
  | "event-details"
  | "models"
  | "dataset"
  | "nisar";

export const App: React.FC = () => {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [latestRun, setLatestRun] = useState<LatestRunResponse | null>(null);
  const [events, setEvents] = useState<FireEvent[]>([]);
  const [comparison, setComparison] = useState<ModelComparisonResponse | null>(null);
  const [datasetStats, setDatasetStats] = useState<DatasetStatsResponse | null>(null);
  const [nisarStatus, setNisarStatus] = useState<NisarStatusResponse | null>(null);

  const [selectedEventId, setSelectedEventId] = useState<string>("CA_BUG_2026");
  const [eventAnalysis, setEventAnalysis] = useState<EventAnalysisResponse | null>(null);
  const [eventGeojson, setEventGeojson] = useState<EventGeoJSONResponse | null>(null);

  const [globalLoading, setGlobalLoading] = useState<boolean>(true);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [eventLoading, setEventLoading] = useState<boolean>(false);
  const [eventError, setEventError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    async function loadPlatformData() {
      setGlobalLoading(true);
      setGlobalError(null);
      try {
        const [h, run, evs, comp, ds, nisar] = await Promise.all([
          api.getHealth(),
          api.getLatestRun(),
          api.getEvents(true),
          api.getModelComparison(),
          api.getDatasetStats(),
          api.getNisarStatus(),
        ]);
        if (cancelled) return;
        setHealth(h);
        setLatestRun(run);
        setEvents(evs);
        setComparison(comp);
        setDatasetStats(ds);
        setNisarStatus(nisar);
      } catch (err) {
        if (!cancelled) {
          setGlobalError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setGlobalLoading(false);
        }
      }
    }
    loadPlatformData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedEventId) return;
    let cancelled = false;
    async function loadEventData() {
      setEventLoading(true);
      setEventError(null);
      try {
        const [ana, gj] = await Promise.all([
          api.getEventAnalysis(selectedEventId),
          api.getEventGeoJSON(selectedEventId),
        ]);
        if (cancelled) return;
        setEventAnalysis(ana);
        setEventGeojson(gj);
      } catch (err) {
        if (!cancelled) {
          setEventError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setEventLoading(false);
        }
      }
    }
    loadEventData();
    return () => {
      cancelled = true;
    };
  }, [selectedEventId]);

  const totalFirmsHotspots = events.reduce((acc, ev) => acc + (ev.firms_hotspot_count || 0), 0);
  const unetTestDnbr = comparison?.leaderboards?.vs_sentinel2_dnbr_20m?.UNet_ResNet34?.metrics?.TEST;
  const unetTestMcd = comparison?.leaderboards?.vs_nasa_mcd64a1_20m?.UNet_ResNet34?.metrics?.TEST;

  return (
    <div className="app-shell">
      {/* Top Navigation Header */}
      <header className="top-header">
        <div className="brand-group">
          <img src="/astera-logo.jpg" alt="Astera Watch Logo" className="brand-logo" />
          <div>
            <div className="brand-title">
              <span>ASTERA WATCH</span>
              <span className="badge badge-radar">NASA Space Apps 2026</span>
            </div>
            <div className="brand-subtitle">
              SAR Wildfire Surface-Change &amp; Burned-Area Intelligence Platform • Sentinel-1 C-Band Prototype (NISAR-Ready)
            </div>
          </div>
        </div>

        <nav className="nav-tabs" aria-label="Main Navigation">
          <button
            className={`nav-tab ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            Dashboard
          </button>
          <button
            data-testid="nav-upload-analyze"
            className={`nav-tab ${activeTab === "upload-analyze" ? "active" : ""}`}
            onClick={() => setActiveTab("upload-analyze")}
          >
            Upload &amp; Live Inference
          </button>
          <button
            className={`nav-tab ${activeTab === "map" ? "active" : ""}`}
            onClick={() => setActiveTab("map")}
          >
            Wildfire Map
          </button>
          <button
            className={`nav-tab ${activeTab === "event-details" ? "active" : ""}`}
            onClick={() => setActiveTab("event-details")}
          >
            Event Details
          </button>
          <button
            className={`nav-tab ${activeTab === "models" ? "active" : ""}`}
            onClick={() => setActiveTab("models")}
          >
            Model Performance
          </button>
          <button
            className={`nav-tab ${activeTab === "dataset" ? "active" : ""}`}
            onClick={() => setActiveTab("dataset")}
          >
            Dataset Explorer
          </button>
          <button
            className={`nav-tab ${activeTab === "nisar" ? "active" : ""}`}
            onClick={() => setActiveTab("nisar")}
          >
            NISAR Status
          </button>
        </nav>

        <div className="header-controls">
          <span className={`badge ${health?.status === "ONLINE" ? "badge-success" : "badge-danger"}`}>
            {health?.status || "CONNECTING"}
          </span>
          <button
            className="theme-btn"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            aria-label="Toggle Theme"
          >
            {theme === "dark" ? "☀ Light Mode" : "☾ Dark Mode"}
          </button>
        </div>
      </header>

      <main className="main-container">
        {globalLoading && (
          <div className="card" role="status">
            Loading verified Astera Watch run artifacts and geospatial telemetry...
          </div>
        )}

        {globalError && (
          <div className="alert-banner alert-danger" role="alert">
            <div>
              <strong>Backend API Connection Error:</strong> {globalError}. Ensure the FastAPI backend is running on port 8000.
            </div>
          </div>
        )}

        {!globalLoading && !globalError && activeTab === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Provenance Banner */}
            <div className="alert-banner alert-info">
              <div>
                <strong>Active Versioned Run:</strong>{" "}
                <code className="mono">{latestRun?.run_id}</code> (Generated:{" "}
                <span className="mono">{latestRun?.generated_at_utc}</span> | Previous Preserved Run:{" "}
                <code className="mono">{latestRun?.previous_baseline_run_id}</code>). All SAR features &amp; predictions are computed from real <strong>Sentinel-1 C-band RTC (20 m)</strong> observations (<code className="mono">is_nisar: false</code>) with strict <code className="mono">SCL=6</code> water exclusion (<code className="mono">0</code> water pixels in valid mask) and <code className="mono">MaskedBCEDiceLoss</code>.
              </div>
            </div>

            {/* 8 Required Dashboard KPIs */}
            <div className="kpi-grid">
              <div className="card">
                <div className="kpi-label">Monitored Wildfire Events</div>
                <div className="kpi-value">
                  {datasetStats?.events_summary.total_catalog_events ?? events.length}
                </div>
                <div className="kpi-sub">
                  {datasetStats?.events_summary.supervised_pipeline_events ?? 3} supervised (TRAIN/VAL/TEST) +{" "}
                  {datasetStats?.events_summary.excluded_events ?? 1} diagnostic excluded
                </div>
              </div>

              <div className="card">
                <div className="kpi-label">Active FIRMS Hotspots</div>
                <div className="kpi-value" style={{ color: "var(--danger-fire)" }}>
                  {totalFirmsHotspots.toLocaleString()}
                </div>
                <div className="kpi-sub">
                  VIIRS_SNPP_NRT thermal detections (+{" "}
                  {latestRun?.firms_egypt_smoke_test?.row_count ?? 106} live Egypt smoke test rows)
                </div>
              </div>

              <div className="card">
                <div className="kpi-label">Satellite Acquisitions</div>
                <div className="kpi-value">
                  {datasetStats?.acquisitions_summary.total_raster_files_on_disk ?? 100} GeoTIFFs
                </div>
                <div className="kpi-sub">
                  32 Sentinel-1 RTC + 48 Sentinel-2 L2A + 20 MODIS MCD64A1
                </div>
              </div>

              <div className="card">
                <div className="kpi-label">Latest Processing Run</div>
                <div className="kpi-value mono" style={{ fontSize: "1.05rem", color: "var(--accent-radar)" }}>
                  {latestRun?.run_id}
                </div>
                <div className="kpi-sub mono">
                  Status: {latestRun?.training_status} / {latestRun?.evaluation_status}
                </div>
              </div>

              <div className="card">
                <div className="kpi-label">Dataset Size (Leakage-Free)</div>
                <div className="kpi-value">
                  {latestRun?.dataset_counts.total_patches ?? 336} Patches
                </div>
                <div className="kpi-sub mono">
                  {datasetStats?.pixel_accounting.unique_scene_pixels_supervised_3_events.valid_land_pixels.toLocaleString()}{" "}
                  unique valid land px (20 m)
                </div>
              </div>

              <div className="card">
                <div className="kpi-label">Best Model vs Sentinel-2 dNBR</div>
                <div className="kpi-value" style={{ color: "var(--accent-primary)" }}>
                  F1 = {unetTestDnbr?.f1_score.toFixed(4) ?? "—"}
                </div>
                <div className="kpi-sub mono">
                  UNetResNet34 on TEST (CA_BUG_2026) | IoU = {unetTestDnbr?.iou.toFixed(4)} | AUC ={" "}
                  {unetTestDnbr?.roc_auc?.toFixed(4)}
                </div>
              </div>

              <div className="card">
                <div className="kpi-label">Best Model vs MODIS MCD64A1</div>
                <div className="kpi-value" style={{ color: "var(--success-valid)" }}>
                  F1 = {unetTestMcd?.f1_score.toFixed(4) ?? "—"}
                </div>
                <div className="kpi-sub mono">
                  UNetResNet34 on TEST (CA_BUG_2026) | IoU = {unetTestMcd?.iou.toFixed(4)} | Area Bias ={" "}
                  {unetTestMcd?.area_error_percent.toFixed(2)}%
                </div>
              </div>

              <div className="card">
                <div className="kpi-label">NISAR L2 GCOV Status</div>
                <div className="kpi-value" style={{ fontSize: "1.15rem", color: "var(--warning-burn)" }}>
                  0 Pixels Used
                </div>
                <div className="kpi-sub">
                  {nisarStatus?.total_validated_granules_discovered ?? 28} CMR granules discovered; download gated by Earthdata EULA
                </div>
              </div>
            </div>

            {/* Monitored Wildfire Events Catalogue Table */}
            <div className="card">
              <div className="section-header">
                <h2 className="section-title">Monitored 2026 California Wildfire Events Catalogue</h2>
                <span className="badge badge-success">All Co-Registered 800×800 @ 20 m UTM Grids Verified</span>
              </div>
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Event ID</th>
                      <th>Fire Name &amp; Region</th>
                      <th>Split Role</th>
                      <th>Ignition Date</th>
                      <th>Sentinel-1 Window</th>
                      <th className="num-col">Valid Land Px</th>
                      <th className="num-col">Water Excluded</th>
                      <th className="num-col">FIRMS Hotspots</th>
                      <th className="num-col">U-Net Pred (km²)</th>
                      <th className="num-col">S2 dNBR Ref (km²)</th>
                      <th className="num-col">MCD64A1 Ref (km²)</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((ev) => (
                      <tr key={ev.event_id}>
                        <td className="mono">
                          <strong>{ev.event_id}</strong>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{ev.fire_name}</div>
                          <div style={{ fontSize: "0.73rem", color: "var(--text-muted)" }}>{ev.state_region}</div>
                        </td>
                        <td>
                          <span className={`badge ${ev.include_in_training ? "badge-radar" : "badge-warning"}`}>
                            {ev.include_in_training ? ev.split_assignment : "EXCLUDED"}
                          </span>
                        </td>
                        <td className="mono">{ev.fire_start_date}</td>
                        <td className="mono" style={{ fontSize: "0.75rem" }}>
                          {ev.sar_pre_date} → {ev.sar_post_date}
                        </td>
                        <td className="num-col">{ev.valid_land_pixels?.toLocaleString() ?? "—"}</td>
                        <td className="num-col">{ev.water_pixels_excluded?.toLocaleString() ?? "0"}</td>
                        <td className="num-col">{ev.firms_hotspot_count?.toLocaleString() ?? "—"}</td>
                        <td className="num-col" style={{ fontWeight: 700, color: "var(--accent-primary)" }}>
                          {ev.predicted_burned_area_km2?.toFixed(2) ?? "—"}
                        </td>
                        <td className="num-col">{ev.dnbr_reference_area_km2?.toFixed(2) ?? "—"}</td>
                        <td className="num-col">{ev.mcd64a1_reference_area_km2?.toFixed(2) ?? "—"}</td>
                        <td>
                          <div style={{ display: "flex", gap: "0.4rem" }}>
                            <button
                              className="btn-primary"
                              style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                              onClick={() => {
                                setSelectedEventId(ev.event_id);
                                setActiveTab("map");
                              }}
                            >
                              Open Map
                            </button>
                            <button
                              className="btn-secondary"
                              style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                              onClick={() => {
                                setSelectedEventId(ev.event_id);
                                setActiveTab("event-details");
                              }}
                            >
                              Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Scientific Limitations & Water-Exclusion Verification */}
            <div className="grid-2">
              <div className="card">
                <h3 className="section-title" style={{ marginBottom: "0.65rem" }}>
                  Explicit Scientific Limitations &amp; Scope
                </h3>
                <ul style={{ paddingLeft: "1.2rem", fontSize: "0.84rem", display: "flex", flexDirection: "column", gap: "0.45rem", color: "var(--text-secondary)" }}>
                  {latestRun?.scientific_limitations.map((lim, i) => (
                    <li key={i}>{lim}</li>
                  ))}
                </ul>
              </div>

              <div className="card">
                <h3 className="section-title" style={{ marginBottom: "0.65rem" }}>
                  Verified Model Checkpoints (`{latestRun?.run_id}`)
                </h3>
                <table className="data-table">
                  <tbody>
                    <tr>
                      <th>U-Net ResNet-34 Loss</th>
                      <td className="mono">{latestRun?.checkpoint_metadata.unet.loss_function}</td>
                    </tr>
                    <tr>
                      <th>U-Net Best Epoch / Masked VAL IoU</th>
                      <td className="mono">
                        Epoch {latestRun?.checkpoint_metadata.unet.best_epoch} | VAL IoU ={" "}
                        {latestRun?.checkpoint_metadata.unet.best_val_iou.toFixed(4)} | Threshold ={" "}
                        {latestRun?.checkpoint_metadata.unet.selected_probability_threshold}
                      </td>
                    </tr>
                    <tr>
                      <th>U-Net Checkpoint SHA-256</th>
                      <td className="mono" style={{ fontSize: "0.72rem" }}>
                        {latestRun?.checkpoint_metadata.unet.checkpoint_sha256.slice(0, 32)}…
                      </td>
                    </tr>
                    <tr>
                      <th>LightGBM Config &amp; Best Iteration</th>
                      <td className="mono">
                        {latestRun?.checkpoint_metadata.lightgbm.config_id} | Iter{" "}
                        {latestRun?.checkpoint_metadata.lightgbm.best_iteration} (
                        {latestRun?.checkpoint_metadata.lightgbm.total_splits} splits)
                      </td>
                    </tr>
                    <tr>
                      <th>LightGBM Checkpoint SHA-256</th>
                      <td className="mono" style={{ fontSize: "0.72rem" }}>
                        {latestRun?.checkpoint_metadata.lightgbm.checkpoint_sha256.slice(0, 32)}…
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "upload-analyze" && <UploadAndAnalyzeView />}

        {activeTab === "map" && (
          <WildfireMapView
            events={events}
            selectedEventId={selectedEventId}
            onSelectEvent={setSelectedEventId}
            analysis={eventAnalysis}
            geojson={eventGeojson}
            loading={eventLoading}
            error={eventError}
          />
        )}

        {activeTab === "event-details" && (
          <EventDetailsView
            events={events}
            selectedEventId={selectedEventId}
            onSelectEvent={setSelectedEventId}
            analysis={eventAnalysis}
            loading={eventLoading}
            error={eventError}
          />
        )}

        {activeTab === "models" && (
          <ModelPerformanceView comparison={comparison} loading={globalLoading} error={globalError} />
        )}

        {activeTab === "dataset" && (
          <DatasetExplorerView stats={datasetStats} loading={globalLoading} error={globalError} />
        )}

        {activeTab === "nisar" && (
          <NisarStatusView nisar={nisarStatus} loading={globalLoading} error={globalError} />
        )}
      </main>

      <footer className="footer-bar">
        <div>
          <strong>Astera Watch</strong> — NASA Space Apps Challenge 2026 (Dancing with the SARs)
        </div>
        <div className="mono">
          Active Run: {latestRun?.run_id || "—"} | SAR Input: Sentinel-1 C-band RTC (20 m) | NISAR L-band Pixels: 0
        </div>
      </footer>
    </div>
  );
};
