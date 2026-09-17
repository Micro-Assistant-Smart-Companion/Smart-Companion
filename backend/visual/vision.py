import io
from collections import Counter
from PIL import Image
# pyrefly: ignore [missing-import]
from ultralytics import YOLO

model = YOLO("yolov8n.pt")  


def detect_objects_summary(image_bytes: bytes) -> str:
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    results = model(image, verbose=False)
    boxes = results[0].boxes

    if boxes is None or len(boxes) == 0:
        return "No specific objects were clearly detected in the photo."

    labels = [model.names[int(cls)] for cls in boxes.cls]
    counts = Counter(labels)

    parts = [f"{count} {label}" + ("s" if count > 1 else "") for label, count in counts.items()]
    return "Detected in the photo: " + ", ".join(parts) + "."