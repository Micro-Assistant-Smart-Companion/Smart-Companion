const API = "http://127.0.0.1:8000";
const feedEl = document.getElementById('feed');
const goalEl = document.getElementById('goal');
const sendBtn = document.getElementById('sendBtn');
const micBtn = document.getElementById('micBtn');
const statusEl = document.getElementById('status');

let history = [];
let currentGoal = null;
let completedSteps = [];
let stepCounter = 0;

// --- multi-session sidebar (by topic, via /classify-session) ---
const SESSIONS_KEY = 'companion_sessions';
const initialFeedHTML = feedEl.innerHTML;
let sessions = { general: { history: [], completedSteps: [], stepCounter: 0, currentGoal: null, feedHTML: initialFeedHTML, name: 'General', sessionNote: '' } };
let currentLabel = 'general';
let currentSessionNote = '';

function persistSessions() {
  try { localStorage.setItem(SESSIONS_KEY, JSON.stringify({ sessions, currentLabel })); } catch (e) {}
}

(function loadSessions() {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSIONS_KEY));
    if (saved && saved.sessions && saved.sessions.general) {
      sessions = saved.sessions;
      currentLabel = saved.currentLabel || 'general';
      const s = sessions[currentLabel] || sessions.general;
      history = s.history; completedSteps = s.completedSteps; stepCounter = s.stepCounter; currentGoal = s.currentGoal;
      currentSessionNote = s.sessionNote || '';
      feedEl.innerHTML = s.feedHTML;
    }
  } catch (e) {}
})();

const sidebarEl = document.getElementById('sidebar');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');

function toggleSidebar(force) {
  const open = force !== undefined ? force : !sidebarEl.classList.contains('open');
  sidebarEl.classList.toggle('open', open);
  sidebarBackdrop.classList.toggle('open', open);
}
document.getElementById('sidebarToggleBtn').addEventListener('click', () => toggleSidebar());
sidebarBackdrop.addEventListener('click', () => toggleSidebar(false));

function renderSidebar() {
  const list = document.getElementById('sessionList');
  list.innerHTML = '';
  Object.keys(sessions).forEach(label => {
    const btn = document.createElement('button');
    btn.className = 'sidebar-item' + (label === currentLabel ? ' active' : '');
    btn.textContent = sessions[label].name;
    btn.onclick = () => switchSession(label);
    list.appendChild(btn);
  });
}

function snapshotCurrentSession() {
  sessions[currentLabel] = { history, completedSteps, stepCounter, currentGoal, feedHTML: feedEl.innerHTML, name: sessions[currentLabel].name, sessionNote: currentSessionNote };
  persistSessions();
}

function switchSession(label) {
  if (label !== currentLabel) {
    snapshotCurrentSession();
    const s = sessions[label];
    history = s.history; completedSteps = s.completedSteps; stepCounter = s.stepCounter; currentGoal = s.currentGoal;
    currentSessionNote = s.sessionNote || '';
    feedEl.innerHTML = s.feedHTML;
    currentLabel = label;
    renderSidebar();
    persistSessions();
    scrollToBottom();
  }
  toggleSidebar(false);
}

