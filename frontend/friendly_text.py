"""
Smart Companion - plain-language wording fixer.

Replaces technical labels such as "CLARIFICATION REQUIRED 1 QUERY" and
"KNOWLEDGE SYNTHESIS" (and many status / error messages) with simple words.

How to use:
  1. Put this file in your  frontend  folder (next to app.js and index.html).
  2. Run:   python friendly_text.py
  3. Hard refresh the page (Ctrl+F5).

It first saves backups as app.js.bak and index.html.bak (only once), and it only
changes text that it finds, so it is safe to run again.
"""
import os
import re
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
FILES = ["app.js", "index.html"]

# Regex replacements (multi-line blocks that are removed completely)
REGEX_REMOVE = [
    # "CLARIFICATION REQUIRED / 1 QUERY" header above a clarifying question
    r"\s*const header = document\.createElement\('div'\);\s*"
    r"header\.className = 'step-card-header';\s*"
    r"header\.innerHTML = `<span>CLARIFICATION REQUIRED</span><span>1 QUERY</span>`;\s*"
    r"wrap\.appendChild\(header\);",
]

# (old, new). Order matters: longer / more specific texts first.
# New texts contain no apostrophes or quotes so they cannot break the JS strings.
PAIRS = [
    # --- labels above answers -------------------------------------------------
    ("<span>KNOWLEDGE SYNTHESIS</span><span>RETRIEVAL RESULT</span>", "<span>Smart Companion</span>"),
    ('<div class="step-card-header"><span>HEALTHCARE DIRECTORY RESULTS</span></div>',
     '<div style="font-weight:600; margin-bottom:6px;">Nearby clinics and hospitals</div>'),

    # --- status and error messages ---------------------------------------------
    ("Deconstructing cognitive task\u2026", "Thinking\u2026"),
    ("Advancing task sequence\u2026", "Getting your next steps\u2026"),
    ("Retrieving Next Milestones\u2026", "Getting your next steps\u2026"),
    ("Execute Next Milestone", "Next step"),
    ("Task sequence error.", "Something went wrong. Please try again."),
    ("Searching document vector space\u2026", "Reading your document\u2026"),
    ("Running Groq Vision inference\u2026", "Looking at your photo\u2026"),
    ("Transcribing with Groq Whisper\u2026", "Turning your voice into text\u2026"),
    ("Capturing voice audio\u2026", "Listening\u2026"),
    ("Whisper transcription failed.", "Could not understand the audio. Please try again."),
    ("No audio deciphered.", "Did not catch that. Please try again."),
    ("Vision model inference error.", "Could not read the photo. Please try again."),
    ("Document reasoning error.", "Could not read the document. Please try again."),
    ("Document indexing failed.", "Could not open the document. Please try again."),
    ("Indexing document pages\u2026", "Opening your document\u2026"),
    ("Indexed first section of large document.", "Opened the first part of this large document."),
    ("Backend connection error. Please verify FastAPI is running at port 8000.",
     "Cannot connect right now. Please check that the app server is running."),
    ("Optical frame acquisition failed.", "Could not capture the picture."),
    ("Stream frame unavailable. Check network link.", "Camera picture unavailable. Check the connection."),
    ("Optical sensor access denied.", "Camera access was blocked."),
    ("Vision service unreachable.", "Cannot reach the camera helper."),
    ("Optical frame error.", "Camera problem."),
    ("Analyzing visual scene\u2026", "Looking at the picture\u2026"),
    ("Query this optical snapshot\u2026", "Ask a question about this photo\u2026"),
    ("Query this document context\u2026", "Ask a question about this document\u2026"),
    ("Webcam active. Point at any object or environment to query.",
     "Webcam is on. Point it at something and ask a question."),
    ("IP Camera feed active. Point camera and query.",
     "IP camera is on. Point it at something and ask a question."),
    ("Capturing IP camera frame\u2026", "Taking a picture from the IP camera\u2026"),
    ("Failed to capture frame from stream.", "Could not take a picture from the camera."),
    ("Failed to update stream configuration.", "Could not save the camera settings."),
    ("Backend unreachable.", "Cannot reach the app server."),
    ("Point webcam, then capture frame", "Point the webcam, then take a photo"),
    ("Point IP Camera, then capture frame", "Point the IP camera, then take a photo"),

    # --- camera connection ------------------------------------------------------
    ("LINK ESTABLISHED: STREAM VERIFIED", "Camera connected"),
    ("BACKEND OFFLINE", "App server offline"),
    ("Stream offline or unresolved", "Camera not connected"),
    ("Optical link verified active.", "Camera connected."),
    ("Optical link offline. Check stream endpoint.", "Camera not connected. Check the address."),
    ("Connecting to stream\u2026", "Connecting to camera\u2026"),
    ("Stream link verified.", "Camera connected."),
    ("Stream URL saved.", "Camera address saved."),
    ("Test Stream Link", "Test camera"),
    ("Querying network link\u2026", "Checking connection\u2026"),

    # --- toasts and badges --------------------------------------------------------
    ("Milestone completed // Total: ", "Step done. Total: "),
    ("Sequence completed.", "All steps done. Well done!"),
    ("Capability unlocked: ", "New badge: "),
    ("Voice Telemetry", "Voice"),
    ("Audio transcription via Groq Whisper", "Asked a question using your voice"),
    ("Visual Analysis", "Photo Helper"),
    ("Snapshot query via Groq Vision", "Asked a question about a photo"),
    ("Document RAG", "Document Reader"),
    ("Vector page retrieval on PDF documents", "Asked a question about a PDF"),
    ("Spatial Assistance", "Live Camera"),
    ("Live optical guidance stream", "Used the live camera guide"),
    ("${unlocked ? 'ACTIVE' : 'LOCKED'} // ${b.desc}", "${unlocked ? 'Unlocked' : 'Locked'} - ${b.desc}"),
    ("Growth Badges & Milestones", "Badges & Progress"),
    ("PROGRESSION", "PROGRESS"),

    # --- health log ---------------------------------------------------------------
    ("Stored in encrypted local device space. Relevant metrics are contextualized only during medical sessions.",
     "Saved only on this device. Used only to give better answers in medical chats."),
    ("Relevant metrics are contextualized only during medical sessions.",
     "Used only to give better answers in medical chats."),
    ("Health Telemetry Log", "Health Log"),
    ("SECURE CLIENT STORAGE", "PRIVATE ON THIS DEVICE"),
    ("Record Telemetry", "Save Entry"),
    ("No telemetry logged.", "No entries yet."),
    ("STORED RECORDS", "YOUR ENTRIES"),
    ("Context or clinical note (optional)", "Note (optional)"),

    # --- emergency (SOS) dialog ------------------------------------------------------
    ("CRITICAL PROTOCOL ACTIVE", "EMERGENCY HELP"),
    ("CRITICAL SAFETY PROTOCOL", "SAFETY"),
    ("CRITICAL PROTOCOL", "EMERGENCY"),
    ("Immediate Emergency Assistance", "Emergency Help"),
    ("Dismiss Emergency Protocol", "Close"),
    ("Live Emergency Navigation", "Directions to a hospital"),
    ("Acquiring GPS location telemetry and calculating route to nearest hospital\u2026",
     "Finding your location and the nearest hospital\u2026"),
    ("Fetching fresh GPS coordinates\u2026", "Updating your location\u2026"),
    ("Live Location Telemetry", "Your live location"),
    ("GPS Location Access Unavailable", "Can not find your location"),
    ("Emergency Contact SOS Auto-Alert", "Emergency Contact"),
    ("NO CONTACT SAVED", "NO CONTACT YET"),
    ("Emergency Contact Automated Alert", "Alert your emergency contact"),
    ("Save & Dispatch Alert", "Save contact"),
    ("Sending Auto-Alert\u2026", "Preparing alert\u2026"),
    ("Alert Ready (1-Tap Send)", "Alert ready. Tap Send below"),
    ("AUTOMATED EMERGENCY MESSAGE PREVIEW", "MESSAGE THAT WILL BE SENT"),

    # --- conversations list ---------------------------------------------------------------
    ("Purge all memory streams and restart system context?", "Delete all conversations?"),
    ("Purge memory stream ", "Delete conversation "),
    ("Purge Stream", "Delete conversation"),
    ("General Cognition", "General"),

    # --- index.html text ---------------------------------------------------------------------
    ("Optical Guidance Workspace", "Live Camera Help"),
    ("Ambient Scene Reasoning (6s)", "Describe what the camera sees (every 6s)"),
    ("Point camera at objects or text to initiate cognitive vision guidance.",
     "Point the camera at something and ask a question."),
    ("Settings & Network Sensors", "Settings"),
    ("SYSTEM CONFIGURATION", "SETTINGS"),
    ("FastAPI Backend Endpoint", "App server address"),
    ("Stream RTSP / MJPEG URL", "Camera stream address"),
    ("Capture & Stage Frame", "Take photo"),
    ("Upload Image Frame", "Upload a photo"),
    ("Capture Snapshot", "Take a photo"),
    ("Guided Vision Search", "Live camera help"),
    ('id="liveCamSendBtn">Query</button>', 'id="liveCamSendBtn">Ask</button>'),
    ("Ask about this visual scene\u2026", "Ask about what the camera sees\u2026"),
]


