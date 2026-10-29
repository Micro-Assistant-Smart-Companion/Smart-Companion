const VL_T = {
  en: { greet: 'Voice mode is on. I am listening. Say what you need, or say: what can I say.', press: 'Voice mode is ready. Press any key or tap the screen to start.',
        blocked: 'The microphone is blocked. Please allow the microphone in your browser, then reload.', sorry: 'Sorry, I could not understand that. Please say it again.',
        stays: 'Voice mode stays on for you. To switch it off, say: switch to standard mode.', ask: 'Switch to the standard screen and turn voice mode off? Say yes or no.',
        done: 'Okay. Switched to the standard screen.', kept: 'Okay. Voice mode stays on.' },
  hi: { greet: 'वॉइस मोड चालू है। मैं सुन रहा हूँ। बताइए आपको क्या चाहिए, या बोलिए: मैं क्या बोल सकता हूँ।', press: 'वॉइस मोड तैयार है। शुरू करने के लिए कोई भी कुंजी दबाएँ या स्क्रीन छुएँ।',
        blocked: 'माइक्रोफ़ोन बंद है। कृपया ब्राउज़र में माइक्रोफ़ोन की अनुमति दें और पेज दोबारा खोलें।', sorry: 'माफ़ कीजिए, मैं समझ नहीं पाया। कृपया दोबारा बोलिए।',
        stays: 'आपके लिए वॉइस मोड चालू रहता है। बंद करने के लिए बोलिए: सामान्य मोड पर जाओ।', ask: 'सामान्य स्क्रीन पर जाकर वॉइस मोड बंद कर दूँ? हाँ या नहीं बोलिए।',
        done: 'ठीक है। सामान्य स्क्रीन चालू हो गई।', kept: 'ठीक है। वॉइस मोड चालू रहेगा।' },
  bn: { greet: 'ভয়েস মোড চালু আছে। আমি শুনছি। কী দরকার বলুন, অথবা বলুন: আমি কী বলতে পারি।', press: 'ভয়েস মোড তৈরি। শুরু করতে যেকোনো কী চাপুন বা পর্দা ছুঁয়ে দিন।',
        blocked: 'মাইক্রোফোন বন্ধ আছে। অনুগ্রহ করে ব্রাউজারে মাইক্রোফোনের অনুমতি দিন এবং পেজটি আবার খুলুন।', sorry: 'দুঃখিত, আমি বুঝতে পারিনি। অনুগ্রহ করে আবার বলুন।',
        stays: 'আপনার জন্য ভয়েস মোড চালু থাকে। বন্ধ করতে বলুন: সাধারণ মোডে যাও।', ask: 'সাধারণ পর্দায় গিয়ে ভয়েস মোড বন্ধ করব? হ্যাঁ বা না বলুন।',
        done: 'ঠিক আছে। সাধারণ পর্দা চালু হয়েছে।', kept: 'ঠিক আছে। ভয়েস মোড চালু থাকবে।' }
};
const vlT = () => VL_T[(typeof currentLangCode === 'function' && currentLangCode()) || 'en'] || VL_T.en;

const VL_STANDARD = /switch to standard mode|standard mode|सामान्य मोड|সাধারণ মোড/;
const VL = {
  on: false, starting: false, stream: null, ctx: null, proc: null, src: null, mute: null,
  floor: 0.006, pre: [], utt: null, hot: 0, lastSorry: 0, armed: false, queue: Promise.resolve()
};
const VL_BLOCK = 2048, VL_PRE_MS = 700, VL_END_MS = 1000, VL_MIN_VOICED_MS = 260, VL_MAX_MS = 30000;
const vlBlind = () => !!(typeof acGet === 'function' && acGet() && acGet().blind);

// remember what the assistant said, so its own voice is never mistaken for the user
const vlSaid = [];
if (typeof speak === 'function') {
  const _vlSpeak = speak;
  speak = function (text) { try { vlSaid.push({ t: vfNorm(text), at: Date.now() }); if (vlSaid.length > 12) vlSaid.shift(); } catch (e) {} return _vlSpeak.apply(this, arguments); };
}
function vlIsEcho(text, barge) {
  // Only something that started while the assistant was speaking can be its own voice, and only a long,
  // near-exact copy counts. A short answer like "twice a day" is NOT an echo, even though the question contained those words.
  if (!barge) return false;
  const w = vfNorm(text).split(' ').filter(Boolean);
  if (w.length < 6) return false;
  const said = vlSaid.filter(x => Date.now() - x.at < 90000).map(x => x.t).join(' ');
  return !!said && w.filter(x => said.includes(x)).length / w.length >= 0.8;
}

