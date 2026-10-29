// microphone (auto-stop), live captions, read aloud

const LiveRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let liveRecognition = null;

// live words under the input box while you speak (shown only in the little ticker, never put in the text box)
function startLiveCaptions() {
  if (!LiveRecognition) return;
  stopLiveCaptions();
  const rec = new LiveRecognition();
  liveRecognition = rec;
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = currentLang().bcp;
  if (liveTicker) liveTicker.style.display = 'flex';
  if (liveTickerText) liveTickerText.textContent = 'Listening…';
  rec.onresult = (event) => {
    if (rec !== liveRecognition) return;            // ignore late results from an earlier recording
    let combined = '';
    for (let i = 0; i < event.results.length; i++) combined += event.results[i][0].transcript;
    if (liveTickerText) liveTickerText.textContent = combined || 'Listening…';
  };
  rec.onerror = () => {};
  try { rec.start(); } catch (e) {}
}

function stopLiveCaptions() {
  const rec = liveRecognition;
  liveRecognition = null;
  if (liveTicker) liveTicker.style.display = 'none';
  if (rec) {
    rec.onresult = null; rec.onend = null;
    try { rec.abort(); } catch (e) {}               // abort() drops pending results; stop() lets them arrive late
  }
}

const MIC_SILENCE_MS = 1500;     // stop this long after you stop talking
const MIC_NO_SPEECH_MS = 6000;   // give up if nothing is said at all
const MIC_MAX_MS = 45000;        // hard limit for one message
const MIC_MIN_VOICE_MS = 350;    // less speech than this counts as "nothing"
let micSession = null;
let micBusy = false;

async function startMic() {
  if (micSession || micBusy) return;
  if (window.speechSynthesis) window.speechSynthesis.cancel();   // never record our own voice
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (err) {
    setStatus('Microphone access denied.', true);
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const rec = new MediaRecorder(stream);
  const s = { stream, ctx, rec, chunks: [], t0: Date.now(), lastVoice: 0, voiceMs: 0, noise: [], thr: null, hadSpeech: false, timer: null };
  micSession = s;
  rec.ondataavailable = (e) => { if (e.data && e.data.size) s.chunks.push(e.data); };
  rec.onstop = () => finishMic(s);
  rec.start();
  startLiveCaptions();
  isRecording = true;
  if (micBtn) micBtn.classList.add('recording');
  setStatus('Listening… just stop talking when you are done.');
  const buf = new Uint8Array(analyser.fftSize);
  s.timer = setInterval(() => {
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) { const x = (buf[i] - 128) / 128; sum += x * x; }
    const level = Math.sqrt(sum / buf.length);
    const now = Date.now(), elapsed = now - s.t0;
    if (elapsed < 500) { s.noise.push(level); return; }          // first half second: learn the room's background noise
    if (s.thr === null) {
      const avg = s.noise.length ? s.noise.reduce((a, b) => a + b, 0) / s.noise.length : 0;
      s.thr = Math.min(0.06, Math.max(0.025, avg * 3));
    }
    if (level > s.thr) { s.lastVoice = now; s.voiceMs += 80; }
    const heard = s.voiceMs >= MIC_MIN_VOICE_MS;
    if (heard && now - s.lastVoice > MIC_SILENCE_MS) stopMic();
    else if (!heard && elapsed > MIC_NO_SPEECH_MS) stopMic();
    else if (elapsed > MIC_MAX_MS) stopMic();
  }, 80);
}

function stopMic() {
  const s = micSession;
  if (!s) return;
  micSession = null;
  clearInterval(s.timer);
  s.hadSpeech = s.voiceMs >= MIC_MIN_VOICE_MS;
  isRecording = false;
  if (micBtn) micBtn.classList.remove('recording');
  stopLiveCaptions();
  try { if (s.rec.state !== 'inactive') s.rec.stop(); } catch (e) { finishMic(s); }
  s.stream.getTracks().forEach(t => t.stop());
  try { s.ctx.close(); } catch (e) {}
}

async function finishMic(s) {
  if (s.done) return;
  s.done = true;
  if (!s.hadSpeech || !s.chunks.length) {            // silence: do NOT send anything to the server
    setStatus("I didn't hear anything. Tap the mic and try again.", true);
    return;
  }
  micBusy = true;
  if (micBtn) micBtn.disabled = true;
  setStatus('Turning your voice into text…');
  const blob = new Blob(s.chunks, { type: s.rec.mimeType || 'audio/webm' });
  const formData = new FormData();
  formData.append('file', blob, 'recording.webm');
  formData.append('language', currentLangCode());
  formData.append('vocab', sttVocab());
  try {
    const res = await fetch(`${API}/transcribe`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('transcribe failed');
    const data = await res.json();
    setStatus('');
    if (data.text && data.text.trim()) {
      unlockBadge('voice', 'Voice Explorer');
      if (goalEl) { goalEl.value = ''; goalEl.style.height = 'auto'; }
      sendMessage(data.text);
    } else {
      setStatus("Did not catch that. Please try again.", true);
    }
  } catch (err) {
    console.error('Audio transcription error:', err);
    setStatus('Could not understand the audio. Please try again.', true);
  } finally {
    micBusy = false;
    if (micBtn) micBtn.disabled = false;
  }
}

if (micBtn) {
  micBtn.addEventListener('click', () => {
    if (micBusy) return;
    micSession ? stopMic() : startMic();             // tap again to stop early
  });
}

function refreshVoices() {
  if (window.speechSynthesis) {
    cachedVoices = window.speechSynthesis.getVoices();
  }
}
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

// the person's own medicine names, sent with the audio so Whisper spells them right (names only, no doses or readings)
function sttVocab() {
  try { return hlMeds().filter(m => m.active).map(m => m.name).slice(0, 15).join(', '); } catch (e) { return ''; }
}