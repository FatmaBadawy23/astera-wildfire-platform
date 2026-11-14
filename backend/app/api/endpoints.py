"""API Endpoints for Astera Watch Wildfire Platform."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

from backend.app.schemas.api_schemas import (
    AnalysisResultResponse,
    AnalysisRunRequest,
    FireEventSchema,
    HealthResponse,
    SampleUploadRequest,
    ValidatePairRequest,
)
from backend.app.services.analysis_service import AnalysisService
from backend.app.services.inference_service import InferenceService
from backend.app.services.upload_service import UploadValidationService

router = APIRouter()
analysis_service = AnalysisService()
upload_service = UploadValidationService()
inference_service = InferenceService(upload_service=upload_service)


@router.get("/health", response_model=HealthResponse)
def health_check():
    status_dict = analysis_service.get_health_status()
    return HealthResponse(**status_dict)


@router.get("/events", response_model=List[FireEventSchema])
def list_fire_events(include_excluded: bool = Query(default=False)):
    return analysis_service.list_events(include_excluded=include_excluded)


@router.get("/events/{event_id}", response_model=FireEventSchema)
def get_fire_event(event_id: str, allow_excluded: bool = Query(default=False)):
    ev = analysis_service.get_event(event_id, allow_excluded=allow_excluded)
    if not ev:
        raise HTTPException(status_code=404, detail=f"Fire event {event_id} not found.")
    return ev


@router.get("/events/{event_id}/analysis")
def get_event_unified_analysis(event_id: str) -> Dict[str, Any]:
    try:
        return analysis_service.get_event_analysis(event_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/events/{event_id}/before-after")
def get_event_before_after(event_id: str) -> Dict[str, Any]:
    try:
        return analysis_service.get_before_after_analysis(event_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/events/{event_id}/products")
def get_event_products(event_id: str) -> Dict[str, Any]:
    try:
        return analysis_service.get_event_geospatial_products(event_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/events/{event_id}/validation")
def get_event_validation(event_id: str) -> Dict[str, Any]:
    try:
        return analysis_service.get_event_independent_validation(event_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/events/{event_id}/firms")
def get_event_firms_hotspots(event_id: str) -> Dict[str, Any]:
    try:
        return analysis_service.get_event_firms_hotspots(event_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/events/{event_id}/geojson")
def get_event_geojson(event_id: str) -> Dict[str, Any]:
    try:
        return analysis_service.get_event_geojson(event_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/events/{event_id}/rasters")
def get_event_rasters(event_id: str) -> Dict[str, Any]:
    try:
        return analysis_service.get_event_rasters(event_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/events/{event_id}/layers/{layer_key}.png")
def get_event_layer_png(event_id: str, layer_key: str):
    try:
        png_path = analysis_service.resolve_event_layer_png_path(event_id, layer_key)
        return FileResponse(png_path, media_type="image/png")
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/events/{event_id}/overview.png")
def get_event_overview_png(event_id: str):
    try:
        png_path = analysis_service.resolve_event_overview_png_path(event_id)
        return FileResponse(png_path, media_type="image/png")
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/nisar/candidates")
def get_nisar_candidates() -> Dict[str, Any]:
    return analysis_service.get_nisar_candidates_report()


@router.get("/nisar/status")
def get_nisar_status() -> Dict[str, Any]:
    return analysis_service.get_nisar_status()


@router.get("/dataset/stats")
def get_dataset_stats() -> Dict[str, Any]:
    return analysis_service.get_dataset_stats()


@router.get("/runs/latest")
def get_latest_versioned_run() -> Dict[str, Any]:
    return analysis_service.get_latest_versioned_run_report()


@router.get("/models/available")
def get_available_models() -> Dict[str, Any]:
    return inference_service.get_available_models()


@router.get("/analysis/samples")
def list_sample_uploads() -> Dict[str, Any]:
    return {
        "samples": upload_service.list_sample_files(),
        "data_origin": "CROSS_SENSOR_PROTOTYPE",
        "is_nisar": False,
    }


@router.get("/analysis/reference-candidates")
def list_reference_candidates(
    upload_id: Optional[str] = Query(default=None),
    role_needed: Optional[str] = Query(default=None),
) -> Dict[str, Any]:
    try:
        candidates = upload_service.list_compatible_references(
            upload_id=upload_id,
            role_needed=role_needed,
        )
        return {
            "upload_id": upload_id,
            "role_needed": role_needed,
            "candidates": candidates,
        }
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analysis/upload")
async def upload_satellite_file(
    file: UploadFile = File(...),
    role: str = Form(default="auto"),
    acquisition_date: Optional[str] = Form(default=None),
    sensor_hint: Optional[str] = Form(default=None),
) -> Dict[str, Any]:
    try:
        content = await file.read()
        return upload_service.validate_and_store_upload(
            filename=file.filename or "uploaded_raster.tif",
            content=content,
            role=role,
            sensor_hint=sensor_hint,
            acquisition_date=acquisition_date,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analysis/upload-sample")
def upload_sample_file(req: SampleUploadRequest) -> Dict[str, Any]:
    try:
        file_path = req.file_path
        role = req.role
        acquisition_date = req.acquisition_date
        if not file_path and req.sample_id:
            samples = upload_service.list_sample_files()
            match = next((s for s in samples if s["sample_id"] == req.sample_id), None)
            if not match:
                raise KeyError(f"Sample ID '{req.sample_id}' not found.")
            if role in ("post", "post_fire"):
                file_path = match["post_file"]
                acquisition_date = acquisition_date or match.get("post_date")
            else:
                file_path = match["pre_file"]
                acquisition_date = acquisition_date or match.get("pre_date")
        if not file_path:
            raise ValueError("Either sample_id or file_path must be provided.")
        return upload_service.register_local_sample_file(
            rel_path=file_path,
            role=role,
            acquisition_date=acquisition_date,
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/analysis/uploads")
def list_uploaded_files() -> Dict[str, Any]:
    return {"uploads": upload_service.list_uploads()}


@router.get("/analysis/uploads/{upload_id}")
def get_uploaded_file_metadata(upload_id: str) -> Dict[str, Any]:
    try:
        return upload_service.get_upload_metadata(upload_id)
    except (FileNotFoundError, KeyError) as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/analysis/uploads/{upload_id}/preview.png")
def get_uploaded_file_preview(upload_id: str):
    try:
        preview_path = upload_service.get_upload_preview_path(upload_id)
        return FileResponse(preview_path, media_type="image/png")
    except (FileNotFoundError, KeyError) as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/analysis/validate-pair")
def validate_before_after_pair(req: ValidatePairRequest) -> Dict[str, Any]:
    try:
        return upload_service.validate_and_align_pair(
            pre_upload_id=req.pre_upload_id,
            post_upload_id=req.post_upload_id,
            auto_coregister=req.auto_coregister,
            pre_date=req.pre_date,
            post_date=req.post_date,
            area_name=req.area_name,
        )
    except (FileNotFoundError, KeyError) as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/analysis/run")
def trigger_analysis(req: AnalysisRunRequest) -> Dict[str, Any]:
    try:
        pair_id = req.pair_id
        if not pair_id and req.pre_upload_id and req.post_upload_id:
            pair_report = upload_service.validate_and_align_pair(
                pre_upload_id=req.pre_upload_id,
                post_upload_id=req.post_upload_id,
                auto_coregister=True,
                pre_date=req.pre_date,
                post_date=req.post_date,
                area_name=req.area_name,
            )
            if not pair_report.get("compatible"):
                raise ValueError(
                    "Before/After pair incompatible: " + "; ".join(pair_report.get("reasons", []))
                )
            pair_id = pair_report["pair_id"]

        use_live_engine = bool(
            pair_id or req.upload_id or req.live_inference
        )

        if use_live_engine:
            threshold_val = req.threshold if req.threshold is not None else req.threshold_db
            live_res = inference_service.analyze(
                model_type=req.model_type,
                event_id=req.event_id,
                upload_id=req.upload_id,
                pair_id=pair_id,
                threshold=threshold_val,
                run_all_models=req.run_all_models,
            )
            if req.event_id and not pair_id and not req.upload_id:
                try:
                    catalog_res = analysis_service.run_analysis(
                        event_id=req.event_id,
                        model_type=req.model_type,
                        polarization=req.polarization,
                        threshold_db=req.threshold_db,
                    )
                    live_res["provenance"] = catalog_res.get("provenance")
                    live_res["uncertainty"] = catalog_res.get("uncertainty")
                    live_res["caveats"] = catalog_res.get("caveats")
                except Exception:
                    pass
            return live_res

        if not req.event_id:
            raise ValueError("Provide event_id, pair_id, pre_upload_id+post_upload_id, or upload_id.")

        res = analysis_service.run_analysis(
            event_id=req.event_id,
            model_type=req.model_type,
            polarization=req.polarization,
            threshold_db=req.threshold_db,
        )
        return res
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analysis/history")
def list_analysis_history() -> Dict[str, Any]:
    return {"runs": inference_service.list_history()}


@router.get("/analysis/jobs/{job_id}")
def get_analysis_job_status(job_id: str) -> Dict[str, Any]:
    try:
        res = inference_service.get_result(job_id)
        return {
            "job_id": job_id,
            "analysis_id": res.get("analysis_id", job_id),
            "status": res.get("status", "COMPLETED"),
            "execution_time_sec": res.get("execution_time_sec", 0.0),
            "model_type": res.get("model_type"),
            "model_name": res.get("model_name"),
            "result": res,
        }
    except (FileNotFoundError, KeyError):
        res = analysis_service.get_job_results(job_id)
        if not res:
            raise HTTPException(status_code=404, detail=f"Job ID {job_id} not found.")
        return res


@router.get("/analysis/results/{analysis_id}")
def get_live_analysis_result(analysis_id: str) -> Dict[str, Any]:
    try:
        return inference_service.get_result(analysis_id)
    except (FileNotFoundError, KeyError):
        res = analysis_service.get_job_results(analysis_id)
        if not res:
            raise HTTPException(status_code=404, detail=f"Analysis ID {analysis_id} not found.")
        return res


@router.get("/analysis/{job_id}/results")
def get_analysis_results(job_id: str) -> Dict[str, Any]:
    try:
        return inference_service.get_result(job_id)
    except (FileNotFoundError, KeyError):
        res = analysis_service.get_job_results(job_id)
        if not res:
            raise HTTPException(status_code=404, detail=f"Job ID {job_id} not found.")
        return res


@router.get("/analysis/results/{analysis_id}/overview.png")
def get_analysis_overview_png(analysis_id: str):
    try:
        png_path = inference_service.get_layer_file(analysis_id, "overview")
        return FileResponse(png_path, media_type="image/png")
    except (FileNotFoundError, KeyError) as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/analysis/results/{analysis_id}/layers/{layer_name:path}")
def get_analysis_layer_png(analysis_id: str, layer_name: str):
    try:
        png_path = inference_service.get_layer_file(analysis_id, layer_name)
        return FileResponse(png_path, media_type="image/png")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except (FileNotFoundError, KeyError) as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/analysis/results/{analysis_id}/geotiff/{filename}")
def get_analysis_geotiff(analysis_id: str, filename: str):
    try:
        tif_path = inference_service.get_geotiff_file(analysis_id, filename)
        return FileResponse(tif_path, media_type="image/tiff", filename=filename)
    except (FileNotFoundError, KeyError) as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/analysis/results/{analysis_id}/geojson/burned_polygons.geojson")
def get_analysis_geojson(analysis_id: str) -> Dict[str, Any]:
    try:
        return inference_service.get_geojson_file(analysis_id)
    except (FileNotFoundError, KeyError) as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/models/comparison")
def get_model_comparison():
    return analysis_service.get_model_comparison_report()


@router.get("/metrics")
def get_metrics_alias():
    return analysis_service.get_model_comparison_report()
