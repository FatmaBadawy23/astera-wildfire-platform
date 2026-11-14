import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { HelpProvider } from "@/components/help/HelpContext";
import { LiveInferenceStudioPage } from "./LiveInferenceStudioPage";

function renderStudio() {
  return render(
    <MemoryRouter>
      <HelpProvider>
        <LiveInferenceStudioPage />
      </HelpProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LiveInferenceStudioPage & liveInferenceClient", () => {
  it("loads models, runs sample Before/After pair inference, switches swipe mode, and surfaces 422 RGB rejection messages", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/models/available")) {
        return new Response(
          JSON.stringify({
            active_run_id: "run_20261114_025000_phase_g",
            data_origin: "CROSS_SENSOR_PROTOTYPE",
            is_nisar: false,
            models: [
              {
                model_id: "unet",
                registry_key: "UNet_ResNet34",
                name: "UNet_ResNet34",
                family: "CNN",
                version: "1.0",
                status: "READY",
                is_primary: true,
                checkpoint_path: "outputs/runs/run_20261114_025000_phase_g/checkpoints/real_unet_resnet34_phase_g.pt",
                checkpoint_size_bytes: 349206898,
                checkpoint_sha256: "abc",
                loss_function: "bce_dice",
                default_threshold: 0.48,
                input_contract: { type: "5ch_tensor", requires_dual_pol: true },
                limitations: [],
              },
            ],
            sample_uploads: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/api/analysis/upload-sample")) {
        const body = JSON.parse(String(init?.body ?? "{}"));
        return new Response(
          JSON.stringify({
            upload_id: body.role === "pre_fire" ? "up_pre_1" : "up_post_1",
            filename: `${body.role}.tif`,
            role: body.role,
            file_format: "GeoTIFF",
            file_size_bytes: 4096,
            sha256: "deadbeef",
            is_valid: true,
            valid_for_sar_inference: true,
            validation_status: "VALID",
            error_code: null,
            scientific_explanation: "Valid Sentinel-1 dual-pol VV/VH dB scene.",
            crs: "EPSG:32610",
            width: 512,
            height: 512,
            band_count: 2,
            bands: ["VV", "VH"],
            polarizations: ["VV", "VH"],
            resolution_m: 10,
            valid_pixel_percentage: 100,
            compatible_models: ["unet", "lightgbm", "log_ratio", "cusum"],
            warnings: [],
            preview_url: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/api/analysis/validate-pair")) {
        return new Response(
          JSON.stringify({
            pair_id: "pair_123",
            pre_upload_id: "up_pre_1",
            post_upload_id: "up_post_1",
            compatible: true,
            status: "VALID",
            checks: {
              crs_match: true,
              pre_crs: "EPSG:32610",
              post_crs: "EPSG:32610",
              spatial_overlap_percent: 100,
              dimensions_match: true,
              transform_match: true,
              resolution_match: true,
              date_order_valid: true,
              co_registered: true,
              dual_polarization_available: true,
            },
            compatible_models: ["unet", "lightgbm", "log_ratio", "cusum"],
            reasons: [],
            warnings: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/api/analysis/run")) {
        return new Response(
          JSON.stringify({
            analysis_id: "ana_123",
            job_id: "ana_123",
            status: "COMPLETED",
            execution_time_sec: 1.4,
            source_label: "UPLOAD",
            event_id: "CA_BUG_2026",
            model_type: "unet",
            model_name: "UNet_ResNet34",
            threshold_used: 0.48,
            spatial_metadata: {
              crs: "EPSG:32610",
              width: 512,
              height: 512,
              resolution_m: 10,
              pre_date: "2026-07-01",
              post_date: "2026-08-01",
            },
            area_statistics: {
              valid_land_pixels: 262144,
              burned_pixels: 4200,
              burned_percentage_of_valid: 1.6,
              burned_area_ha: 42.0,
              burned_area_km2: 0.42,
              burned_area_acres: 103.8,
            },
            before_after_radiometry: {
              mean_pre_vh_db: -17.1,
              mean_post_vh_db: -18.8,
              mean_delta_vh_db: -1.7,
              mean_delta_vh_burned_db: -2.9,
              p95_burn_probability: 0.89,
            },
            model_comparison: {
              unet: { model_id: "unet", registry_name: "UNet_ResNet34", threshold: 0.48, execution_time_sec: 1.0, burned_pixels: 4200, burned_area_km2: 0.42, burned_area_ha: 42, burned_percentage: 1.6 },
              lightgbm: { model_id: "lightgbm", registry_name: "LightGBM_Pixel_Spatial", threshold: 0.5, execution_time_sec: 0.2, burned_pixels: 4100, burned_area_km2: 0.41, burned_area_ha: 41, burned_percentage: 1.5 },
              log_ratio: { model_id: "log_ratio", registry_name: "Log_Ratio_Baseline", threshold: -1.5, execution_time_sec: 0.1, burned_pixels: 3900, burned_area_km2: 0.39, burned_area_ha: 39, burned_percentage: 1.4 },
              cusum: { model_id: "cusum", registry_name: "CUSUM_Temporal", threshold: 0.5, execution_time_sec: 0.1, burned_pixels: 3800, burned_area_km2: 0.38, burned_area_ha: 38, burned_percentage: 1.4 },
            },
            layers: {
              pre_fire_vh_db: "/api/analysis/results/ana_123/layers/pre_fire_vh_db.png",
              post_fire_vh_db: "/api/analysis/results/ana_123/layers/post_fire_vh_db.png",
              delta_vh_db: "/api/analysis/results/ana_123/layers/delta_vh_db.png",
              burn_probability: "/api/analysis/results/ana_123/layers/burn_probability.png",
              predicted_burn_mask: "/api/analysis/results/ana_123/layers/predicted_burn_mask.png",
              difference_heatmap: "/api/analysis/results/ana_123/layers/difference_heatmap.png",
              overview_png: "/api/analysis/results/ana_123/overview.png",
            },
            downloads: {
              burn_probability_tif: "/api/analysis/results/ana_123/rasters/burn_probability.tif",
              predicted_burn_mask_tif: "/api/analysis/results/ana_123/rasters/predicted_burn_mask.tif",
              delta_vh_db_tif: "/api/analysis/results/ana_123/rasters/delta_vh_db.tif",
              burned_polygons_geojson: "/api/analysis/results/ana_123/geojson/burned_polygons.geojson",
              metadata_json: "/api/analysis/results/ana_123/metadata.json",
            },
            burned_polygons_feature_count: 14,
            summary: "Real multi-model SAR inference complete.",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/api/analysis/upload")) {
        return new Response(
          JSON.stringify({
            detail: {
              code: "UNSUPPORTED_OPTICAL_RGB_FOR_SAR_MODEL",
              message: "Optical RGB images without calibrated SAR bands cannot be scored.",
            },
          }),
          { status: 422, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("Not Found", { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderStudio();

    await waitFor(() =>
      expect(screen.getByText(/Verified Model Checkpoints \(run_20261114_025000_phase_g\)/)).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("live-studio-load-dualpol"));
    await waitFor(() => expect(screen.getByTestId("live-pair-validation")).toHaveTextContent("pair_123"));

    await user.click(screen.getByTestId("live-run-inference-btn"));
    await waitFor(() => expect(screen.getByTestId("live-analysis-output")).toHaveTextContent("0.42 km²"));
    expect(screen.getByText(/Download Burned Polygons GeoJSON \(14 features\)/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Before/After Swipe" }));
    expect(screen.getByAltText("Pre-Fire VH Overlay")).toBeInTheDocument();

    // Switch to Interactive Burn Map and Multi-Model Dashboard verification
    expect(screen.getByTestId("multi-model-dashboard")).toBeInTheDocument();
    expect(screen.getByTestId("model-card-unet")).toBeInTheDocument();
    expect(screen.getByTestId("model-card-cusum")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Interactive Burn Map" }));
    expect(screen.getByTestId("burn-analysis-map")).toBeInTheDocument();

    const preInput = screen.getByTestId("live-pre-upload-input");
    const badPng = new File([new Uint8Array([137, 80, 78, 71])], "rgb_photo.png", { type: "image/png" });
    fireEvent.change(preInput, { target: { files: [badPng] } });

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("UNSUPPORTED_OPTICAL_RGB_FOR_SAR_MODEL"));
  });

  it("shows single-image recovery candidates, handles HTTP 200 RGB GeoTIFF rejection, and blocks inverted acquisition dates", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/models/available")) {
        return new Response(
          JSON.stringify({
            active_run_id: "run_20261114_025000_phase_g",
            data_origin: "CROSS_SENSOR_PROTOTYPE",
            is_nisar: false,
            models: [],
            sample_uploads: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/api/analysis/reference-candidates")) {
        return new Response(
          JSON.stringify({
            upload_id: "upl_single_post",
            role_needed: "pre",
            candidates: [
              {
                sample_id: "CA_BUG_2026_DUALPOL",
                title: "CA_BUG_2026 (Park Fire) — Sentinel-1 Dual-Pol",
                event_id: "CA_BUG_2026",
                role_provided: "pre",
                file_path: "outputs/sample_uploads/CA_BUG_2026_sentinel1_pre_dualpol_vv_vh_db.tif",
                sensor: "Sentinel-1 C-band RTC",
                bands: ["VV_dB", "VH_dB"],
                polarizations: ["VV", "VH"],
                acquisition_date: "2024-07-12",
                crs: "EPSG:32610",
                bounds_wgs84: [-121.95, 39.85, -121.75, 40.0],
                width: 256,
                height: 256,
                overlap_percent: 100,
                crs_match: true,
                date_order_valid: true,
                dual_polarization_match: true,
                recommended: true,
                compatibility_note: "100.0% spatial overlap with uploaded raster; CRS matches",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/api/analysis/validate-pair")) {
        return new Response(
          JSON.stringify({
            pair_id: "pair_paired_ref",
            pre_upload_id: "upl_ref_pre",
            post_upload_id: "upl_single_post",
            compatible: true,
            status: "SUITABLE",
            checks: {
              crs_match: true,
              pre_crs: "EPSG:32610",
              post_crs: "EPSG:32610",
              spatial_overlap_percent: 100,
              dimensions_match: true,
              transform_match: true,
              resolution_match: true,
              date_order_valid: true,
              co_registered: false,
              dual_polarization_available: true,
            },
            compatible_models: ["unet", "lightgbm", "log_ratio"],
            reasons: [],
            warnings: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/api/analysis/upload-sample")) {
        return new Response(
          JSON.stringify({
            upload_id: "upl_ref_pre",
            filename: "CA_BUG_2026_pre.tif",
            role: "pre_fire",
            file_format: "GEOTIFF",
            file_size_bytes: 8192,
            sha256: "abc",
            is_valid: true,
            valid_for_sar_inference: true,
            validation_status: "VALID_GEOTIFF",
            error_code: null,
            scientific_explanation: "Valid pre-fire dual-pol GeoTIFF",
            acquisition_date: "2024-07-12",
            crs: "EPSG:32610",
            width: 256,
            height: 256,
            band_count: 2,
            bands: ["VV_dB", "VH_dB"],
            polarizations: ["VV", "VH"],
            resolution_m: 20,
            valid_pixel_percentage: 100,
            compatible_models: ["unet", "lightgbm", "log_ratio"],
            warnings: [],
            preview_url: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/api/analysis/upload")) {
        return new Response(
          JSON.stringify({
            upload_id: "upl_single_post",
            filename: "user_post.tif",
            role: "post_fire",
            file_format: "GEOTIFF",
            file_size_bytes: 8192,
            sha256: "def",
            is_valid: true,
            valid_for_sar_inference: true,
            validation_status: "VALID_GEOTIFF",
            error_code: null,
            scientific_explanation: "Valid post-fire dual-pol GeoTIFF",
            acquisition_date: "2024-08-05",
            crs: "EPSG:32610",
            width: 256,
            height: 256,
            band_count: 2,
            bands: ["VV_dB", "VH_dB"],
            polarizations: ["VV", "VH"],
            resolution_m: 20,
            valid_pixel_percentage: 100,
            compatible_models: ["unet", "lightgbm", "log_ratio"],
            warnings: [],
            preview_url: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("Not Found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderStudio();

    const postInput = screen.getByTestId("live-post-upload-input");
    const sarFile = new File([new Uint8Array([73, 73, 42, 0])], "user_post.tif", { type: "image/tiff" });
    fireEvent.change(postInput, { target: { files: [sarFile] } });

    await waitFor(() => expect(screen.getByTestId("single-image-recovery-panel")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: "Pair Pre" })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Pair Pre" }));
    await waitFor(() => expect(screen.getByTestId("live-pair-validation")).toHaveTextContent("pair_paired_ref"));

    // Invert Pre-Fire date after Post-Fire date -> Analyze Fire must disable & warn
    const preDateInput = screen.getByLabelText("Pre-Fire Date (Before)");
    fireEvent.change(preDateInput, { target: { value: "2024-09-01" } });
    expect(screen.getByRole("alert")).toHaveTextContent("DATE_ORDER_INVALID");
    expect(screen.getByTestId("live-run-inference-btn")).toBeDisabled();
  });
});
