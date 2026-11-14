"""FastAPI Application Entry Point for Astera Watch Wildfire Platform."""

from __future__ import annotations

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.endpoints import router as api_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("AsteraApp")

app = FastAPI(
    title="Astera Watch API",
    description=(
        "NISAR-ready wildfire surface-change and burned-area platform. "
        "Current results use Sentinel-1 C-band with Sentinel-2 reference labels."
    ),
    version="2.0.0",
)

# CORS configuration per .env.example
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
def root_health():
    return {
        "status": "ONLINE",
        "service": "Astera Watch Wildfire Intelligence API",
        "version": "2.0.0",
        "nisar_mode": "DISCOVERED_BLOCKED_AUTH",
        "data_origin": "CROSS_SENSOR_PROTOTYPE",
        "is_nisar": False,
        "project_maturity_status": {
            "CROSS_SENSOR_PROTOTYPE": True,
            "NISAR_DATA_DISCOVERED": True,
            "NISAR_PREPROCESSING_VALIDATED": True,
            "NISAR_DATA_ACQUIRED": False,
            "NISAR_CHANGE_ANALYSIS_COMPLETED": False,
            "NISAR_MODEL_EVALUATED": False,
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
