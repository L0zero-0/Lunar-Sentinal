"""
camera_handler.py
=================
Manages all camera sources:
  - Local webcam (index 0, 1, 2 ...)
  - External USB camera
  - IP camera (RTSP / HTTP)
  - Mobile camera (DroidCam / OBS virtual camera)

Usage:
    handler = CameraHandler(source=0)          # default webcam
    handler = CameraHandler(source=1)          # USB external camera
    handler = CameraHandler(source="rtsp://...") # IP camera
    handler = CameraHandler(source="http://192.168.1.x:8080/video")
"""

import cv2
import threading
import time
import logging
import os
import subprocess
import shutil
import numpy as np

logger = logging.getLogger(__name__)


class CameraHandler:
    """
    Thread-safe camera handler.
    Reads frames in a background thread so the main thread
    always gets the latest frame without blocking.
    """

    def __init__(
        self,
        source=0,
        width: int = 1280,
        height: int = 720,
        fps: int = 30,
        reconnect_delay: float = 2.0,
    ):
        self.source          = source
        self.width           = width
        self.height          = height
        self.fps             = fps
        self.reconnect_delay = reconnect_delay

        self._cap    = None
        self._frame  = None
        self._frame_id = 0          # monotonic counter — increments each new frame
        self._lock   = threading.Lock()
        self._lifecycle_lock = threading.Lock()
        self._running = False
        self._thread  = None
        self._connected = False
        self._error     = None
        self._source_type = None
        self._active_source = None
        self._client_count = 0
        self._standby = True

    # ── Public API ─────────────────────────────────────────────────────────────

    def add_client(self):
        """Register a client using the camera. Starts the camera on first client."""
        should_start = False
        with self._lock:
            self._client_count += 1
            logger.info(f"Camera client added. Active clients: {self._client_count}")
            if self._client_count == 1:
                should_start = True
        
        if should_start:
            self.start()

    def remove_client(self):
        """Deregister a client. Stops the camera when client count reaches 0."""
        should_stop = False
        with self._lock:
            self._client_count = max(0, self._client_count - 1)
            logger.info(f"Camera client removed. Active clients: {self._client_count}")
            if self._client_count == 0:
                should_stop = True
        
        if should_stop:
            self.stop()

    def start(self):
        """Start background capture thread."""
        with self._lifecycle_lock:
            if self._running:
                return
            self._running = True
            self._standby = False
            self._thread  = threading.Thread(target=self._capture_loop, daemon=True)
            self._thread.start()
            logger.info(f"CameraHandler started — source: {self.source}")

    def stop(self):
        """Stop capture thread and release camera."""
        with self._lifecycle_lock:
            if not self._running:
                return
            self._running = False
            if self._thread:
                try:
                    self._thread.join(timeout=3)
                except Exception:
                    pass
                self._thread = None
            self._release()
            self._standby = True
            logger.info("CameraHandler stopped and released hardware")

    def get_frame(self):
        """
        Returns (frame_id, frame) tuple.
        frame_id is a monotonic int; compare with last seen id to detect new frames.
        Returns (None, None) if no frame available.
        """
        with self._lock:
            if self._frame is None:
                return None, None
            return self._frame_id, self._frame.copy()

    def is_connected(self) -> bool:
        return self._connected or self._standby

    def get_error(self) -> str | None:
        return self._error

    def get_status(self) -> dict:
        return {
            "connected": self._connected,
            "source": self.source,
            "source_type": self._source_type,
            "width": self.width,
            "height": self.height,
            "fps": self.fps,
            "error": self._error,
        }

    def switch_source(self, source):
        """Switch to a different camera source at runtime."""
        logger.info(f"Switching camera source: {self.source} → {source}")
        self.source = source
        self._frame     = None
        # The background thread will detect self.source change, release, and reconnect safely.

    # ── Internal ───────────────────────────────────────────────────────────────

    def _open(self) -> bool:
        """Open the camera source. Returns True on success."""
        try:
            src = self.source
            if isinstance(src, str):
                src = src.strip()
                # Prepend http:// if it looks like an IP:Port but has no scheme
                if not src.startswith(("http://", "https://", "rtsp://")):
                    if ":" in src or "." in src:
                        src = "http://" + src
                
                # Auto-append /video path if it is an HTTP stream with an empty path
                if src.startswith(("http://", "https://")):
                    from urllib.parse import urlparse
                    try:
                        parsed = urlparse(src)
                        if parsed.path in ("", "/"):
                            src = src.rstrip("/") + "/video"
                    except Exception:
                        pass

            # Update the camera source with the sanitized URL
            self.source = src
            self._active_source = src

            is_rtsp = isinstance(src, str) and src.startswith("rtsp://")
            is_http = isinstance(src, str) and src.startswith("http://")
            is_local = isinstance(src, int)

            if is_http:
                # We use the custom direct zero-buffer MJPEG reader for HTTP.
                # To minimize latency, we don't open cv2.VideoCapture at all.
                self._source_type = "http"
                self._connected = False  # Defer setting to True until we successfully connect in _capture_mjpeg_loop
                self._error = None
                logger.info(f"Enabled direct low-latency MJPEG reader for source: {src}")
                return True

            if is_rtsp:
                # Force FFMPEG for RTSP streams with low latency flags
                if "?" not in src:
                    src_open = src + "?rtsp_transport=tcp&fflags=nobuffer&flags=low_delay"
                else:
                    src_open = src
                self._cap = cv2.VideoCapture(src_open, cv2.CAP_FFMPEG)
            else:
                # Local webcam or USB DroidCam virtual camera
                # Use default backend (MSMF) first for multi-threaded safety and fast startup, fallback to CAP_DSHOW
                if os.name == 'nt':
                    self._cap = cv2.VideoCapture(src)
                    if not self._cap.isOpened():
                        logger.warning(f"Failed to open camera index {src} with default MSMF backend. Falling back to DirectShow (CAP_DSHOW)...")
                        self._cap = cv2.VideoCapture(src, cv2.CAP_DSHOW)
                else:
                    self._cap = cv2.VideoCapture(src)

            if not self._cap.isOpened():
                self._error = f"Cannot open: {src}"
                self._standby = False
                logger.error(self._error)
                return False

            # Keep only the latest frame to reduce stale-frame latency.
            self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

            if is_local:
                # Let USB cameras use in-camera MJPEG compression when supported.
                self._cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter.fourcc('M', 'J', 'P', 'G'))

            self._cap.set(cv2.CAP_PROP_FRAME_WIDTH,  self.width)
            self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
            self._cap.set(cv2.CAP_PROP_FPS,          self.fps)

            self._connected  = True
            self._error      = None
            self._source_type = "local" if is_local else "rtsp"
            actual_w = int(self._cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            actual_h = int(self._cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            logger.info(f"Camera opened [{self._source_type}]: {src} [{actual_w}x{actual_h}]")
            return True

        except Exception as e:
            self._error = str(e)
            self._standby = False
            logger.error(f"Camera open error: {e}")
            return False

    def _release(self):
        if self._cap:
            try:
                self._cap.release()
            except Exception:
                pass
            self._cap = None
        self._connected = False
        self._source_type = None

    def _responsive_sleep(self, seconds: float) -> bool:
        """
        Sleeps for `seconds` in 100ms intervals.
        Returns True if the sleep completed fully, False if self._running became False.
        """
        start_time = time.time()
        while time.time() - start_time < seconds:
            if not self._running:
                return False
            time.sleep(0.1)
        return True

    def _capture_loop(self):
        """
        Runs in background thread.
        Continuously reads frames and stores the latest one.
        Auto-reconnects on failure.
        """
        while self._running:
            # Thread-safe source switching: detect source change, release, and switch instantly
            if self._connected and hasattr(self, "_active_source") and self.source != self._active_source:
                logger.info(f"Source change detected in capture thread: {self._active_source} -> {self.source}")
                self._release()
                continue

            if not self._connected:
                if not self._open():
                    self._responsive_sleep(self.reconnect_delay)
                    continue

            # Route to direct MJPEG reader if source is HTTP (DroidCam WiFi/USB)
            if self._source_type == "http":
                self._capture_mjpeg_loop()
                # Clean reconnect backoff delay to prevent 100% CPU hot loop when disconnected
                self._responsive_sleep(self.reconnect_delay)
                continue

            ret, frame = self._cap.read()

            if not ret or frame is None:
                logger.warning("Frame read failed — reconnecting...")
                self._release()
                self._responsive_sleep(self.reconnect_delay)
                continue

            with self._lock:
                self._frame = frame
                self._frame_id += 1

    def _capture_mjpeg_loop(self):
        """
        Direct, high-speed, zero-buffer multipart MJPEG stream reader.
        Bypasses FFMPEG/OpenCV buffering for direct sockets/HTTP.
        Extremely low latency.
        """
        import urllib.request
        import socket
        import select

        stream_url = self.source
        logger.info(f"Starting direct zero-buffer MJPEG reader for DroidCam/IP feed: {stream_url}")

        response = None
        try:
            req = urllib.request.Request(
                stream_url,
                headers={"User-Agent": "LunarCraterDetector/2.0 DroidCamClient"}
            )
            # Use 2s timeout for connection establishment
            response = urllib.request.urlopen(req, timeout=2.0)
            
            # Check if DroidCam is busy (returns HTML instead of multipart stream)
            content_type = response.headers.get("Content-Type", "")
            if "text/html" in content_type:
                html_body = response.read(1000).decode("utf-8", errors="ignore")
                if "droidcam_busy" in html_body or "Busy" in html_body:
                    self._error = "DroidCam Busy: Close other connected apps/tabs."
                else:
                    self._error = "Wireless camera returned HTML instead of video."
                self._connected = False
                self._standby = False
                logger.error(self._error)
                return

            bytes_buffer = b""
            self._connected = True
            self._error = None

            while self._running and self._connected:
                # Exit if the camera source has changed
                if self.source != stream_url:
                    break

                # Use select to check if socket has data available before reading.
                # This prevents blocking on response.read() when stream is stopped or disconnected.
                try:
                    if getattr(response, "fp", None) is None:
                        break
                    r, _, _ = select.select([response], [], [], 0.1)
                    if not r:
                        # Timeout - no data ready yet. Loop again to check running state.
                        continue
                except Exception:
                    pass

                try:
                    chunk = response.read(16384)
                    if not chunk:
                        logger.warning("MJPEG stream empty chunk (connection closed).")
                        break
                    bytes_buffer += chunk
                except (socket.timeout, TimeoutError):
                    logger.warning("MJPEG stream read timeout.")
                    break
                except Exception as e:
                    logger.warning(f"MJPEG stream read error: {e}")
                    break

                # Parse JPEG packets
                while True:
                    a = bytes_buffer.find(b"\xff\xd8")  # JPEG start marker
                    if a == -1:
                        # Prevent memory leaks if buffer grows too large without JPEG start.
                        # 512 KB is plenty for high-resolution JPEG frames.
                        if len(bytes_buffer) > 512 * 1024:
                            bytes_buffer = b""
                        break
                    
                    if a > 0:
                        bytes_buffer = bytes_buffer[a:]
                        a = 0

                    b = bytes_buffer.find(b"\xff\xd9", a + 2)  # JPEG end marker
                    if b == -1:
                        break

                    jpg = bytes_buffer[a : b + 2]
                    bytes_buffer = bytes_buffer[b + 2 :]

                    try:
                        frame = cv2.imdecode(
                            np.frombuffer(jpg, dtype=np.uint8),
                            cv2.IMREAD_COLOR
                        )
                        if frame is not None:
                            with self._lock:
                                self._frame = frame
                                self._frame_id += 1
                    except Exception as decode_err:
                        logger.warning(f"JPEG frame decode error: {decode_err}")

        except Exception as e:
            self._error = f"MJPEG stream connection error: {e}"
            self._standby = False
            logger.error(self._error)
        finally:
            if response is not None:
                try:
                    response.close()
                except Exception:
                    pass
            self._release()


# ── Convenience factory functions ─────────────────────────────────────────────

def make_webcam(index: int = 0) -> CameraHandler:
    """Local webcam or USB camera by device index."""
    return CameraHandler(source=index)


def make_ip_camera(url: str) -> CameraHandler:
    """
    IP / network camera.
    Examples:
      url = "rtsp://admin:password@192.168.1.64:554/stream"
      url = "http://192.168.1.100:8080/video"   ← DroidCam
      url = "http://192.168.1.100:4747/video"   ← IP Webcam (Android)
    """
    return CameraHandler(source=url)


def list_available_cameras(max_index: int = 5) -> list[int]:
    """
    Probe local camera indices and return the ones that open successfully.
    """
    available = []
    for i in range(max_index):
        # probe with default backend (MSMF) on Windows first for speed and safety, with fallback to DirectShow
        if os.name == 'nt':
            cap = cv2.VideoCapture(i)
            if not cap.isOpened():
                cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
        else:
            cap = cv2.VideoCapture(i)
        if cap.isOpened():
            available.append(i)
            cap.release()
    return available


def setup_adb_port_forward(port: int = 4747) -> dict:
    """
    Attempts to forward local tcp port to Android device tcp port via ADB.
    Returns a dict with success status, error detail, and message.
    """
    adb_path = shutil.which("adb")
    if not adb_path:
        local_app_data = os.environ.get("LOCALAPPDATA", "")
        # Common locations for ADB on Windows
        fallbacks = [
            os.path.join(local_app_data, "Android", "Sdk", "platform-tools", "adb.exe"),
            r"C:\platform-tools\adb.exe",
            r"C:\Android\platform-tools\adb.exe",
            r"C:\ProgramData\chocolatey\bin\adb.exe",
        ]
        for fb in fallbacks:
            if os.path.exists(fb):
                adb_path = fb
                break
        else:
            adb_path = "adb"

    try:
        # Check connected devices
        devices_res = subprocess.run(
            [adb_path, "devices"],
            capture_output=True,
            text=True,
            timeout=3
        )
        if devices_res.returncode != 0:
            return {
                "success": False,
                "error": f"ADB exit code {devices_res.returncode}",
                "message": "ADB is not active or configured."
            }

        lines = [line.strip() for line in devices_res.stdout.splitlines() if line.strip()]
        # The first line is "List of devices attached"
        device_count = len(lines) - 1
        if device_count <= 0:
            return {
                "success": False,
                "error": "No USB devices found",
                "message": "No Android device detected over USB. Make sure USB Debugging is enabled on your phone and it is connected via cable."
            }

        # Run adb forward
        forward_res = subprocess.run(
            [adb_path, "forward", f"tcp:{port}", f"tcp:{port}"],
            capture_output=True,
            text=True,
            timeout=3
        )
        if forward_res.returncode == 0:
            logger.info(f"ADB port forwarding established on tcp:{port}")
            return {
                "success": True,
                "message": f"Successfully forwarded DroidCam port {port} over USB cable via ADB. Use address http://127.0.0.1:{port}/video"
            }
        else:
            return {
                "success": False,
                "error": forward_res.stderr.strip() or "Forward command failed",
                "message": "Failed to forward port via ADB. Verify USB connection and debugging permissions."
            }
    except FileNotFoundError:
        return {
            "success": False,
            "error": "ADB executable not found",
            "message": "Android Debug Bridge (adb.exe) is not installed or not in System PATH."
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": f"ADB port forwarding failed: {e}"
        }
