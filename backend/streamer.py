"""
streamer.py
===========
Frame processing pipeline:
  CameraHandler → CraterDetector → JPEG encoder → multipart stream

The Streamer runs the full pipeline and exposes:
  - generate_frames()  → async generator for FastAPI StreamingResponse
  - get_latest_stats() → dict with current detection stats
"""

import cv2
import time
import asyncio
import logging
from typing import AsyncGenerator

from camera_handler import CameraHandler
from detector import CraterDetector, Detection

logger = logging.getLogger(__name__)


class Streamer:
    """
    Connects CameraHandler → CraterDetector → JPEG stream.

    Pipeline per frame:
      1. Capture frame from camera
      2. Optionally resize for speed
      3. Run YOLO inference
      4. Encode to JPEG
      5. Yield as multipart chunk
    """

    def __init__(
        self,
        camera:           CameraHandler,
        detector:         CraterDetector,
        jpeg_quality:     int   = 75,
        process_width:    int   = 0,    # 0 = no resize before inference
        process_height:   int   = 0,
        detect_every_n:   int   = 1,   # run YOLO on every Nth frame (1 = every frame)
    ):
        self.camera          = camera
        self.detector        = detector
        self.jpeg_quality    = jpeg_quality
        self.process_width   = process_width
        self.process_height  = process_height
        self.detect_every_n  = max(1, detect_every_n)

        # Stats
        self._crater_count  = 0
        self._fps_actual    = 0.0
        self._last_detections: list[Detection] = []
        self._frame_count   = 0
        # Rolling FPS window (last 30 frame timestamps)
        self._frame_times: list[float] = []

    # ── Public API ─────────────────────────────────────────────────────────────

    async def generate_frames(self) -> AsyncGenerator[bytes, None]:
        """
        Async generator that yields multipart JPEG chunks.
        Used directly by FastAPI StreamingResponse.

        Zero-latency design:
          - No artificial FPS throttle — pushes frames as fast as captured.
          - asyncio.sleep(0) yields event loop control without sleeping.
          - YOLO runs every detect_every_n frames; last detections reused between.
          - Rolling 30-frame window for accurate live FPS display.
        """
        self.camera.add_client()
        last_frame_id = -1        # last seen frame_id from camera
        detect_tick = 0
        last_detections: list[Detection] = []
        last_annotated = None
        try:
            while True:
                # Get latest frame — never block, never sleep waiting for camera
                frame_id, frame = self.camera.get_frame()

                if frame is None:
                    # Camera not ready — show placeholder and yield control
                    placeholder = self._make_placeholder()
                    chunk = self._encode(placeholder)
                    if chunk:
                        yield self._wrap_multipart(chunk)
                    await asyncio.sleep(0.05)   # 50 ms poll when no camera
                    continue

                # Skip duplicate frames (camera hasn't produced a new one yet)
                if frame_id == last_frame_id:
                    await asyncio.sleep(0)       # yield event loop, try again immediately
                    continue
                last_frame_id = frame_id

                detect_tick += 1

                if detect_tick >= self.detect_every_n:
                    detect_tick = 0
                    # Resize only for inference, stream original-res frame
                    inference_frame = self._maybe_resize(frame)
                    try:
                        annotated, detections = self.detector.detect(inference_frame)
                        # Scale annotated back to original size if we resized
                        if self.process_width and self.process_height:
                            annotated = cv2.resize(
                                annotated,
                                (frame.shape[1], frame.shape[0]),
                                interpolation=cv2.INTER_LINEAR,
                            )
                        last_detections = detections
                        last_annotated  = annotated
                    except Exception as e:
                        logger.error(f"Detection error: {e}")
                        last_annotated  = frame
                        last_detections = []
                else:
                    # Reuse previous detections — draw them on the fresh frame to avoid stale/duplicate images
                    try:
                        annotated = self.detector.draw_detections(frame, last_detections)
                    except Exception as e:
                        logger.error(f"Failed to draw previous detections: {e}")
                        annotated = frame

                # Update rolling FPS
                now = time.time()
                self._frame_times.append(now)
                if len(self._frame_times) > 30:
                    self._frame_times.pop(0)
                if len(self._frame_times) >= 2:
                    span = self._frame_times[-1] - self._frame_times[0]
                    self._fps_actual = (len(self._frame_times) - 1) / span if span > 0 else 0.0

                self._crater_count    = len(last_detections)
                self._last_detections = last_detections
                self._frame_count    += 1

                # Encode and stream immediately
                chunk = self._encode(annotated)
                if chunk:
                    yield self._wrap_multipart(chunk)

                # Yield event loop after each frame — never block
                await asyncio.sleep(0)
        finally:
            self.camera.remove_client()

    def get_latest_stats(self) -> dict:
        """Returns current detection stats for the /stats endpoint."""
        return {
            "crater_count":  self._crater_count,
            "fps":           round(self._fps_actual, 1),
            "frame_count":   self._frame_count,
            "camera_ok":     self.camera.is_connected(),
            "camera_error":  self.camera.get_error(),
            "detections": [
                {
                    "x1":         round(d.x1, 1),
                    "y1":         round(d.y1, 1),
                    "x2":         round(d.x2, 1),
                    "y2":         round(d.y2, 1),
                    "confidence": round(d.confidence, 3),
                    "label":      d.label,
                }
                for d in self._last_detections
            ],
        }

    # ── Internal ───────────────────────────────────────────────────────────────

    def _encode(self, frame) -> bytes | None:
        """Encode numpy frame to JPEG bytes."""
        try:
            ok, buf = cv2.imencode(
                ".jpg", frame,
                [cv2.IMWRITE_JPEG_QUALITY, self.jpeg_quality]
            )
            return buf.tobytes() if ok else None
        except Exception as e:
            logger.error(f"JPEG encode error: {e}")
            return None

    def _wrap_multipart(self, jpeg_bytes: bytes) -> bytes:
        """Wrap JPEG bytes in multipart/x-mixed-replace boundary."""
        return (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n"
            + jpeg_bytes
            + b"\r\n"
        )

    def _maybe_resize(self, frame):
        """Resize frame before inference if target dimensions set."""
        if self.process_width and self.process_height:
            return cv2.resize(
                frame,
                (self.process_width, self.process_height),
                interpolation=cv2.INTER_LINEAR
            )
        return frame

    def _make_placeholder(self):
        """Black placeholder frame shown when camera is not connected."""
        import numpy as np
        ph = np.zeros((480, 640, 3), dtype=np.uint8)
        font = cv2.FONT_HERSHEY_SIMPLEX
        cv2.putText(ph, "CAMERA NOT CONNECTED",
                    (90, 220), font, 0.9, (0, 200, 255), 2, cv2.LINE_AA)
        cv2.putText(ph, "Waiting for signal...",
                    (140, 265), font, 0.6, (80, 120, 140), 1, cv2.LINE_AA)
        # Corner brackets
        for (bx,by) in [(0,0),(640,0),(0,480),(640,480)]:
            dx = 30 if bx==0 else -30
            dy = 30 if by==0 else -30
            cv2.line(ph,(bx,by),(bx+dx,by),(0,200,255),2)
            cv2.line(ph,(bx,by),(bx,by+dy),(0,200,255),2)
        return ph
