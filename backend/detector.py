"""
detector.py
===========
YOLO-based crater detector.
Runs inference on a single frame and returns:
  - annotated frame (BGR numpy array)
  - list of detected craters with boxes + confidence

Automatically uses GPU (CUDA) if available, else CPU.
"""

import cv2
import numpy as np
import torch
import logging
from dataclasses import dataclass
from ultralytics import YOLO

logger = logging.getLogger(__name__)


@dataclass
class Detection:
    """Single crater detection result."""
    x1: float
    y1: float
    x2: float
    y2: float
    confidence: float
    class_id: int
    label: str

    @property
    def width(self)  -> float: return self.x2 - self.x1
    @property
    def height(self) -> float: return self.y2 - self.y1
    @property
    def area(self)   -> float: return self.width * self.height
    @property
    def center(self) -> tuple: return ((self.x1+self.x2)/2, (self.y1+self.y2)/2)


class CraterDetector:
    """
    Wraps a YOLO model for crater detection.

    Usage:
        detector = CraterDetector("runs/detect/train/weights/best.pt")
        annotated_frame, detections = detector.detect(frame)
    """

    def __init__(
        self,
        model_path: str,
        conf_threshold: float = 0.45,
        iou_threshold:  float = 0.45,
        imgsz:          int   = 640,
        max_det:        int   = 100,
    ):
        self.conf_threshold = conf_threshold
        self.iou_threshold  = iou_threshold
        self.imgsz          = imgsz
        self.max_det        = max_det

        # Detect device
        if torch.cuda.is_available():
            self.device = "cuda"
            logger.info(f"GPU detected: {torch.cuda.get_device_name(0)}")
        else:
            self.device = "cpu"
            logger.info("No GPU found — using CPU")

        # Load model
        logger.info(f"Loading YOLO model from: {model_path}")
        try:
            self.model = YOLO(model_path)
            self.model.to(self.device)
            # Warmup pass to initialise kernels
            dummy = np.zeros((640, 640, 3), dtype=np.uint8)
            try:
                self.model.predict(dummy, verbose=False)
                logger.info(f"✅ YOLO model loaded and warmed up on {self.device}")
            except RuntimeError as re:
                if self.device == "cuda":
                    logger.warning(
                        f"⚠️ CUDA warmup failed: {re}. "
                        "This usually means your NVIDIA graphics driver (installed version: 537.53) "
                        "is older than the minimum required version (551.61+) for PyTorch CUDA 12.4.\n"
                        "💡 To enable full GPU acceleration: Please update your NVIDIA graphics driver to the latest "
                        "Game Ready / Studio Driver version from GeForce Experience or nvidia.com.\n"
                        "🔄 Automatically falling back to CPU for now so the app remains fully functional!"
                    )
                    self.device = "cpu"
                    self.model.to("cpu")
                    self.model.predict(dummy, verbose=False)
                    logger.info("✅ YOLO model successfully fell back and warmed up on CPU")
                else:
                    raise
        except Exception as e:
            logger.error(f"❌ Failed to load model: {e}")
            raise

    # ── Public API ─────────────────────────────────────────────────────────────

    def detect(self, frame: np.ndarray) -> tuple[np.ndarray, list[Detection]]:
        """
        Run YOLO inference on a BGR frame.

        Returns:
            annotated_frame: BGR frame with bounding boxes drawn
            detections:      list of Detection objects
        """
        if frame is None:
            return frame, []

        results = self.model.predict(
            source          = frame,
            conf            = self.conf_threshold,
            iou             = self.iou_threshold,
            imgsz           = self.imgsz,
            max_det         = self.max_det,
            device          = self.device,
            half            = (self.device == "cuda"),
            verbose         = False,
        )

        detections      = self._parse_results(results)
        annotated_frame = self._draw_detections(frame.copy(), detections)

        return annotated_frame, detections

    def update_conf(self, conf: float):
        """Dynamically update confidence threshold."""
        self.conf_threshold = max(0.1, min(0.99, conf))
        logger.info(f"Confidence threshold updated: {self.conf_threshold}")

    def draw_detections(self, frame: np.ndarray, detections: list[Detection]) -> np.ndarray:
        """Draw detections on a given frame and return the annotated frame."""
        return self._draw_detections(frame.copy(), detections)

    # ── Internal ───────────────────────────────────────────────────────────────

    def _parse_results(self, results) -> list[Detection]:
        """Extract Detection objects from YOLO results."""
        detections = []
        names      = results[0].names if results else {}

        for box in results[0].boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            conf    = float(box.conf[0])
            cls_id  = int(box.cls[0])
            label   = names.get(cls_id, f"class_{cls_id}")
            detections.append(Detection(x1, y1, x2, y2, conf, cls_id, label))

        return detections

    def _draw_detections(
        self,
        frame: np.ndarray,
        detections: list[Detection],
    ) -> np.ndarray:
        """
        Draw bounding boxes, labels, confidence scores
        and a HUD overlay on the frame.
        """
        h, w = frame.shape[:2]

        # ── HUD overlay ──────────────────────────────────────────────────────
        # Corner brackets
        bracket_len = 30
        bracket_color = (0, 229, 255)   # cyan
        thickness = 2
        for (bx, by) in [(0,0),(w,0),(0,h),(w,h)]:
            dx = bracket_len if bx == 0 else -bracket_len
            dy = bracket_len if by == 0 else -bracket_len
            cv2.line(frame, (bx, by), (bx+dx, by), bracket_color, thickness)
            cv2.line(frame, (bx, by), (bx, by+dy), bracket_color, thickness)

        # Centre crosshair
        cx, cy = w//2, h//2
        cv2.line(frame, (cx-40, cy), (cx-12, cy), bracket_color, 1)
        cv2.line(frame, (cx+12, cy), (cx+40, cy), bracket_color, 1)
        cv2.line(frame, (cx, cy-40), (cx, cy-12), bracket_color, 1)
        cv2.line(frame, (cx, cy+12), (cx, cy+40), bracket_color, 1)
        cv2.circle(frame, (cx, cy), 20, (0, 229, 255, 80), 1)

        # ── Bounding boxes ────────────────────────────────────────────────────
        for det in detections:
            # Clip coordinates to image boundaries to prevent negative indexing or out-of-bounds slice errors
            x1 = max(0, min(w - 1, int(det.x1)))
            y1 = max(0, min(h - 1, int(det.y1)))
            x2 = max(0, min(w - 1, int(det.x2)))
            y2 = max(0, min(h - 1, int(det.y2)))
            conf_pct = int(det.confidence * 100)

            # Zone colour by confidence
            if det.confidence >= 0.75:
                color = (0, 255, 136)    # green — high confidence
            elif det.confidence >= 0.5:
                color = (0, 204, 255)    # cyan  — medium
            else:
                color = (0, 130, 255)    # orange-ish — low

            # Box fill
            sub = frame[y1:y2, x1:x2]
            if sub.size > 0:
                white_rect = np.ones_like(sub) * 255
                cv2.addWeighted(sub, 0.85, white_rect, 0.05, 0, sub)

            # Main box
            cv2.rectangle(frame, (x1,y1), (x2,y2), color, 2)

            # Corner accents on the box
            cs = 10
            for (bx,by) in [(x1,y1),(x2,y1),(x1,y2),(x2,y2)]:
                ddx = cs if bx==x1 else -cs
                ddy = cs if by==y1 else -cs
                cv2.line(frame, (bx,by), (bx+ddx,by), (255,255,255), 2)
                cv2.line(frame, (bx,by), (bx,by+ddy), (255,255,255), 2)

            # Label pill
            label_text = f"CRATER {conf_pct}%"
            font       = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.45
            thick      = 1
            (tw, th), _ = cv2.getTextSize(label_text, font, font_scale, thick)
            lx = x1
            ly = max(y1 - 22, 0)
            cv2.rectangle(frame, (lx, ly), (lx+tw+10, ly+th+8), color, -1)
            cv2.putText(frame, label_text, (lx+5, ly+th+4),
                        font, font_scale, (0,0,0), thick, cv2.LINE_AA)

        # ── Info panel bottom-left ────────────────────────────────────────────
        panel_h = 60
        panel   = frame[h-panel_h:h, 0:320].copy()
        cv2.rectangle(frame, (0, h-panel_h), (320, h), (0,0,0), -1)
        cv2.addWeighted(panel, 0.3, frame[h-panel_h:h, 0:320], 0.7, 0, frame[h-panel_h:h, 0:320])

        font   = cv2.FONT_HERSHEY_SIMPLEX
        color  = (0, 229, 255)
        cv2.putText(frame, f"CRATERS DETECTED: {len(detections)}",
                    (10, h-38), font, 0.5, color, 1, cv2.LINE_AA)
        cv2.putText(frame, f"LUNAR SAFETY SYSTEM  v1.0",
                    (10, h-14), font, 0.4, (100, 180, 200), 1, cv2.LINE_AA)

        # LIVE badge top-left
        cv2.rectangle(frame, (8, 8), (72, 28), (0, 0, 180), -1)
        cv2.putText(frame, "● LIVE", (12, 22),
                    font, 0.45, (255,255,255), 1, cv2.LINE_AA)

        return frame
