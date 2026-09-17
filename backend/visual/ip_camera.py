import cv2
import threading
import time
import urllib.parse


class IPCameraStream:
    def __init__(self, rtsp_url: str):
        self.rtsp_url = self.normalize_url(rtsp_url)
        self.cap = None
        self.latest_frame = None
        self.last_frame_time = 0.0
        self.is_running = False
        self.lock = threading.Lock()
        self.thread = None

    @staticmethod
    def normalize_url(url: str) -> str:
        if not url:
            return ""
        cleaned = url.strip()
        # Add http:// if scheme is missing
        if not cleaned.startswith("http://") and not cleaned.startswith("https://") and not cleaned.startswith("rtsp://"):
            cleaned = "http://" + cleaned
        # If user pointed to root of IP Webcam without path (e.g. http://10.238.42.4:8080 or http://...:8080/)
        try:
            parsed = urllib.parse.urlparse(cleaned)
            if parsed.scheme in ("http", "https") and (parsed.path in ("", "/")):
                cleaned = cleaned.rstrip("/") + "/video"
        except Exception:
            pass
        return cleaned

    def start(self):
        if self.is_running:
            return
        self.is_running = True
        self.thread = threading.Thread(target=self._update, daemon=True)
        self.thread.start()

    def set_url(self, new_url: str) -> str:
        normalized = self.normalize_url(new_url)
        with self.lock:
            self.rtsp_url = normalized
            self.latest_frame = None
            self.last_frame_time = 0.0
            if self.cap:
                try:
                    self.cap.release()
                except Exception:
                    pass
            self.cap = None
        return normalized

    def _update(self):
        while self.is_running:
            try:
                target_url = None
                with self.lock:
                    target_url = self.rtsp_url

                if not target_url:
                    time.sleep(1)
                    continue

                if self.cap is None or not self.cap.isOpened():
                    self.cap = cv2.VideoCapture(target_url)
                    if not self.cap.isOpened():
                        time.sleep(2)
                        continue

                grabbed, frame = self.cap.read()
                if not grabbed:
                    time.sleep(0.2)
                    continue

                with self.lock:
                    self.latest_frame = frame
                    self.last_frame_time = time.time()
            except Exception:
                time.sleep(1)

    def get_latest_jpeg(self) -> bytes | None:
        with self.lock:
            # Check if frame is fresh (received in last 5 seconds)
            if self.latest_frame is None or (time.time() - self.last_frame_time > 5.0):
                return None
            success, encoded_image = cv2.imencode(".jpg", self.latest_frame)
            if not success:
                return None
            return encoded_image.tobytes()

    def is_connected(self) -> bool:
        with self.lock:
            if self.latest_frame is None:
                return False
            return (time.time() - self.last_frame_time) < 4.0

    def get_status(self) -> dict:
        with self.lock:
            connected = (self.latest_frame is not None) and ((time.time() - self.last_frame_time) < 4.0)
            age = round(time.time() - self.last_frame_time, 1) if self.last_frame_time > 0 else None
            return {
                "connected": connected,
                "url": self.rtsp_url,
                "last_frame_age_seconds": age,
                "message": "Stream active" if connected else "Camera offline or connecting..."
            }

    def stop(self):
        self.is_running = False
        if self.cap:
            try:
                self.cap.release()
            except Exception:
                pass

