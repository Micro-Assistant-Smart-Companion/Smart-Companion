import pickle
import os

_MODEL_PATH = os.path.join(os.path.dirname(__file__), "intent_classifier.pkl")

with open(_MODEL_PATH, "rb") as f:
    _model = pickle.load(f)


def predict_intent(text: str) -> str:
    return _model.predict([text])[0]


def predict_confidence(text: str) -> dict:
    """label -> probability - good for showing the panel a confidence score."""
    probs = _model.predict_proba([text])[0]
    return dict(zip(_model.classes_, probs))