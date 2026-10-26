// English / Hindi / Bengali picker and read-aloud voice

const LANGS = {
  en: { label: 'English', bcp: 'en-US', whisper: 'en' },
  hi: { label: 'हिन्दी',   bcp: 'hi-IN', whisper: 'hi' },
  bn: { label: 'বাংলা',    bcp: 'bn-IN', whisper: 'bn' },
};
const LANG_KEY = 'companion_lang';

function currentLangCode() {
  let c = 'en';
  try { c = localStorage.getItem(LANG_KEY) || 'en'; } catch (e) {}
  return LANGS[c] ? c : 'en';
}
// used when the server tells us which language was really spoken
function setLangCode(code) {
  if (!LANGS[code]) return;
  try { localStorage.setItem(LANG_KEY, code); } catch (e) {}
  const sel = document.getElementById('langPicker'); if (sel) sel.value = code;
}
function currentLang() { const code = currentLangCode(); return { code, ...LANGS[code] }; }

// The language picker (injected, so index.html needs no change)
(function addLangPicker() {
  if (!micBtn || document.getElementById('langPicker')) return;
  const st = document.createElement('style');
  st.textContent = `.lang-picker{background:var(--bg-subtle,rgba(128,128,128,.12));color:var(--text-primary,inherit);
    border:1px solid var(--border-subtle,rgba(128,128,128,.3));border-radius:8px;padding:4px 6px;font-size:12px;
    cursor:pointer;margin-right:4px;max-width:92px;color-scheme:dark}
    [data-theme="light"] .lang-picker{color-scheme:light}
    .lang-picker option{background:#181d2e;color:#f8fafc}
    [data-theme="light"] .lang-picker option{background:#ffffff;color:#0f172a}`;
  document.head.appendChild(st);
  const sel = document.createElement('select');
  sel.id = 'langPicker'; sel.className = 'lang-picker';
  sel.title = 'Voice and reply language'; sel.setAttribute('aria-label', 'Language');
  Object.entries(LANGS).forEach(([code, l]) => {
    const o = document.createElement('option'); o.value = code; o.textContent = l.label; sel.appendChild(o);
  });
  sel.value = currentLangCode();
  sel.onchange = () => { try { localStorage.setItem(LANG_KEY, sel.value); } catch (e) {} };
  micBtn.parentNode.insertBefore(sel, micBtn);
})();

// ---- Read aloud: pick the voice from the SCRIPT of the text itself ----
function detectScript(text) {
  // the danda sign (U+0964, "।") is shared by both scripts, so only look at real letters and digits
  if (/[\u0900-\u0963\u0966-\u097F]/.test(text)) return 'hi';
  if (/[\u0980-\u09FF]/.test(text)) return 'bn';
  return 'en';
}

function voiceFor(code) {
  if (code === 'en') return pickFemaleVoice();
  const list = cachedVoices.filter(v => v.lang.replace('_', '-').toLowerCase().startsWith(code));
  return list.find(v => /female|google|natural|neural/i.test(v.name)) || list[0] || null;
}

let _serverAudio = null;
function stopServerAudio() {
  if (_serverAudio) { try { _serverAudio.pause(); } catch (e) {} _serverAudio = null; }
}

if (window.speechSynthesis) {
  const _cancel = window.speechSynthesis.cancel.bind(window.speechSynthesis);
  window.speechSynthesis.cancel = () => { stopServerAudio(); _cancel(); };
}

async function serverSpeak(text, code) {
  try {
    const res = await fetch(`${API}/tts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, 600), lang: code }),
    });
    if (!res.ok) throw new Error('tts');
    const url = URL.createObjectURL(await res.blob());
    _serverAudio = new Audio(url);
    _serverAudio.onended = () => URL.revokeObjectURL(url);
    await _serverAudio.play();
  } catch (e) {
    setStatus(`No ${LANGS[code].label} voice is available on this device.`, true);
  }
}

function speak(text) {
  if (!text || !text.trim()) return;
  const code = detectScript(text);
  if (window.speechSynthesis) window.speechSynthesis.cancel(); else stopServerAudio();
  const voice = window.speechSynthesis ? voiceFor(code) : null;
  if (code !== 'en' && !voice) { serverSpeak(text, code); return; }   // no local Hindi/Bengali voice -> server fallback
  if (!window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1.0;
  if (voice) { utter.voice = voice; utter.lang = voice.lang; } else { utter.lang = LANGS[code].bcp; }
  window.speechSynthesis.speak(utter);
}