async function classifyAndSwitch(text) {
  let label = currentLabel;
  let note = '';
  try {
    const res = await fetch(`${API}/classify-session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    if (res.ok) { const d = await res.json(); label = d.label || currentLabel; note = d.note || ''; console.log('classify-session label:', label, '| current:', currentLabel); }
    else console.error('classify-session failed:', res.status, await res.text());
  } catch (e) { console.error('classify-session error:', e); return; }

  if (label === currentLabel) return;
  snapshotCurrentSession();
  if (!sessions[label]) {
    sessions[label] = { history: [], completedSteps: [], stepCounter: 0, currentGoal: null, feedHTML: initialFeedHTML, name: label.charAt(0).toUpperCase() + label.slice(1), sessionNote: note };
  }
  const s = sessions[label];
  history = s.history; completedSteps = s.completedSteps; stepCounter = s.stepCounter; currentGoal = s.currentGoal;
  currentSessionNote = s.sessionNote || '';
  feedEl.innerHTML = s.feedHTML;
  currentLabel = label;
  renderSidebar();
  persistSessions();
}
renderSidebar();
let awaitingClarification = false; // true right after an open-ended clarifying question
let isRecording = false, mediaRecorder, chunks = [];

goalEl.addEventListener('input', () => {
  goalEl.style.height = 'auto';
  goalEl.style.height = Math.min(goalEl.scrollHeight, 120) + 'px';
});

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle('error', isError);
}
function scrollToBottom() { feedEl.scrollTop = feedEl.scrollHeight; }

function addUserBubble(text, imageUrl) {
  const div = document.createElement('div');
  div.className = 'msg user';
  if (imageUrl) {
    const img = document.createElement('img');
    img.src = imageUrl;
    img.className = 'msg-thumb';
    div.appendChild(img);
  }
  const textSpan = document.createElement('div');
  textSpan.textContent = text;
  div.appendChild(textSpan);
  feedEl.appendChild(div);
  scrollToBottom();
}

function addAssistantBubble(steps, isFinal) {
  const div = document.createElement('div');
  div.className = 'msg assistant';

  // A "choices" step is a clarifying question (decision-paralysis handling) -
  // rendered as tappable buttons instead of a normal step line, and skips
  // the usual "Done" button since it's not a task step yet.
  const clarifyStep = steps.find(s => s.clarify);
  if (clarifyStep) {
    const q = document.createElement('div');
    q.textContent = clarifyStep.text;
    if (clarifyStep.choices && clarifyStep.choices.length) q.style.marginBottom = '10px';
    div.appendChild(q);
    if (clarifyStep.choices && clarifyStep.choices.length) {
      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex; flex-wrap:wrap; gap:8px;';
      clarifyStep.choices.forEach((choice) => {
        const cb = document.createElement('button');
        cb.className = 'done-btn';
        cb.textContent = choice;
        cb.onclick = () => {
          btnRow.querySelectorAll('button').forEach(b => b.disabled = true);
          awaitingClarification = false;
          sendMessage(`${currentGoal} - ${choice}`);
        };
        btnRow.appendChild(cb);
      });
      div.appendChild(btnRow);
    } else {
      // Open-ended clarifying question - user types their own answer in the main box.
      awaitingClarification = true;
    }
    feedEl.appendChild(div);
    scrollToBottom();
    return div;
  }
  awaitingClarification = false;

  steps.forEach((s) => {
    stepCounter += 1;
    const line = document.createElement('div');
    line.className = 'step-line';
    line.innerHTML = `<span class="step-num">${stepCounter}</span><span>${escapeHtml(s.text ?? '')}${s.time ? ` <i style="opacity:0.6">(${escapeHtml(s.time)})</i>` : ''}</span>`;
    div.appendChild(line);
  });
  if (!isFinal) {
    const btn = document.createElement('button');
    btn.className = 'done-btn';
    btn.textContent = "Done — what's next?";
    btn.onclick = () => handleDone(btn);
    div.appendChild(btn);
  } else {
    const note = document.createElement('div');
    note.className = 'done-note';
    note.textContent = "That's everything — nicely done!";
    div.appendChild(note);
  }
  feedEl.appendChild(div);
  scrollToBottom();
  return div;
}

// Renders headline + steps[] (caption.py shape) or headline + detail string (pdfqa.py shape)
function addAnswerBubble(headline, stepsOrDetail) {
  const div = document.createElement('div');
  div.className = 'msg assistant';
  const headlineEl = document.createElement('div');
  headlineEl.className = 'answer-headline';
  headlineEl.textContent = headline;
  div.appendChild(headlineEl);

  if (Array.isArray(stepsOrDetail) && stepsOrDetail.length > 0) {
    const detailEl = document.createElement('div');
    detailEl.className = 'answer-detail';
    stepsOrDetail.forEach((point) => {
      const line = document.createElement('div');
      line.className = 'point-line';
      line.innerHTML = `<span class="point-dot">•</span><span>${escapeHtml(point)}</span>`;
      detailEl.appendChild(line);
    });
    div.appendChild(detailEl);
  } else if (typeof stepsOrDetail === 'string' && stepsOrDetail.trim()) {
    const detailEl = document.createElement('div');
    detailEl.className = 'answer-detail';
    detailEl.textContent = stepsOrDetail;
    div.appendChild(detailEl);
  }
  feedEl.appendChild(div);
  scrollToBottom();
}

function flattenAnswer(headline, stepsOrDetail) {
  if (Array.isArray(stepsOrDetail)) return [headline, ...stepsOrDetail].join(' ').trim();
  return `${headline} ${stepsOrDetail || ''}`.trim();
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

async function callBackend(goal, resetTask) {
  if (resetTask) completedSteps = [];
  const res = await fetch(`${API}/decompose-task`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, reading_level: "simple", max_steps: 3, tone: "encouraging", completed_steps: completedSteps, history, session_note: currentSessionNote }),
  });
  if (!res.ok) throw new Error(`Server responded with ${res.status}`);
  return res.json();
}

async function sendMessage(text) {
  if (!text.trim()) return;
  await classifyAndSwitch(text); // may switch to/create a session by topic before this message is added
  addUserBubble(text);
  history.push({ role: "user", content: text });
  currentGoal = text;
  stepCounter = 0;
  setStatus('Thinking…');
  sendBtn.disabled = true;
  try {
    const data = await callBackend(text, true);
    const steps = data.steps || [];
    completedSteps = steps.map(s => s.text);
    addAssistantBubble(steps, data.is_final);
    if (!data.was_error) history.push({ role: "assistant", content: steps.map(s => s.text).join(' ') });
    snapshotCurrentSession();
    if (data.is_final) celebrateTaskDone();
    setStatus('');
  } catch (err) {
    setStatus("Couldn't reach the companion. Is the server running?", true);
  } finally { sendBtn.disabled = false; }
}

async function handleDone(btnEl) {
  btnEl.disabled = true;
  btnEl.textContent = "Getting the next steps…";
  setStatus('');
  try {
    const data = await callBackend(currentGoal, false);
    const newSteps = data.steps || [];
    completedSteps = completedSteps.concat(newSteps.map(s => s.text));
    btnEl.remove();
    addAssistantBubble(newSteps, data.is_final);
    if (!data.was_error) history.push({ role: "assistant", content: newSteps.map(s => s.text).join(' ') });
    celebrateStep();
    snapshotCurrentSession();
    if (data.is_final) celebrateTaskDone();
  } catch (err) {
    setStatus("Couldn't reach the companion.", true);
    btnEl.disabled = false;
    btnEl.textContent = "Done — what's next?";
  }
}

sendBtn.addEventListener('click', () => handleSendClick());
goalEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click(); }
});

const LiveRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let liveRecognition = null;

function startLiveCaptions() {
  if (!LiveRecognition) return;
  liveRecognition = new LiveRecognition();
  liveRecognition.continuous = true;
  liveRecognition.interimResults = true;
  liveRecognition.lang = 'en-US';
  liveRecognition.onresult = (event) => {
    let combined = '';
    for (let i = 0; i < event.results.length; i++) combined += event.results[i][0].transcript;
    goalEl.value = combined;
    goalEl.dispatchEvent(new Event('input'));
  };
  liveRecognition.onerror = () => {};
  try { liveRecognition.start(); } catch (e) {}
}
function stopLiveCaptions() {
  if (liveRecognition) { try { liveRecognition.stop(); } catch (e) {} liveRecognition = null; }
}

micBtn.addEventListener('click', async () => {
  if (!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      chunks = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = handleStop;
      mediaRecorder.start();
      startLiveCaptions();
      isRecording = true;
      micBtn.classList.add('recording');
      setStatus('Listening…');
    } catch (err) { setStatus('Could not access the microphone.', true); }
  } else {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(t => t.stop());
    stopLiveCaptions();
    isRecording = false;
    micBtn.classList.remove('recording');
    setStatus('Transcribing…');
  }
});

async function handleStop() {
  const blob = new Blob(chunks, { type: 'audio/webm' });
  const formData = new FormData();
  formData.append('file', blob, 'recording.webm');
  try {
    const res = await fetch(`${API}/transcribe`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('transcribe failed');
    const data = await res.json();
    setStatus('');
    if (data.text) { unlockBadge('voice', 'Voice Explorer'); goalEl.value = ''; goalEl.style.height = 'auto'; sendMessage(data.text); }
    else setStatus("Didn't catch that — try again.", true);
  } catch (err) { setStatus('Could not transcribe that recording.', true); }
}

const camBtn = document.getElementById('camBtn');
const camMenu = document.getElementById('camMenu');
const camChooseBtn = document.getElementById('camChooseBtn');
const camTakeBtn = document.getElementById('camTakeBtn');
const camInputLibrary = document.getElementById('camInputLibrary');
const camInputCamera = document.getElementById('camInputCamera');
const attachPreview = document.getElementById('attachPreview');
const attachThumb = document.getElementById('attachThumb');
const attachRemoveBtn = document.getElementById('attachRemoveBtn');

let currentCameraSource = localStorage.getItem('companion_cam_source') || 'webcam';
const btnSrcWebcam = document.getElementById('btnSrcWebcam');
const btnSrcIp = document.getElementById('btnSrcIp');
const btnIpSettings = document.getElementById('btnIpSettings');
const camMenuSourceLabel = document.getElementById('camMenuSourceLabel');
const camMenuSwitchBtn = document.getElementById('camMenuSwitchBtn');
const liveSrcWebcam = document.getElementById('liveSrcWebcam');
const liveSrcIp = document.getElementById('liveSrcIp');
const liveCamIpImg = document.getElementById('liveCamIpImg');
const snapSrcWebcam = document.getElementById('snapSrcWebcam');
const snapSrcIp = document.getElementById('snapSrcIp');
const snapIpImg = document.getElementById('snapIpImg');
const ipSettingsModal = document.getElementById('ipSettingsModal');
const ipCameraUrlInput = document.getElementById('ipCameraUrlInput');
const ipSettingsCancelBtn = document.getElementById('ipSettingsCancelBtn');
const ipSettingsSaveBtn = document.getElementById('ipSettingsSaveBtn');

let ipPollIntervalId = null;
function startIpImgPolling(imgEl) {
  stopIpImgPolling();
  ipPollIntervalId = setInterval(() => { imgEl.src = `${API}/camera/frame?t=${Date.now()}`; }, 200);
}
function stopIpImgPolling() {
  if (ipPollIntervalId) { clearInterval(ipPollIntervalId); ipPollIntervalId = null; }
}

function setCameraSource(source) {
  currentCameraSource = source;
  localStorage.setItem('companion_cam_source', source);
  const isWebcam = source === 'webcam';
  btnSrcWebcam && btnSrcWebcam.classList.toggle('active', isWebcam);
  btnSrcIp && btnSrcIp.classList.toggle('active', !isWebcam);
  liveSrcWebcam && liveSrcWebcam.classList.toggle('active', isWebcam);
  liveSrcIp && liveSrcIp.classList.toggle('active', !isWebcam);
  snapSrcWebcam && snapSrcWebcam.classList.toggle('active', isWebcam);
  snapSrcIp && snapSrcIp.classList.toggle('active', !isWebcam);
  if (camMenuSourceLabel) camMenuSourceLabel.textContent = isWebcam ? 'Webcam' : 'IP Camera';
  if (camMenuSwitchBtn) camMenuSwitchBtn.textContent = isWebcam ? 'Use IP Cam' : 'Use Webcam';
  if (snapOverlay && snapOverlay.classList.contains('active')) startSnapCapture();
  if (liveCamOverlay && liveCamOverlay.classList.contains('active')) startGuidedSearch();
}

btnSrcWebcam.addEventListener('click', () => setCameraSource('webcam'));
btnSrcIp.addEventListener('click', () => setCameraSource('ipcamera'));
liveSrcWebcam.addEventListener('click', () => setCameraSource('webcam'));
liveSrcIp.addEventListener('click', () => setCameraSource('ipcamera'));
snapSrcWebcam.addEventListener('click', () => setCameraSource('webcam'));
snapSrcIp.addEventListener('click', () => setCameraSource('ipcamera'));
camMenuSwitchBtn.addEventListener('click', () => setCameraSource(currentCameraSource === 'webcam' ? 'ipcamera' : 'webcam'));

const headerIpDot = document.getElementById('headerIpDot');
const ipModalDot = document.getElementById('ipModalDot');
const ipModalStatusText = document.getElementById('ipModalStatusText');
const ipTestBtn = document.getElementById('ipTestBtn');

async function checkCameraStatus() {
  try {
    const res = await fetch(`${API}/camera/status`);
    if (res.ok) {
      const data = await res.json();
      if (data.url && ipCameraUrlInput && document.activeElement !== ipCameraUrlInput) ipCameraUrlInput.value = data.url;
      const isConnected = !!data.connected;
      const color = isConnected ? '#2ed573' : '#ff4757';
      if (headerIpDot) { headerIpDot.style.background = color; headerIpDot.title = isConnected ? `IP Camera connected (${data.url})` : 'IP Camera offline'; }
      if (ipModalDot) ipModalDot.style.background = color;
      if (ipModalStatusText) {
        ipModalStatusText.textContent = isConnected ? `🟢 Connected (Active feed)` : `🔴 ${data.message || 'Offline or waiting for stream'}`;
        ipModalStatusText.style.color = color;
      }
      return data;
    }
  } catch (e) {
    if (headerIpDot) headerIpDot.style.background = '#777';
    if (ipModalDot) ipModalDot.style.background = '#777';
    if (ipModalStatusText) { ipModalStatusText.textContent = 'Backend offline or unreachable'; ipModalStatusText.style.color = 'var(--ink-muted)'; }
  }
  return null;
}
checkCameraStatus();
setInterval(checkCameraStatus, 8000);

btnIpSettings.addEventListener('click', () => { ipSettingsModal.classList.add('active'); checkCameraStatus(); ipCameraUrlInput.focus(); });
ipSettingsCancelBtn.addEventListener('click', () => ipSettingsModal.classList.remove('active'));

if (ipTestBtn) {
  ipTestBtn.addEventListener('click', async () => {
    ipTestBtn.disabled = true; ipTestBtn.textContent = 'Testing…';
    const status = await checkCameraStatus();
    ipTestBtn.disabled = false; ipTestBtn.textContent = '⚡ Test Status';
    if (status && status.connected) setStatus('IP Camera stream verified active!');
    else setStatus('IP Camera offline. Check phone app or IP address.', true);
  });
}

ipSettingsSaveBtn.addEventListener('click', async () => {
  const newUrl = ipCameraUrlInput.value.trim();
  if (!newUrl) return;
  setStatus('Connecting to IP Camera…');
  ipSettingsSaveBtn.disabled = true; ipSettingsSaveBtn.textContent = 'Connecting…';
  try {
    const res = await fetch(`${API}/camera/set-url`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: newUrl }) });
    if (res.ok) {
      const data = await res.json();
      ipCameraUrlInput.value = data.url;
      setCameraSource('ipcamera');
      await checkCameraStatus();
      setStatus(data.connected ? 'IP Camera connected successfully.' : 'IP Camera URL saved. Reconnecting in background…');
    } else setStatus('Failed to update IP Camera URL.', true);
  } catch (err) { setStatus('Could not reach backend.', true); }
  finally { ipSettingsSaveBtn.disabled = false; ipSettingsSaveBtn.textContent = 'Save & Connect'; ipSettingsModal.classList.remove('active'); }
});

let pendingImageFile = null, pendingImageUrl = null;

camBtn.addEventListener('click', (e) => { e.stopPropagation(); camMenu.classList.toggle('open'); });
document.addEventListener('click', () => camMenu.classList.remove('open'));
camChooseBtn.addEventListener('click', () => { camMenu.classList.remove('open'); camInputLibrary.click(); });
camTakeBtn.addEventListener('click', () => { camMenu.classList.remove('open'); startSnapCapture(); });
document.getElementById('camGuideBtn').addEventListener('click', () => { camMenu.classList.remove('open'); startGuidedSearch(); });

const snapOverlay = document.getElementById('snapOverlay');
const snapVideo = document.getElementById('snapVideo');
const snapCaptureBtn = document.getElementById('snapCaptureBtn');
const snapCancelBtn = document.getElementById('snapCancelBtn');
const snapHint = document.getElementById('snapHint');
let snapStream = null;

async function startSnapCapture() {
  if (currentCameraSource === 'webcam') {
    stopIpImgPolling();
    snapIpImg.style.display = 'none'; snapIpImg.src = '';
    snapVideo.style.display = 'block';
    snapHint.textContent = 'Point your webcam, then capture';
    try {
      if (!snapStream) snapStream = await navigator.mediaDevices.getUserMedia({ video: true });
      snapVideo.srcObject = snapStream;
      snapOverlay.classList.add('active');
    } catch (err) { setStatus('Could not access the webcam.', true); }
  } else {
    if (snapStream) { snapStream.getTracks().forEach(t => t.stop()); snapStream = null; }
    snapVideo.style.display = 'none';
    snapIpImg.style.display = 'block';
    snapHint.textContent = 'Point your IP Camera, then capture';
    snapOverlay.classList.add('active');
    startIpImgPolling(snapIpImg);
  }
}
function stopSnapCapture() {
  if (snapStream) { snapStream.getTracks().forEach(t => t.stop()); snapStream = null; }
  stopIpImgPolling(); snapIpImg.src = ''; snapOverlay.classList.remove('active');
}
snapCancelBtn.addEventListener('click', stopSnapCapture);

snapCaptureBtn.addEventListener('click', async () => {
  if (currentCameraSource === 'webcam') {
    const canvas = document.createElement('canvas');
    canvas.width = snapVideo.videoWidth; canvas.height = snapVideo.videoHeight;
    canvas.getContext('2d').drawImage(snapVideo, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], 'webcam-photo.jpg', { type: 'image/jpeg' });
      pendingImageFile = file; pendingImageUrl = URL.createObjectURL(blob);
      attachThumb.src = pendingImageUrl; attachPreview.classList.add('active');
      goalEl.placeholder = "Ask something about this photo…";
      stopSnapCapture(); goalEl.focus();
    }, 'image/jpeg', 0.85);
  } else {
    setStatus('Capturing from IP Camera…');
    try {
      const res = await fetch(`${API}/camera/frame?t=${Date.now()}`);
      if (!res.ok) throw new Error('Could not retrieve frame');
      const blob = await res.blob();
      const file = new File([blob], 'ipcam-photo.jpg', { type: 'image/jpeg' });
      pendingImageFile = file; pendingImageUrl = URL.createObjectURL(blob);
      attachThumb.src = pendingImageUrl; attachPreview.classList.add('active');
      goalEl.placeholder = "Ask something about this photo…";
      stopSnapCapture(); goalEl.focus(); setStatus('');
    } catch (err) { setStatus('Could not capture frame from IP Camera. Check if stream is active.', true); }
  }
});

camInputLibrary.addEventListener('change', () => attachPhoto(camInputLibrary));
camInputCamera.addEventListener('change', () => attachPhoto(camInputCamera));

function attachPhoto(inputEl) {
  const file = inputEl.files[0];
  inputEl.value = '';
  if (!file) return;
  clearDocumentAttachment();
  pendingImageFile = file; pendingImageUrl = URL.createObjectURL(file);
  attachThumb.src = pendingImageUrl; attachPreview.classList.add('active');
  goalEl.placeholder = "Ask something about this photo…";
  goalEl.focus();
}
attachRemoveBtn.addEventListener('click', () => clearAttachment());
function clearAttachment() {
  pendingImageFile = null;
  if (pendingImageUrl) URL.revokeObjectURL(pendingImageUrl);
  pendingImageUrl = null;
  attachPreview.classList.remove('active');
  goalEl.placeholder = "Type or speak — e.g. how do I make biryani";
}

const camDocBtn = document.getElementById('camDocBtn');
const docInput = document.getElementById('docInput');
const docAttachPreview = document.getElementById('docAttachPreview');
const docAttachLabel = document.getElementById('docAttachLabel');
const docAttachRemoveBtn = document.getElementById('docAttachRemoveBtn');
let pendingDocumentId = null, pendingDocumentName = null;

camDocBtn.addEventListener('click', () => { camMenu.classList.remove('open'); docInput.click(); });

docInput.addEventListener('change', async () => {
  const file = docInput.files[0];
  docInput.value = '';
  if (!file) return;
  clearAttachment();
  setStatus('Reading document…');
  sendBtn.disabled = true;
  const formData = new FormData();
  formData.append('file', file, file.name);
  try {
    const res = await fetch(`${API}/upload-document`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('upload failed');
    const data = await res.json();
    pendingDocumentId = data.document_id; pendingDocumentName = data.filename;
    docAttachLabel.textContent = `${data.filename} attached — ask a question and hit Send`;
    docAttachPreview.classList.add('active');
    goalEl.placeholder = "Ask something about this document…";
    goalEl.focus();
    setStatus(data.truncated ? 'Document is quite long - only the first part was used.' : '');
  } catch (err) { setStatus('Could not read that document. Is the server running?', true); }
  finally { sendBtn.disabled = false; }
});

docAttachRemoveBtn.addEventListener('click', () => clearDocumentAttachment());
function clearDocumentAttachment() {
  pendingDocumentId = null; pendingDocumentName = null;
  docAttachPreview.classList.remove('active');
  goalEl.placeholder = "Type or speak — e.g. how do I make biryani";
}

function handleSendClick() {
  const text = goalEl.value.trim();
  if (awaitingClarification && text && !pendingDocumentId && !pendingImageFile) {
    awaitingClarification = false;
    goalEl.value = ''; goalEl.style.height = 'auto';
    sendMessage(`${currentGoal} - ${text}`);
    return;
  }
  if (pendingDocumentId) {
    const question = text || "Can you explain what this document is about?";
    goalEl.value = ''; goalEl.style.height = 'auto';
    askDocument(question);
  } else if (pendingImageFile) {
    const question = text || "What's in this photo?";
    goalEl.value = ''; goalEl.style.height = 'auto';
    sendImageMessage(pendingImageFile, pendingImageUrl, question);
    clearAttachment();
  } else {
    if (!text) return;
    goalEl.value = ''; goalEl.style.height = 'auto';
    sendMessage(text);
  }
}

async function askDocument(question) {
  unlockBadge('doc', 'Bookworm');
  addUserBubble(`📄 ${question}`);
  history.push({ role: "user", content: question });
  setStatus('Reading through the document…');
  sendBtn.disabled = true;
  try {
    const res = await fetch(`${API}/ask-document`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_id: pendingDocumentId, question }),
    });
    if (!res.ok) throw new Error('ask-document failed');
    const data = await res.json();
    addAnswerBubble(data.headline, data.detail);
    history.push({ role: "assistant", content: flattenAnswer(data.headline, data.detail) });
    setStatus('');
  } catch (err) { setStatus('Could not answer from the document. Is the server running?', true); }
  finally { sendBtn.disabled = false; }
}

async function sendImageMessage(file, imageUrl, question) {
  unlockBadge('photo', 'Photo Detective');
  addUserBubble(question, imageUrl);
  history.push({ role: "user", content: question });
  setStatus('Looking at the photo…');
  sendBtn.disabled = true;
  const formData = new FormData();
  formData.append('file', file, file.name || 'photo.jpg');
  formData.append('question', question);
  formData.append('history', JSON.stringify(history.slice(-8)));
  try {
    const res = await fetch(`${API}/caption-image`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('caption failed');
    const data = await res.json();
    addAnswerBubble(data.headline, data.steps);
    history.push({ role: "assistant", content: flattenAnswer(data.headline, data.steps) });
    setStatus('');
  } catch (err) { setStatus('Could not process that photo. Is the server running?', true); }
  finally { sendBtn.disabled = false; }
}

const liveCamOverlay = document.getElementById('liveCamOverlay');
const liveCamVideo = document.getElementById('liveCamVideo');
const liveCamAnswer = document.getElementById('liveCamAnswer');
const liveCamGoal = document.getElementById('liveCamGoal');
const liveCamSendBtn = document.getElementById('liveCamSendBtn');
const liveCamMicBtn = document.getElementById('liveCamMicBtn');
const liveCamCloseBtn = document.getElementById('liveCamCloseBtn');
const ambientToggleBtn = document.getElementById('ambientToggleBtn');
let liveCamStream = null;

async function startGuidedSearch() {
  unlockBadge('live', 'Live Explorer');
  if (currentCameraSource === 'webcam') {
    stopIpImgPolling();
    liveCamIpImg.style.display = 'none'; liveCamIpImg.src = '';
    liveCamVideo.style.display = 'block';
    try {
      if (!liveCamStream) liveCamStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      liveCamVideo.srcObject = liveCamStream;
      liveCamOverlay.classList.add('active');
      setLiveCamAnswer("Webcam active. Point at anything and ask a question below.");
      speak("Hi! Welcome! Love to see you here! Point your webcam at anything and ask a question below.");
      liveCamGoal.value = ''; liveCamGoal.focus();
    } catch (err) { setStatus('Could not access the webcam.', true); }
  } else {
    if (liveCamStream) { liveCamStream.getTracks().forEach(t => t.stop()); liveCamStream = null; }
    liveCamVideo.style.display = 'none';
    liveCamIpImg.style.display = 'block';
    liveCamOverlay.classList.add('active');
    setLiveCamAnswer("IP Camera active. Point your phone at anything and ask a question below.");
    speak("Hi! Welcome!");
    liveCamGoal.value = ''; liveCamGoal.focus();
    startIpImgPolling(liveCamIpImg);
  }
}

function stopLiveCam() {
  if (liveCamStream) { liveCamStream.getTracks().forEach(t => t.stop()); liveCamStream = null; }
  stopIpImgPolling(); stopAmbientMode();
  liveCamIpImg.src = '';
  liveCamOverlay.classList.remove('active');
  window.speechSynthesis && window.speechSynthesis.cancel();
}
liveCamCloseBtn.addEventListener('click', stopLiveCam);

// Voices load asynchronously in most browsers - cache them once ready.
let cachedVoices = [];
function refreshVoices() { cachedVoices = window.speechSynthesis.getVoices(); }
if (window.speechSynthesis) {
  refreshVoices();
  window.speechSynthesis.onvoiceschanged = refreshVoices;
}

function pickFemaleVoice() {
  const pattern = /female|zira|samantha|susan|karen|moira|tessa|victoria|google us english|google uk english female/i;
  return cachedVoices.find(v => pattern.test(v.name));
}

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1.0;
  const female = pickFemaleVoice();
  if (female) utter.voice = female;
  window.speechSynthesis.speak(utter);
}

function setLiveCamAnswer(text, isThinking = false) {
  liveCamAnswer.textContent = text;
  liveCamAnswer.classList.toggle('thinking', isThinking);
}

async function captureCurrentFrame() {
  if (currentCameraSource === 'webcam') {
    if (!liveCamStream) return null;
    const canvas = document.createElement('canvas');
    canvas.width = liveCamVideo.videoWidth; canvas.height = liveCamVideo.videoHeight;
    canvas.getContext('2d').drawImage(liveCamVideo, 0, 0);
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.8));
  } else {
    try {
      const res = await fetch(`${API}/camera/frame?t=${Date.now()}`);
      if (!res.ok) return null;
      return await res.blob();
    } catch (e) { return null; }
  }
}

async function askLiveCamera() {
  const question = liveCamGoal.value.trim();
  if (!question) return;
  liveCamGoal.value = '';
  setLiveCamAnswer("Thinking", true);
  liveCamSendBtn.disabled = true;

  const blob = await captureCurrentFrame();
  if (!blob) {
    setLiveCamAnswer(currentCameraSource === 'webcam' ? "Couldn't grab a frame - try again." : "Camera frame not available. Please check that your IP Webcam stream is active.");
    liveCamSendBtn.disabled = false;
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
      speak("Camera frame not available.");
    } else {
      const fullAnswer = flattenAnswer(data.headline, data.steps);
      setLiveCamAnswer(fullAnswer);
      speak(data.headline);
      history.push({ role: "user", content: question });
      history.push({ role: "assistant", content: fullAnswer });
    }
  } catch (err) { setLiveCamAnswer("Couldn't reach the companion - try again."); }
  finally { liveCamSendBtn.disabled = false; }
}

liveCamSendBtn.addEventListener('click', askLiveCamera);
liveCamGoal.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askLiveCamera(); }
});

liveCamMicBtn.addEventListener('click', async () => {
  if (!LiveRecognition) { setStatus('Voice input not supported in this browser.', true); return; }
  const rec = new LiveRecognition();
  rec.lang = 'en-US'; rec.interimResults = true;
  rec.onresult = (event) => {
    let combined = '';
    for (let i = 0; i < event.results.length; i++) combined += event.results[i][0].transcript;
    liveCamGoal.value = combined;
  };
  liveCamMicBtn.classList.add('recording');
  rec.onend = () => { liveCamMicBtn.classList.remove('recording'); if (liveCamGoal.value.trim()) askLiveCamera(); };
  try { rec.start(); } catch (e) {}
});

let ambientIntervalId = null, ambientRunning = false;
ambientToggleBtn.addEventListener('click', () => { ambientRunning ? stopAmbientMode() : startAmbientMode(); });

function startAmbientMode() {
  ambientRunning = true;
  ambientToggleBtn.classList.add('active');
  describeSceneOnce();
  ambientIntervalId = setInterval(describeSceneOnce, 6000);
}
function stopAmbientMode() {
  ambientRunning = false;
  ambientToggleBtn.classList.remove('active');
  if (ambientIntervalId) { clearInterval(ambientIntervalId); ambientIntervalId = null; }
}

async function describeSceneOnce() {
  const blob = await captureCurrentFrame();
  if (!blob) return;
  const formData = new FormData();
  formData.append('file', blob, 'frame.jpg');
  formData.append('question', "Briefly describe what you currently see, in one short sentence.");
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


// --- GAMIFICATION MODULE ---
const GAMIFY_KEY = 'companion_gamify';
function loadGamify() {
  try { return JSON.parse(localStorage.getItem(GAMIFY_KEY)) || defaultGamify(); }
  catch (e) { return defaultGamify(); }
}
function defaultGamify() { return { totalSteps: 0, streak: 0, lastActiveDate: null, plantStage: 0, badges: [] }; }
function saveGamify(g) { localStorage.setItem(GAMIFY_KEY, JSON.stringify(g)); }

const PLANT_STAGES = ['🌱', '🌿', '🪴', '🌳', '🌸'];
const ENCOURAGEMENTS = ["Nice one!", "You're on a roll!", "Great job!", "Keep it up!", "That's the way!"];

function celebrateStep() {
  const g = loadGamify();
  g.totalSteps += 1;
  g.plantStage = Math.min(4, Math.floor(g.totalSteps / 5));
  updateStreak(g);
  saveGamify(g);
  showToast(`${ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]} ${PLANT_STAGES[g.plantStage]}`);
  renderGamifyBar();
}
function celebrateTaskDone() { showToast("🎉 Task complete — nicely done!", true); }

function updateStreak(g) {
  const today = new Date().toDateString();
  if (g.lastActiveDate === today) return;
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  g.streak = (g.lastActiveDate === yesterday) ? g.streak + 1 : 1;
  g.lastActiveDate = today;
}

function unlockBadge(name, label) {
  const g = loadGamify();
  if (g.badges.includes(name)) return;
  g.badges.push(name);
  saveGamify(g);
  showToast(`🏅 New badge: ${label}`, true);
}

function showToast(msg, big = false) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `position:fixed; bottom:100px; left:50%; transform:translateX(-50%);
    background:${big ? 'var(--amber)' : 'var(--moss)'}; color:#1a1a1a; padding:10px 18px;
    border-radius:999px; font-weight:700; font-size:14px;
    z-index:300; animation:rise 0.3s ease; box-shadow:0 6px 20px rgba(0,0,0,0.4);`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

function renderGamifyBar() {
  const g = loadGamify();
  const bar = document.getElementById('gamifyBar');
  if (bar) bar.textContent = `${PLANT_STAGES[g.plantStage]} ${g.totalSteps} steps · 🔥 ${g.streak} day streak`;
}
renderGamifyBar();

setCameraSource(currentCameraSource);
