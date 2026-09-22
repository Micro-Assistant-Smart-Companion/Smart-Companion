#  Smart Companion (Micro Assistant)

> A friendly, multi-modal AI companion designed to break down overwhelming tasks into bite-sized steps, answer questions with visual context, and guide users in real-time through Webcams or IP Cameras.

---

##  Overview

**Smart Companion** is an executive-functioning and accessibility assistant built especially for users who experience task paralysis, ADHD, or neurodivergent scanning patterns—or anyone who benefits from structured, patient guidance.

Instead of outputting long, intimidating walls of text, Smart Companion:
1. Breaks down any goal or problem into **3 simple, sequential steps** at a time.
2. Tracks progress with an interactive **"Done — what's next?"** workflow.
3. Incorporates **voice input & speech output** so users can speak freely rather than type.
4. Provides **live vision intelligence** to inspect what you are looking at and answer questions about physical objects using your laptop webcam or a smartphone/CCTV IP Camera.
5. Protects privacy by **automatically redacting sensitive personal information (PII)** before querying cloud models.

---

##  Key Features

###  1. Micro-Step Task Decomposition
- Powered by modern LLMs via the **Groq API**.
- Adapts to goals ("clean my kitchen", "study for exam") or questions ("explain quantum computing").
- Maintains conversation history and step progression so tasks continue forward seamlessly.
- Configurable tone (*encouraging, friendly, patient*) and reading level (*simple, clear*).

### 🎙️ 2. Dual-Engine Voice Input & Speech Output
- **Live Visual Captions**: Instant feedback while speaking via the browser's Web Speech API.
- **Accurate Audio Transcription**: High-fidelity speech-to-text powered by Groq's `whisper-large-v3-turbo`.
- **Spoken Guidance**: Answers and headlines are read aloud via browser Speech Synthesis.

###  3. Privacy-First PII Redaction
- Evaluates user prompts with **spaCy** (`en_core_web_sm`) named-entity recognition.
- Automatically strips sensitive entities (e.g. `PERSON`, `ORG`, `GPE`, `LOC`, `DATE`, `TIME`) before sending data to external AI models.

### 📷 4. Dual Camera Support: Webcam & IP Camera
- **Webcam Mode**: Connects directly to laptop or USB webcams via HTML5 `getUserMedia`.
- **IP Camera Mode**: Integrates with IP cameras, CCTV feeds, or Android **IP Webcam** via RTSP/HTTP MJPEG (`/video`).
- **Live Stream Proxy**: Zero-lag MJPEG stream (`/camera/stream`) and snapshot extraction (`/camera/frame`).
- **One-Click Toggle & On-the-Fly Configuration**: Switch between Webcam and IP Camera directly in the header with live URL settings.

### 👁️ 5. Vision AI & Live Guided Search
- **Visual Question Answering**: Analyzes snapshots with Groq Vision (`qwen/qwen3.8-27b`) formatted in two tiers: an instant 1-sentence headline followed by details.
- **Object Detection**: Fast local object detection and item counting using **YOLOv8** (`yolov8n.pt`).
- **Live Guided Search**: Continuous assistance directing the user where to point the camera to find misplaced items.

---

##  Architecture & Tech Stack

```
Smart-Companion/
│
├── frontend/
│   └── index.html               # Responsive single-page application (Vanilla HTML5 / CSS3 / JS)
│
└── backend/
    ├── .env                     # Environment variables (API keys & configuration)
    ├── yolov8n.pt               # YOLOv8 pre-trained model weights
    ├── app/
    │   ├── app.py               # FastAPI application & endpoint definitions
    │   ├── llm.py               # Task decomposition engine & prompt construction
    │   ├── models.py            # Pydantic data schemas
    │   ├── redact.py            # spaCy PII detection & masking
    │   ├── requirements.txt     # Python backend dependencies
    │   └── test.html            # Lightweight voice testing harness
    ├── speech_to_text/
    │   └── speech.py            # Groq Whisper transcription client
    └── visual/
        ├── caption.py           # Groq Vision image Q&A
        ├── guide.py             # Live directional search guidance
        ├── ip_camera.py         # Thread-safe OpenCV IP camera streaming worker
        └── vision.py            # YOLOv8 object detection wrapper
```

