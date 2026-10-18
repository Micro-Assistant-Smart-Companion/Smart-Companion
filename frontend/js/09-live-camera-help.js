// [09/19] live camera help and scene description
// Part of the Smart Companion page script. Loaded by index.html in numeric order; all files share one global scope.
// --- 12. VISION HUD WORKSPACE & CONTINUOUS SCENE REASONING ---

async function startGuidedSearch() {
  unlockBadge('live', 'Live Explorer');
  if (currentCameraSource === 'webcam') {
    stopIpImgPolling();
    if (liveCamIpImg) { liveCamIpImg.style.display = 'none'; liveCamIpImg.src = ''; }
    if (liveCamVideo) liveCamVideo.style.display = 'block';
    try {
      if (!liveCamStream) {
        liveCamStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
      }
      if (liveCamVideo) liveCamVideo.srcObject = liveCamStream;
      if (liveCamOverlay) liveCamOverlay.classList.add('active');
      setLiveCamAnswer("Webcam is on. Point it at something and ask a question.");
      speak("Webcam active.");
      if (liveCamGoal) { liveCamGoal.value = ''; liveCamGoal.focus(); }
    } catch (err) {
      setStatus('Camera access was blocked.', true);
    }
  } else {
    if (liveCamStream) {
      liveCamStream.getTracks().forEach(t => t.stop());
      liveCamStream = null;
    }
    if (liveCamVideo) liveCamVideo.style.display = 'none';
    if (liveCamIpImg) {
      liveCamIpImg.style.display = 'block';
      startIpImgPolling(liveCamIpImg);
    }
    if (liveCamOverlay) liveCamOverlay.classList.add('active');
    setLiveCamAnswer("IP camera is on. Point it at something and ask a question.");
    speak("IP Camera active.");
    if (liveCamGoal) { liveCamGoal.value = ''; liveCamGoal.focus(); }
  }
}

function stopLiveCam() {
  if (liveCamStream) {
    liveCamStream.getTracks().forEach(t => t.stop());
    liveCamStream = null;
  }
  stopIpImgPolling();
  stopAmbientMode();
  if (liveCamIpImg) liveCamIpImg.src = '';
  if (liveCamOverlay) liveCamOverlay.classList.remove('active');
  window.speechSynthesis && window.speechSynthesis.cancel();
}

if (liveCamCloseBtn) liveCamCloseBtn.addEventListener('click', stopLiveCam);
if (liveCamOverlay) {
  liveCamOverlay.addEventListener('click', (e) => {
    if (e.target === liveCamOverlay) stopLiveCam();
  });
}

function setLiveCamAnswer(text, isThinking = false) {
  if (!liveCamAnswer) return;
  liveCamAnswer.textContent = text;
  liveCamAnswer.classList.toggle('thinking', isThinking);
}

async function captureCurrentFrame() {
  if (currentCameraSource === 'webcam') {
    if (!liveCamStream || !liveCamVideo) return null;
    const canvas = document.createElement('canvas');
    canvas.width = liveCamVideo.videoWidth || 640;
    canvas.height = liveCamVideo.videoHeight || 480;
    canvas.getContext('2d').drawImage(liveCamVideo, 0, 0);
    return new Promise((resolve) => canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.8));
  } else {
    try {
      const res = await fetch(`${API}/camera/frame?t=${Date.now()}`);
      if (!res.ok) return null;
      return await res.blob();
    } catch (e) {
      return null;
    }
  }
}

async function askLiveCamera() {
  const question = liveCamGoal ? liveCamGoal.value.trim() : '';
  if (!question) return;
  liveCamGoal.value = '';
  setLiveCamAnswer("Looking at the picture…", true);
  if (liveCamSendBtn) liveCamSendBtn.disabled = true;

  const blob = await captureCurrentFrame();
  if (!blob) {
    setLiveCamAnswer(currentCameraSource === 'webcam'
      ? "Could not capture the picture."
      : "Camera picture unavailable. Check the connection.");
    if (liveCamSendBtn) liveCamSendBtn.disabled = false;
    return;
  }

  const formData = new FormData();
  formData.append('file', blob, 'frame.jpg');
  formData.append('question', question);
  formData.append('history', JSON.stringify(history.slice(-8)));
  const endpoint = currentCameraSource === 'webcam' ? '/caption-image' : '/camera/ask';

  try {
    const res = await fetch(`${API}${endpoint}`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('request failed');
    const data = await res.json();
    if (data.error) {
      setLiveCamAnswer(data.error);
      speak("Camera problem.");
    } else {
      const fullAnswer = flattenAnswer(data.headline, data.steps);
      setLiveCamAnswer(fullAnswer);
      speak(data.headline);
      history.push({ role: "user", content: question });
      history.push({ role: "assistant", content: fullAnswer });
    }
  } catch (err) {
    setLiveCamAnswer("Cannot reach the camera helper.");
  } finally {
    if (liveCamSendBtn) liveCamSendBtn.disabled = false;
  }
}

if (liveCamSendBtn) liveCamSendBtn.addEventListener('click', askLiveCamera);
if (liveCamGoal) {
  liveCamGoal.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      askLiveCamera();
    }
  });
}

if (liveCamMicBtn) {
  liveCamMicBtn.addEventListener('click', async () => {
    if (!LiveRecognition) {
      setStatus('Speech recognition unsupported in this client.', true);
      return;
    }
    const rec = new LiveRecognition();
    rec.lang = currentLang().bcp;
    rec.interimResults = true;
    rec.onresult = (event) => {
      let combined = '';
      for (let i = 0; i < event.results.length; i++) {
        combined += event.results[i][0].transcript;
      }
      if (liveCamGoal) liveCamGoal.value = combined;
    };
    liveCamMicBtn.classList.add('recording');
    rec.onend = () => {
      liveCamMicBtn.classList.remove('recording');
      if (liveCamGoal && liveCamGoal.value.trim()) askLiveCamera();
    };
    try { rec.start(); } catch (e) {}
  });
}

// Continuous Ambient Scene Description Loop
if (ambientToggleBtn) {
  ambientToggleBtn.addEventListener('click', () => {
    ambientRunning ? stopAmbientMode() : startAmbientMode();
  });
}

function startAmbientMode() {
  ambientRunning = true;
  ambientToggleBtn.classList.add('active');
  describeSceneOnce();
  ambientIntervalId = setInterval(describeSceneOnce, 6000);
}

function stopAmbientMode() {
  ambientRunning = false;
  if (ambientToggleBtn) ambientToggleBtn.classList.remove('active');
  if (ambientIntervalId) {
    clearInterval(ambientIntervalId);
    ambientIntervalId = null;
  }
}

async function describeSceneOnce() {
  const blob = await captureCurrentFrame();
  if (!blob) return;
  const formData = new FormData();
  formData.append('file', blob, 'frame.jpg');
  formData.append('question', "Briefly summarize what is visible in this frame in one direct sentence.");
  formData.append('history', '[]');
  const endpoint = currentCameraSource === 'webcam' ? '/caption-image' : '/camera/ask';

  try {
    const res = await fetch(`${API}${endpoint}`, { method: 'POST', body: formData });
    if (!res.ok) return;
    const data = await res.json();
    if (data.error) return;
    setLiveCamAnswer(data.headline);
    speak(data.headline);
  } catch (e) {}
}
