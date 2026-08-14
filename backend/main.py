"""
main.py — Lunar Crater Detection System — FastAPI Backend
==========================================================

Endpoints:
  GET  /                          Health check
  GET  /health                    JSON health + model status
  GET  /cameras                   List available local cameras
  GET  /video-feed                Live MJPEG stream (multipart)
  POST /switch-camera             Switch camera source at runtime
  GET  /stats                     Current detection stats (JSON)
  POST /detect-image              Analyse a single uploaded image
  POST /conf                      Update confidence threshold

Run:
    pip install fastapi uvicorn ultralytics opencv-python numpy python-multipart torch
    python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001

Stream URL:
    http://localhost:8001/video-feed

Frontend:
    <img src="http://localhost:8001/video-feed" />
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import numpy as np
import cv2
import base64
from datetime import datetime, timezone

from camera_handler import CameraHandler, list_available_cameras, setup_adb_port_forward
from detector import CraterDetector
from streamer import Streamer

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
MODEL_PATH      = os.path.join(os.path.dirname(os.path.abspath(__file__)), "weights", "best.pt")
CONF_THRESHOLD  = 0.40          # slightly lower threshold for faster match exit
IOU_THRESHOLD   = 0.45
JPEG_QUALITY    = 50            # lower = faster encode + transfer (quality still acceptable)
DEFAULT_CAMERA  = 0            # 0 = default webcam

# ── Global singletons (initialised in lifespan) ───────────────────────────────
camera:   CameraHandler  = None
detector: CraterDetector = None
streamer: Streamer       = None


# ── Lifespan: startup / shutdown ──────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global camera, detector, streamer

    # Initialize camera in standby mode (lazy-loaded on live video stream subscription)
    logger.info(f"Initializing camera source in standby: {DEFAULT_CAMERA}")
    camera = CameraHandler(source=DEFAULT_CAMERA, width=640, height=480, fps=30)

    # Load YOLO model
    logger.info(f"Loading model: {MODEL_PATH}")
    detector = CraterDetector(
        model_path      = MODEL_PATH,
        conf_threshold  = CONF_THRESHOLD,
        iou_threshold   = IOU_THRESHOLD,
        imgsz           = 416,   # smaller = faster inference, minimal accuracy loss
    )

    # Build streamer — zero-throttle, max frame rate
    streamer = Streamer(
        camera          = camera,
        detector        = detector,
        jpeg_quality    = JPEG_QUALITY,
        detect_every_n  = 2,   # YOLO every 2nd frame; stream every frame → smooth + fast
    )

    logger.info("✅ System ready")
    yield

    # Shutdown
    logger.info("Shutting down...")
    camera.stop()


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title       = "Lunar Crater Detection System",
    version     = "2.0.0",
    description = "Real-time crater detection via YOLO + live video streaming",
    lifespan    = lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══════════════════════════════════════════════════════════════════════════════
# ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/")
def root():
    return {
        "service":    "Lunar Crater Detection System",
        "version":    "2.0.0",
        "stream_url": "GET /video-feed",
        "docs":       "GET /docs",
    }


@app.get("/health")
def health():
    return {
        "status":         "ok",
        "model_loaded":   detector is not None,
        "camera_ok":      camera.is_connected() if camera else False,
        "camera_source":  str(camera.source)    if camera else None,
        "camera_error":   camera.get_error()    if camera else None,
        "timestamp":      datetime.now(timezone.utc).isoformat(),
    }


@app.get("/cameras")
def get_cameras():
    """List all available local camera indices."""
    available = list_available_cameras(max_index=6)
    return {
        "available": available,
        "current":   camera.source if camera else None,
        "note": "For IP cameras use POST /switch-camera with a URL string",
    }


@app.get("/video-feed")
async def video_feed():
    """
    Live MJPEG stream — annotated frames with YOLO bounding boxes.

    Use in frontend:
        <img src="http://localhost:8001/video-feed" />

    Supports:
        - Browser direct (Chrome, Firefox)
        - <img> tag in React
        - VLC: open network stream → http://localhost:8001/video-feed
    """
    if streamer is None:
        raise HTTPException(status_code=503, detail="Streamer not ready")

    return StreamingResponse(
        streamer.generate_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control":               "no-cache, no-store, must-revalidate",
            "Pragma":                      "no-cache",
            "Expires":                     "0",
            "Access-Control-Allow-Origin": "*",
        },
    )


@app.post("/switch-camera")
def switch_camera(body: dict = Body(...)):
    """
    Switch camera source at runtime without restarting the server.

    Body examples:
        {"source": 0}                                    → default webcam
        {"source": 1}                                    → USB external camera
        {"source": "http://192.168.1.x:8080/video"}     → DroidCam
        {"source": "http://192.168.1.x:4747/video"}     → IP Webcam Android
        {"source": "rtsp://user:pass@192.168.1.x:554/stream1"} → RTSP
    """
    source = body.get("source")
    if source is None:
        raise HTTPException(status_code=422, detail="'source' field required")

    # Convert numeric strings to int
    try:
        source = int(source)
    except (ValueError, TypeError):
        pass  # keep as string (URL)

    if camera is None:
        raise HTTPException(status_code=503, detail="Camera handler is not initialized")

    camera.switch_source(source)
    return {
        "status":     "switched",
        "new_source": str(source),
        "message":    "Camera will reconnect automatically",
    }


@app.get("/stats")
def get_stats():
    """
    Current detection stats — poll this from frontend for live numbers.
    Returns crater count, FPS, bounding box list.
    """
    if streamer is None:
        raise HTTPException(status_code=503, detail="Streamer not ready")
    return streamer.get_latest_stats()


@app.post("/conf")
def update_conf(body: dict = Body(...)):
    """Dynamically update detection confidence threshold (0.1–0.99)."""
    conf = body.get("conf")
    if conf is None:
        raise HTTPException(status_code=422, detail="'conf' field required")
    detector.update_conf(float(conf))
    return {"status": "ok", "conf": detector.conf_threshold}


@app.post("/detect-image")
async def detect_image(file: UploadFile = File(...)):
    """
    Analyse a single uploaded image (not live stream).
    Returns crater count, LSI, zone, annotated image as base64.
    Compatible with the existing React upload workflow.
    """
    allowed = {"image/jpeg","image/png","image/tiff","image/webp","image/bmp"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=422, detail=f"Unsupported type: {file.content_type}")

    contents = await file.read()
    nparr    = np.frombuffer(contents, np.uint8)
    image    = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if image is None:
        raise HTTPException(status_code=422, detail="Cannot decode image")

    annotated, detections = detector.detect(image)
    crater_count = len(detections)

    # Encode annotated image
    annotated_b64 = None
    ok, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 85])
    if ok:
        annotated_b64 = base64.b64encode(buf).decode("utf-8")

    # Compute LSI
    lsi  = round(max(0.0, min(100.0, 100.0 - crater_count * 10.0)), 2)
    zone = "SAFE" if lsi > 70 else "RISKY" if lsi > 40 else "UNSAFE"

    logger.info(f"detect-image: '{file.filename}' → craters={crater_count}, LSI={lsi}, zone={zone}")

    return {
        "crater_count":  crater_count,
        "craters":       crater_count,
        "lsi":           lsi,
        "zone":          zone,
        "annotated_b64": annotated_b64,
        "slope":         None,
        "roughness":     None,
        "elevation":     None,
        "latitude":      None,
        "longitude":     None,
        "filename":      file.filename,
        "timestamp":     datetime.now(timezone.utc).isoformat(),
        "modules_ready": {
            "crater_detection": True,
            "slope":            False,
            "roughness":        False,
            "elevation":        False,
            "gps":              False,
        },
        "detections": [
            {"x1":round(d.x1,1),"y1":round(d.y1,1),
             "x2":round(d.x2,1),"y2":round(d.y2,1),
             "confidence":round(d.confidence,3),"label":d.label}
            for d in detections
        ],
    }


@app.post("/setup-adb")
def setup_adb(body: dict = Body(default={})):
    """
    Configure ADB port forwarding for DroidCam USB connection.
    Body format (optional):
        {"port": 4747}
    """
    port = body.get("port", 4747)
    try:
        port = int(port)
    except (ValueError, TypeError):
        port = 4747

    logger.info(f"Setting up ADB port forwarding on port {port}...")
    res = setup_adb_port_forward(port)
    if not res.get("success", False):
        raise HTTPException(
            status_code=500,
            detail={
                "error": res.get("error", "ADB failed"),
                "message": res.get("message", "ADB failed to setup.")
            }
        )
    return res