### Technologies Used
- **Backend**: Python 3.10+, [FastAPI](https://fastapi.tiangolo.com/), Uvicorn, Pydantic, OpenCV (`cv2`)
- **AI / ML**: [Groq Cloud SDK](https://groq.com/) (LLM, Whisper, Vision), [Ultralytics YOLOv8](https://github.com/ultralytics/ultralytics), [spaCy](https://spacy.io/)
- **Frontend**: Vanilla HTML5/CSS3/JavaScript (No bundler or build steps required), Web Speech API, MediaRecorder API

---

##  Getting Started

### 1. Prerequisites
- Python 3.10 or higher installed.
- A free [Groq API Key](https://console.groq.com/).
- A working microphone and camera (laptop webcam, USB webcam, or smartphone with IP Webcam).

---

### 2. Installation

1. **Clone or navigate to the repository:**
   ```powershell
   cd "c:\Users\DELL\Project (Micro Assistant)\Main"
   ```

2. **Set up a virtual environment (recommended):**
   ```powershell
   python -m venv .venv
   .venv\Scripts\activate
   ```

3. **Install Python dependencies:**
   ```powershell
   pip install -r backend/app/requirements.txt
   ```

4. **Download the spaCy English NLP model:**
   ```powershell
   python -m spacy download en_core_web_sm
   ```

---

### 3. Configure Environment Variables

Create or update `backend/.env`:
```env
# Required: Groq API Key
GROQ_API_KEY="your_groq_api_key_here"

# Optional: Default IP Camera Stream URL (e.g. from Android IP Webcam)
CAMERA_URL="http://192.168.1.100:8080/video"
```

---

### 4. Running the Backend Server

Run the FastAPI server from the `backend` folder:
```powershell
cd backend
python -m uvicorn app.app:app --reload --port 8000
```

- API Health Check: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)
- Interactive Swagger API Docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

### 5. Launching the Frontend

Simply open `frontend/index.html` in your web browser:
- Double-click `frontend/index.html` in File Explorer, or
- Use a local static server like Live Server in VS Code / Antigravity, or:
  ```powershell
  cd frontend
  python -m http.server 3000
  ```
  Then navigate to [http://127.0.0.1:3000](http://127.0.0.1:3000).

---

##  Using a Smartphone as an IP Camera

You can turn any Android phone or tablet into an IP camera for Smart Companion:

1. Install **IP Webcam** (by Pavel Khlebovich) from Google Play.
2. Connect your phone to the **same Wi-Fi network** as your computer.
3. In the app:
   - *(Recommended)* Under **Video preferences**, set **Video resolution** to `1280x720` or `640x480` for low latency.
   - Scroll to the bottom and tap **Start server**.
4. Note the URL displayed at the bottom of the phone screen (e.g., `http://192.168.1.42:8080`).
5. In the Smart Companion web interface:
   - Click the **`📱 IP Camera`** toggle in the top bar.
   - Click the **`⚙️`** settings icon and enter `http://<YOUR_PHONE_IP>:8080/video`.
   - Click **Save & Connect**.
6. Use **"Take Photo"** or **"Find it live"** to interact with the live phone camera!

---

##  API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Server health check (`{"status": "OK"}`) |
| `POST` | `/decompose-task` | Decomposes a goal into small steps with memory & tone control |
| `POST` | `/transcribe` | Transcribes multipart audio using Groq Whisper |
| `POST` | `/redact` | Redacts PII entities (names, dates, locations) from text |
| `POST` | `/caption-image` | Visual Q&A on uploaded image file via Groq Vision |
| `POST` | `/detect-objects` | Runs YOLOv8 object detection on uploaded image file |
| `POST` | `/guide-search` | Provides directional camera instructions for finding an object |
| `GET` | `/camera/status` | Returns connectivity status & active stream URL of IP camera |
| `POST` | `/camera/set-url` | Dynamically updates the active IP camera stream URL |
| `GET` | `/camera/stream` | Streams live MJPEG video feed from the active IP camera |
| `GET` | `/camera/frame` | Captures and returns a single JPEG frame from the IP camera |
| `POST` | `/camera/ask` | Questions the vision model using the latest live IP camera frame |

---

##  Keyboard & Voice Shortcuts

- **Enter**: Sends your typed goal or question.
- **Shift + Enter**: Inserts a new line in the input box.
- **Microphone Button (`🎙️`)**: Click once to start speaking; click again to stop and transcribe. Live transcript feedback shows in real-time.
- **Done Button**: When you complete a set of steps, click *"Done — what's next?"* to receive the next batch of steps without repeating previous work.

---

## License

This project is open source and available under the [MIT License](LICENSE).
