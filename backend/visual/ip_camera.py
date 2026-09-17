import cv2
import threading
import time

class IPCameraStream:
    def __init__(self, rtsp_url: str):
        self.rtsp_url = rtsp_url
        self.cap = None
        self.latest_frame = None
        self.is_running = False
        self.lock = threading.Lock()
        self.thread = None

    def start(self):
        if self.is_running:
            return
        self.is_running = True
        self.thread = threading.Thread(target=self._update, daemon=True)
        self.thread.start()

    def set_url(self, new_url: str):
        with self.lock:
            self.rtsp_url = new_url
            self.latest_frame = None
            if self.cap:
                try:
                    self.cap.release()
                except Exception:
                    pass
            self.cap = None

    def _update(self):
        while self.is_running:
            try:
                if self.cap is None or not self.cap.isOpened():
                    self.cap = cv2.VideoCapture(self.rtsp_url)
                    if not self.cap.isOpened():
                        time.sleep(2)
                        continue

                grabbed, frame = self.cap.read()
                if not grabbed:
                    time.sleep(0.2)
                    continue

                with self.lock:
                    self.latest_frame = frame
            except Exception:
                time.sleep(1)

    def get_latest_jpeg(self) -> bytes | None:
        with self.lock:
            if self.latest_frame is None:
                return None
            success, encoded_image = cv2.imencode(".jpg", self.latest_frame)
            if not success:
                return None
            return encoded_image.tobytes()

    def is_connected(self) -> bool:
        with self.lock:
            return self.latest_frame is not None

    def stop(self):
        self.is_running = False
        if self.cap:
            try:
                self.cap.release()
            except Exception:
                pass