// ---------- turning the listener on and off ----------
async function vlStart() {
  if (VL.on || VL.starting) return;
  VL.starting = true;
  try {
    VL.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const AC = window.AudioContext || window.webkitAudioContext;
    VL.ctx = new AC();
    if (VL.ctx.state === 'suspended') { try { await VL.ctx.resume(); } catch (e) {} }
    VL.src = VL.ctx.createMediaStreamSource(VL.stream);
    VL.proc = VL.ctx.createScriptProcessor(VL_BLOCK, 1, 1);
    VL.mute = VL.ctx.createGain(); VL.mute.gain.value = 0;           // the processor must be connected, but we do not play the mic back
    VL.proc.onaudioprocess = vlBlock;
    VL.src.connect(VL.proc); VL.proc.connect(VL.mute); VL.mute.connect(VL.ctx.destination);
    VL.on = true; VL.pre = []; VL.utt = null; VL.hot = 0;
    const b = document.getElementById('vfBtn'); if (b) b.classList.add('listening');
    return true;
  } catch (e) {
    console.error('listener', e);
    if (typeof vfMicFailed !== 'undefined') vfMicFailed = true;
    try { setStatus(vlT().blocked, true); speak(vlT().blocked); } catch (x) {}
  } finally { VL.starting = false; }
}
function vlStop() {
  VL.on = false; VL.utt = null; VL.pre = [];
  try { if (VL.proc) { VL.proc.onaudioprocess = null; VL.proc.disconnect(); } } catch (e) {}
  try { if (VL.src) VL.src.disconnect(); } catch (e) {}
  try { if (VL.stream) VL.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
  try { if (VL.ctx) VL.ctx.close(); } catch (e) {}
  VL.stream = VL.ctx = VL.proc = VL.src = VL.mute = null;
  const b = document.getElementById('vfBtn'); if (b) b.classList.remove('listening');
}
function vlEnsure() { if (vfOn && !VL.on && !VL.starting) vlStart(); }

// ---------- listening ----------
function vlBlock(ev) {
  if (!VL.on) return;
  const data = ev.inputBuffer.getChannelData(0), n = data.length, ms = n / VL.ctx.sampleRate * 1000;
  let sum = 0; for (let i = 0; i < n; i++) sum += data[i] * data[i];
  const rms = Math.sqrt(sum / n), copy = new Float32Array(data);     // the browser reuses its buffer
  const talking = typeof vfIsSpeaking === 'function' && vfIsSpeaking();
  const thr = Math.max(0.018, VL.floor * 4) * (talking ? 2.2 : 1);   // higher while the assistant speaks, so its echo does not count
  const voice = rms > thr;

  if (!VL.utt) {
    if (!voice) VL.floor = Math.min(0.05, Math.max(0.003, VL.floor * 0.98 + rms * 0.02));
    VL.pre.push(copy); while (VL.pre.length * ms > VL_PRE_MS) VL.pre.shift();
    VL.hot = voice ? VL.hot + 1 : 0;
    const need = talking ? Math.ceil(300 / ms) : Math.ceil(120 / ms);
    if (VL.hot >= need) {
      VL.utt = { chunks: VL.pre.slice(), voicedMs: VL.hot * ms, silentMs: 0, totalMs: 0, ms, barge: talking, rate: VL.ctx.sampleRate };
      VL.pre = []; VL.hot = 0;
      if (talking) vlBarge();
    }
    return;
  }
  const u = VL.utt;
  u.chunks.push(copy); u.totalMs += ms;
  if (voice) { u.voicedMs += ms; u.silentMs = 0; } else u.silentMs += ms;
  if (u.silentMs >= VL_END_MS || u.totalMs >= VL_MAX_MS) { VL.utt = null; vlFinish(u); }
}
// the user started talking over the assistant: stop it now
function vlBarge() {
  try {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (typeof stopServerAudio === 'function') stopServerAudio();
    if (typeof vfRunId !== 'undefined') vfRunId++;                   // also ends the rest of a queued answer
    if (typeof vgSt !== 'undefined' && vgSt) clearTimeout(vgSt.timer);   // do not re-ask while they are answering
  } catch (e) {}
}

// ---------- sending what was said ----------
function vlWav(chunks, inRate) {
  let len = 0; chunks.forEach(c => len += c.length);
  const all = new Float32Array(len); let o = 0; chunks.forEach(c => { all.set(c, o); o += c.length; });
  const outRate = 16000, ratio = inRate / outRate, outLen = Math.floor(all.length / ratio), pcm = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const p = i * ratio, i0 = Math.floor(p), i1 = Math.min(i0 + 1, all.length - 1), f = p - i0;
    const s = Math.max(-1, Math.min(1, all[i0] * (1 - f) + all[i1] * f));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  const buf = new ArrayBuffer(44 + pcm.length * 2), v = new DataView(buf);
  const w = (p, s) => { for (let i = 0; i < s.length; i++) v.setUint8(p + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, outRate, true); v.setUint32(28, outRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, pcm.length * 2, true); new Int16Array(buf, 44).set(pcm);
  return new Blob([buf], { type: 'audio/wav' });
}
function vlFinish(u) {
  if (u.voicedMs < VL_MIN_VOICED_MS) {                               // a cough or a bump: ignore it
    if (u.barge && typeof vgSt !== 'undefined' && vgSt) vgPrompt(true);
    return;
  }
  const blob = vlWav(u.chunks, u.rate);
  VL.queue = VL.queue.then(() => vlTranscribe(blob, u)).catch(e => console.error(e));
}
async function vlTranscribe(blob, u) {
  const fd = new FormData();
  fd.append('file', blob, 'recording.wav'); fd.append('language', currentLangCode()); fd.append('vocab', sttVocab());
  let data = null;
  try {
    const res = await fetch(`${API}/transcribe`, { method: 'POST', body: fd });
    if (!res.ok) throw new Error('transcribe ' + res.status);
    data = await res.json();
  } catch (e) {
    console.error(e);
    if (Date.now() - VL.lastSorry > 10000) { VL.lastSorry = Date.now(); try { speak(vlT().sorry); } catch (x) {} }
    return;
  }
  const text = (data.text || '').trim();
  if (!text) { if (typeof vgSt !== 'undefined' && vgSt) vgPrompt(true); return; }
  if (vlIsEcho(text, u.barge)) return;               // the assistant heard itself: ignore, do not re-ask
  if (typeof unlockBadge === 'function') { try { unlockBadge('voice', 'Voice Explorer'); } catch (e) {} }
  if (typeof goalEl !== 'undefined' && goalEl) { goalEl.value = ''; goalEl.style.height = 'auto'; }
  sendMessage(text);
}


// ---------- the language only changes when the user says so ----------
const VL_LANG_WORDS = {
  hi: ['hindi', 'हिंदी', 'हिन्दी', 'हिंदी में', 'हिन्दी में', 'হিন্দি', 'হিন্দিতে'],
  bn: ['bengali', 'bangla', 'बंगाली', 'बांग्ला', 'बंगला', 'বাংলা', 'বাংলায়', 'বেঙ্গলি'],
  en: ['english', 'इंग्लिश', 'अंग्रेजी', 'अंग्रेज़ी', 'ইংরেজি', 'ইংলিশ', 'ইংরেজিতে']
};
const VL_LANG_VERB = /speak|talk|switch|change|language|reply|answer|बोलो|बोलिए|बात|भाषा|में|বলো|বলুন|কথা|ভাষা|তে$|য়$/;
const VL_SWITCHED = { en: 'Okay, English.', hi: 'ठीक है, अब हिंदी।', bn: 'ঠিক আছে, এখন বাংলা।' };
function vlLangWanted(text) {
  const n = vfNorm(text), w = n.split(' ').filter(Boolean);
  if (!w.length || w.length > 5) return null;
  for (const code of Object.keys(VL_LANG_WORDS)) {
    const hit = VL_LANG_WORDS_N[code].some(x => n === x || n.split(' ').includes(x));
    if (hit && (w.length === 1 || (w.length <= 3 && VL_LANG_VERB.test(n)) || /^(speak|talk|switch to|change to|reply in|answer in)\b/.test(n))) return code;
  }
  return null;
}
const VL_LANG_WORDS_N = {}; Object.keys(VL_LANG_WORDS).forEach(c => VL_LANG_WORDS_N[c] = VL_LANG_WORDS[c].map(vfNorm));
function vlRepaint() {
  try { vfPaint(); } catch (e) {}
  const b = document.getElementById('accOpen'); if (b && typeof acT === 'function') b.textContent = acT().open;
  const sk = document.getElementById('vfSkip'); if (sk && typeof vfT === 'function') sk.textContent = vfT().skip;
  const sel = document.getElementById('langPicker'); if (sel) sel.value = currentLangCode();
}
const _vlOrigSetLang = setLangCode;
setLangCode = function (code) { const r = _vlOrigSetLang.apply(this, arguments); vlRepaint(); return r; };
const _vlLangPicker = document.getElementById('langPicker');
if (_vlLangPicker) _vlLangPicker.addEventListener('change', vlRepaint);


// ---------- speaking speed ----------
const VL_FASTER = /^(speak |talk |read |go )?(a bit |much |little )?(faster|quicker)$|speed up|तेज़ बोलो|तेज बोलो|और तेज|और तेज़|তাড়াতাড়ি বলো|দ্রুত বলো|আরও দ্রুত/;
const VL_SLOWER = /^(speak |talk |read |go )?(a bit |much |little )?slower$|slow down|धीरे बोलो|धीमे बोलो|और धीरे|আস্তে বলো|ধীরে বলো|আরও আস্তে/;
const VL_RATE_SAY = { en: ['Okay, faster.', 'Okay, slower.', 'This is the fastest.', 'This is the slowest.'], hi: ['ठीक है, और तेज़।', 'ठीक है, और धीरे।', 'यह सबसे तेज़ है।', 'यह सबसे धीमा है।'], bn: ['ঠিক আছে, আরও দ্রুত।', 'ঠিক আছে, আরও ধীরে।', 'এটাই সবচেয়ে দ্রুত।', 'এটাই সবচেয়ে ধীর।'] };
function vlRate(dir) {                       // dir +1 faster, -1 slower
  const cur = speechRate(), nxt = Math.max(0.7, Math.min(2.0, Math.round((cur + dir * 0.2) * 100) / 100));
  const said = VL_RATE_SAY[currentLangCode()] || VL_RATE_SAY.en;
  if (nxt === cur) return vfSay(said[dir > 0 ? 2 : 3]);
  try { localStorage.setItem('companion_speech_rate', String(nxt)); } catch (e) {}
  vfSay(said[dir > 0 ? 0 : 1]);
}
document.addEventListener('keydown', (e) => {                 // Alt + . faster, Alt + , slower
  if (!e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === '.') { e.preventDefault(); vlRate(1); } else if (e.key === ',') { e.preventDefault(); vlRate(-1); }
});

vfListen = function () { vlEnsure(); };                              // "now listen for the reply" is always already true

const _vlOrigStartMic = startMic;                                    // the mic button and Alt+M
startMic = function () {
  if (vfOn) { vlEnsure(); try { setStatus(''); } catch (e) {} return; }
  return _vlOrigStartMic.apply(this, arguments);
};

const _vlOrigVfSet = vfSet;
vfSet = function (on, silent) {
  if (!on && vfOn && vlBlind()) {                                    /
    try { speak(vlT().stays); } catch (e) {}
    return;
  }
  const r = _vlOrigVfSet.apply(this, arguments);
  if (vfOn) vlEnsure(); else vlStop();
  return r;
};

const _vlOrigSend = sendMessage;
sendMessage = function (text) {
  if (typeof text === 'string' && !(typeof vgSt !== 'undefined' && vgSt) && vfOn) {
    const nt = vfNorm(text);
    if (nt.split(' ').length <= 5) { if (VL_FASTER.test(nt)) { vlRate(1); return Promise.resolve(); } if (VL_SLOWER.test(nt)) { vlRate(-1); return Promise.resolve(); } }
    const lc = vlLangWanted(text);
    if (lc) { setLangCode(lc); vfSay(VL_SWITCHED[lc]); return Promise.resolve(); }
  }
  if (vfOn && typeof text === 'string' && !(typeof vgSt !== 'undefined' && vgSt) && VL_STANDARD.test(vfNorm(text)) && vfNorm(text).split(' ').length <= 5) {
    (async () => {
      const ok = await vgConfirm(vlT().ask);
      if (ok) { acSave({ blind: false, done: true }); acApply({ blind: false }, true); vlStop(); try { speak(vlT().done); } catch (e) {} }
      else if (ok === false) vfSay(vlT().kept);
    })();
    return Promise.resolve();
  }
  return _vlOrigSend.apply(this, arguments);
};

function vlArm() {
  if (VL.armed) return; VL.armed = true;
  try { setStatus(vlT().press); } catch (e) {}
  const go = () => {
    ['keydown', 'pointerdown', 'touchstart'].forEach(t => document.removeEventListener(t, go, true));
    VL.armed = false; try { setStatus(''); } catch (e) {}
    vlStart().then(ok => { if (ok) { try { speak(vlT().greet); } catch (e) {} } });
  };
  ['keydown', 'pointerdown', 'touchstart'].forEach(t => document.addEventListener(t, go, true));
}
setTimeout(() => {
  if (vlBlind() && !vfOn) { try { vfOn = true; localStorage.setItem(VF_KEY, '1'); vfPaint(); } catch (e) {} }
  if (vfOn && !document.getElementById('accOverlay') && !document.getElementById('wcOverlay')) vlArm();
}, 1200);

(function vlStyle() {
  const st = document.createElement('style');
  st.textContent = `.vf-btn.listening::after{content:"";width:8px;height:8px;border-radius:50%;background:#34d399;box-shadow:0 0 0 0 rgba(52,211,153,.6);animation:vlPulse 1.8s infinite}
    @keyframes vlPulse{70%{box-shadow:0 0 0 8px rgba(52,211,153,0)}100%{box-shadow:0 0 0 0 rgba(52,211,153,0)}}
    [data-calm="on"] .vf-btn.listening::after{animation:none}
    @media (prefers-reduced-motion:reduce){.vf-btn.listening::after{animation:none}}`;
  document.head.appendChild(st);
})();