def process(path):
    with open(path, "r", encoding="utf-8", newline="") as f:
        text = f.read()
    original = text
    changes = []

    for pattern in REGEX_REMOVE:
        text, n = re.subn(pattern, "", text)
        if n:
            changes.append((n, "removed: CLARIFICATION REQUIRED / 1 QUERY header"))

    for old, new in PAIRS:
        n = text.count(old)
        if n:
            text = text.replace(old, new)
            changes.append((n, old[:60] + " -> " + new[:50]))

    if text != original:
        backup = path + ".bak"
        if not os.path.exists(backup):
            shutil.copyfile(path, backup)
        with open(path, "w", encoding="utf-8", newline="") as f:
            f.write(text)
    return changes


def main():
    total = 0
    for name in FILES:
        path = os.path.join(HERE, name)
        if not os.path.exists(path):
            print("Skipped (not found):", name)
            continue
        changes = process(path)
        count = sum(n for n, _ in changes)
        total += count
        print("\n%s: %d change(s)" % (name, count))
        for n, label in changes:
            print("   %dx  %s" % (n, label))
    print("\nDone. %d change(s) in total. Hard refresh the page with Ctrl+F5." % total)
    if total == 0:
        print("(Nothing to change: the wording may already be updated.)")


if __name__ == "__main__":
    main()