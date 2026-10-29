// Voice-first mode and screen-reader support (English / Hindi / Bengali)

const VF_KEY = 'companion_voicefirst';        

const VF_T = {
  en: {
    on: 'Voice mode is on. I will read each answer aloud, then listen. Say repeat, next, or stop. To save a reading, say for example: BP 120 over 80, or sugar 110, or I took my medicine.',
    off: 'Voice mode is off.',
    step: 'Step', hintMore: 'Say next when you have done these, or say repeat.',
    final: 'That is everything for this task. Say a new task whenever you are ready.',
    options: 'Say one of these options:', noNext: 'There is no next step right now.',
    stopped: 'Okay, stopped.', opening: 'Opening',
    health: 'your health log', sos: 'the emergency screen',
    mic: 'Speak your request', cam: 'Add a photo or document', send: 'Send', cfg: 'Camera settings',
    rm: 'Remove attachment', vf: 'Voice mode', vfOn: 'Voice mode, on', vfOff: 'Voice mode, off',
    skip: 'Skip to the message box', reminder: 'Reminder.'
  },
  hi: {
    on: 'वॉइस मोड चालू है। मैं हर जवाब पढ़कर सुनाऊँगा, फिर सुनूँगा। दोबारा, अगला, या रुको बोलिए। रीडिंग सेव करने के लिए बोलिए, जैसे: बीपी 120 बटा 80, या शुगर 110, या मैंने दवा ले ली।',
    off: 'वॉइस मोड बंद है।',
    step: 'स्टेप', hintMore: 'ये हो जाने पर अगला बोलिए, या दोबारा बोलिए।',
    final: 'इस काम के लिए बस इतना ही है। जब चाहें नया काम बताइए।',
    options: 'इनमें से कोई एक बोलिए:', noNext: 'अभी कोई अगला स्टेप नहीं है।',
    stopped: 'ठीक है, रुक गया।', opening: 'खोल रहा हूँ',
    health: 'आपका हेल्थ लॉग', sos: 'आपातकालीन स्क्रीन',
    mic: 'अपनी बात बोलिए', cam: 'फोटो या दस्तावेज़ जोड़ें', send: 'भेजें', cfg: 'कैमरा सेटिंग',
    rm: 'अटैचमेंट हटाएँ', vf: 'वॉइस मोड', vfOn: 'वॉइस मोड, चालू', vfOff: 'वॉइस मोड, बंद',
    skip: 'संदेश बॉक्स पर जाएँ', reminder: 'याद दिलाना।'
  },
  bn: {
    on: 'ভয়েস মোড চালু আছে। আমি প্রতিটি উত্তর পড়ে শোনাব, তারপর শুনব। আবার, পরের, বা থামো বলুন। রিডিং সেভ করতে বলুন, যেমন: বিপি 120 বাই 80, বা সুগার 110, বা আমি ওষুধ খেয়েছি।',
    off: 'ভয়েস মোড বন্ধ।',
    step: 'ধাপ', hintMore: 'এগুলো হয়ে গেলে পরের বলুন, অথবা আবার বলুন।',
    final: 'এই কাজের জন্য এটুকুই। যখন ইচ্ছা নতুন কাজ বলুন।',
    options: 'এর মধ্যে একটি বলুন:', noNext: 'এখন কোনো পরের ধাপ নেই।',
    stopped: 'ঠিক আছে, থামলাম।', opening: 'খুলছি',
    health: 'আপনার হেলথ লগ', sos: 'জরুরি স্ক্রিন',
    mic: 'আপনার কথা বলুন', cam: 'ছবি বা নথি যোগ করুন', send: 'পাঠান', cfg: 'ক্যামেরা সেটিংস',
    rm: 'সংযুক্তি সরান', vf: 'ভয়েস মোড', vfOn: 'ভয়েস মোড, চালু', vfOff: 'ভয়েস মোড, বন্ধ',
    skip: 'মেসেজ বক্সে যান', reminder: 'মনে করিয়ে দেওয়া।'
  }
};
// Spoken commands. Matched only when the whole sentence is short (5 words or fewer), so a real request
// such as "help me clean my desk" is never mistaken for a command.
const VF_CMDS = {
  repeat: ['repeat', 'say again', 'read again', 'once more', 'again', 'दोबारा', 'फिर से', 'फिर से बोलो', 'दोहराओ', 'আবার', 'আবার বলো', 'আবার পড়ো', 'আবার বলুন'],
  next:   ['next', 'next step', 'done', 'i did it', 'finished', 'अगला', 'अगला स्टेप', 'हो गया', 'हो गया अगला', 'পরের', 'পরবর্তী', 'পরের ধাপ', 'হয়ে গেছে', 'হয়ে গেছে পরের'],
  stop:   ['stop', 'be quiet', 'quiet', 'cancel', 'रुको', 'रुकिए', 'चुप', 'बस', 'बंद करो', 'থামো', 'থামুন', 'চুপ', 'বন্ধ করো'],
  voiceoff: ['voice mode off', 'turn off voice mode', 'वॉइस मोड बंद', 'ভয়েস মোড বন্ধ'],
  health: ['health log', 'open health log', 'हेल्थ लॉग', 'स्वास्थ्य लॉग', 'হেলথ লগ'],
  sos:    ['emergency', 'sos', 'i need help', 'आपातकाल', 'एसओएस', 'मुझे मदद चाहिए', 'জরুরি', 'এসওএস', 'সাহায্য চাই']
};

let vfOn = false, vfLast = '', vfAwaitReply = false, vfMicFailed = false;
try { vfOn = localStorage.getItem(VF_KEY) === '1'; } catch (e) {}

function vfT() { return VF_T[(typeof currentLangCode === 'function' && currentLangCode()) || 'en'] || VF_T.en; }
function vfNorm(t) {
  return String(t || '').normalize('NFC').replace(/\u093C/g, '').toLowerCase().replace(/[.,!?;:।'"“”‘’()\-]/g, ' ').replace(/\s+/g, ' ').trim();
}
function vfIsSpeaking() {
  const synth = window.speechSynthesis;
  const local = !!(synth && (synth.speaking || synth.pending));
  const server = typeof _serverAudio !== 'undefined' && _serverAudio && !_serverAudio.paused && !_serverAudio.ended;
  return local || !!server;
}
function vfWhenQuiet(cb, maxMs) {
  const t0 = Date.now();
  const iv = setInterval(() => {
    if (!vfIsSpeaking() || Date.now() - t0 > (maxMs || 90000)) { clearInterval(iv); setTimeout(cb, 250); }
  }, 250);
}
let vfRunId = 0;
function vfChunks(text) {            // the server voice reads at most ~600 characters at a time
  const out = []; let cur = '';
  (text.match(/[^.!?।]+[.!?।]*\s*/g) || [text]).forEach(sn => {
    if ((cur + sn).length > 450 && cur) { out.push(cur.trim()); cur = ''; }
    cur += sn;
  });
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function vfSay(text, then) {
  if (!text) return;
  const id = ++vfRunId, parts = vfChunks(text);
  const next = () => {
    if (id !== vfRunId) return;                       // something newer started, or Stop was pressed
    const p = parts.shift();
    if (!p) { if (then) vfWhenQuiet(() => { if (id === vfRunId) then(); }); return; }
    try { speak(p); } catch (e) {}
    setTimeout(() => vfWhenQuiet(next), 400);         // small delay so "speaking" has started before we watch it
  };
  next();
}
function vfStopAll() {
  vfRunId++;
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  if (typeof stopServerAudio === 'function') stopServerAudio();
  if (typeof micSession !== 'undefined' && micSession && typeof stopMic === 'function') { try { stopMic(); } catch (e) {} }
}

// ---------- listening for the reply ----------
function vfListen() {
  if (!vfOn || vfMicFailed) return;
  if (typeof micSession !== 'undefined' && (micSession || micBusy)) return;
  if (typeof startMic !== 'function') return;
  startMic();
  setTimeout(() => { if (typeof micSession !== 'undefined' && !micSession && !micBusy) vfMicFailed = true; }, 1500);
}

// ---------- reading an answer ----------
function vfAnnounce(steps, isFinal) {
  if (!vfOn || !steps) return;
  const T = vfT(), parts = [];
  let choices = null;
  steps.forEach((s, i) => {
    if (!s || !s.text) return;
    if (s.clarify) { parts.push(s.text); if (s.choices && s.choices.length) choices = s.choices; }
    else parts.push(steps.length > 1 ? `${T.step} ${i + 1}. ${s.text.replace(/[\s.]*$/, '')}.` : s.text);
  });
  if (choices) parts.push(`${T.options} ${choices.join(', ')}.`);
  else if (steps.length) parts.push(isFinal ? T.final : T.hintMore);
  vfLast = parts.join(' ');
  vfAwaitReply = true;
  vfSay(vfLast, vfListen);
}

// wrap the function that draws an answer (same global name, so every caller uses the new one)
const _vfOrigAssistant = addAssistantBubble;
addAssistantBubble = function (steps, isFinal) {
  const el = _vfOrigAssistant.apply(this, arguments);
  try { vfAnnounce(steps, isFinal); } catch (e) { console.error(e); }
  return el;
};

// ---------- voice commands ----------
function vfMatch(text) {
  const n = vfNorm(text);
  if (!n || n.split(' ').length > 5) return null;
  for (const id of Object.keys(VF_CMDS)) {
    if (VF_CMDS[id].some(p => n === vfNorm(p))) return id;
  }
  return null;
}
function vfLastBubble() {
  const all = feedEl ? feedEl.querySelectorAll('.msg.assistant') : [];
  return all.length ? all[all.length - 1] : null;
}
function vfRun(cmd) {
  const T = vfT();
  if (cmd === 'repeat') { if (vfLast) vfSay(vfLast, vfListen); return; }
  if (cmd === 'stop') { vfStopAll(); vfSay(T.stopped); return; }
  if (cmd === 'voiceoff') { vfSet(false); return; }
  if (cmd === 'health') { const b = document.getElementById('healthLogBtn'); vfSay(`${T.opening} ${T.health}`); if (b) b.click(); return; }
  if (cmd === 'sos') { vfSay(`${T.opening} ${T.sos}`); if (typeof showEmergencyPanel === 'function') showEmergencyPanel(); return; }
  if (cmd === 'next') {
    const b = feedEl && Array.from(feedEl.querySelectorAll('.done-btn')).filter(x => !x.disabled).pop();
    if (b) b.click(); else vfSay(T.noNext, vfListen);
  }
}
function vfChoice(text) {            // the user said the name of one of the option buttons
  const bub = vfLastBubble(); if (!bub) return false;
  const n = vfNorm(text);
  const hit = Array.from(bub.querySelectorAll('.btn-subtle')).find(b => !b.disabled && vfNorm(b.textContent) === n);
  if (hit) { hit.click(); return true; }
  return false;
}

// every spoken or typed message passes here first
const _vfOrigSend = sendMessage;
sendMessage = function (text) {
  if (vfOn && typeof text === 'string') {
    const cmd = vfMatch(text);
    if (cmd) { vfAwaitReply = false; vfRun(cmd); return Promise.resolve(); }
    if (vfChoice(text)) return Promise.resolve();
  }
  return _vfOrigSend.apply(this, arguments);
};

// ---------- the on/off button ----------
function vfSet(on, silent) {
  vfOn = !!on; vfMicFailed = false;
  try { localStorage.setItem(VF_KEY, vfOn ? '1' : '0'); } catch (e) {}
  vfPaint();
  if (!vfOn) { vfStopAll(); }
  if (!silent) vfSay(vfOn ? vfT().on : vfT().off, vfOn ? vfListen : null);
}
function vfPaint() {
  const T = vfT(), b = document.getElementById('vfBtn');
  if (b) {
    b.setAttribute('aria-pressed', vfOn ? 'true' : 'false');
    b.setAttribute('aria-label', vfOn ? T.vfOn : T.vfOff);
    b.title = T.vf; b.classList.toggle('on', vfOn);
    const lab = b.querySelector('.vf-lab'); if (lab) lab.textContent = T.vf;
  }
  // with voice mode on the app speaks; a screen reader should not read the same answer a second time
  if (feedEl) { feedEl.setAttribute('role', 'log'); feedEl.setAttribute('aria-live', vfOn ? 'off' : 'polite'); }
}
(function addVfButton() {
  if (!micBtn || document.getElementById('vfBtn')) return;
  const st = document.createElement('style');
  st.textContent = `.vf-btn{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:4px 10px;margin-right:4px;border-radius:8px;
    border:1px solid var(--border-subtle,rgba(128,128,128,.3));background:var(--bg-subtle,rgba(128,128,128,.12));color:var(--text-primary,inherit);
    font:inherit;font-size:12px;cursor:pointer;white-space:nowrap}
    .vf-btn.on{background:var(--accent-purple,#7c5cff);border-color:var(--accent-purple,#7c5cff);color:#fff}
    .vf-btn:focus-visible{outline:3px solid var(--accent-purple,#7c5cff);outline-offset:2px}
    .vf-btn svg{width:16px;height:16px}
    .vf-skip{position:absolute;left:-9999px;top:8px;z-index:100000;padding:10px 14px;border-radius:10px;background:#fff;color:#000;font-weight:700}
    .vf-skip:focus{left:8px}
    .step-item:focus-visible{outline:3px solid var(--accent-purple,#7c5cff);outline-offset:2px}
    @media (max-width:640px){.vf-lab{display:none}}`;
  document.head.appendChild(st);
  const b = document.createElement('button');
  b.type = 'button'; b.id = 'vfBtn'; b.className = 'vf-btn';
  b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg><span class="vf-lab"></span>';
  b.onclick = () => vfSet(!vfOn);
  const anchor = document.getElementById('langPicker') || micBtn;
  anchor.parentNode.insertBefore(b, anchor);
  // skip link for keyboard and screen-reader users
  const sk = document.createElement('a');
  sk.href = '#'; sk.className = 'vf-skip'; sk.id = 'vfSkip';
  sk.onclick = (e) => { e.preventDefault(); if (goalEl) goalEl.focus(); };
  document.body.insertBefore(sk, document.body.firstChild);
  vfPaint();
})();
const _vfLangPicker = document.getElementById('langPicker');
if (_vfLangPicker) _vfLangPicker.addEventListener('change', () => { vfPaint(); vfLabels(document.body); });

document.addEventListener('keydown', (e) => {
  if (!e.altKey || e.ctrlKey || e.metaKey) return;
  const k = e.key.toLowerCase();
  if (k === 'v') { e.preventDefault(); vfSet(!vfOn); }
  else if (k === 'm') { e.preventDefault(); if (typeof startMic === 'function') { vfStopAll(); startMic(); } }
  else if (k === 'r') { e.preventDefault(); if (vfLast) vfSay(vfLast); }
  else if (k === 's') { e.preventDefault(); vfStopAll(); }
});

// ---------- screen-reader helpers ----------
const VF_NAMES = { micBtn: 'mic', liveCamMicBtn: 'mic', camBtn: 'cam', sendBtn: 'send', btnIpSettings: 'cfg', attachRemoveBtn: 'rm', docAttachRemoveBtn: 'rm' };
function vfLabels(root) {
  const T = vfT();
  root.querySelectorAll('button, [role="button"], a.btn').forEach(b => {
    if (b.dataset.vfNamed === '1' && !VF_NAMES[b.id]) return;
    const hasText = (b.textContent || '').trim().length > 0 && !b.querySelector('svg:only-child');
    const key = VF_NAMES[b.id];
    if (key) { b.setAttribute('aria-label', T[key]); b.dataset.vfNamed = '1'; return; }
    if (!hasText && !b.getAttribute('aria-label')) {
      const t = b.getAttribute('title'); if (t) { b.setAttribute('aria-label', t); b.dataset.vfNamed = '1'; }
    }
  });
  root.querySelectorAll('svg:not([aria-hidden])').forEach(s => s.setAttribute('aria-hidden', 'true'));
  const sk = document.getElementById('vfSkip'); if (sk) sk.textContent = T.skip;
}
function vfSteps(root) {
  root.querySelectorAll('.step-item:not([data-vf])').forEach(item => {
    item.dataset.vf = '1';
    const title = item.querySelector('.step-title');
    item.setAttribute('role', 'checkbox'); item.tabIndex = 0;
    item.setAttribute('aria-label', title ? title.textContent.trim() : 'Step');
    const sync = () => item.setAttribute('aria-checked', item.classList.contains('completed') ? 'true' : 'false');
    sync();
    new MutationObserver(sync).observe(item, { attributes: true, attributeFilter: ['class'] });
    item.addEventListener('keydown', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && e.target === item) { e.preventDefault(); item.click(); }
    });
    const chk = item.querySelector('.step-checkbox'); if (chk) chk.setAttribute('aria-hidden', 'true');
  });
}
function vfLang(root) {                // tell the screen reader which language a piece of text is in
  root.querySelectorAll('.msg-body-text, .step-title, .answer-detail, .step-body, .step-sequence-wrap > div').forEach(el => {
    if (el.lang) return;
    const t = el.textContent || '';
    if (/[\u0900-\u0963\u0966-\u097F]/.test(t)) el.lang = 'hi'; else if (/[\u0980-\u09FF]/.test(t)) el.lang = 'bn';
  });
}
function vfScan(root) { try { vfLabels(root); vfSteps(root); vfLang(root); } catch (e) {} }
new MutationObserver(muts => {
  let scan = false;
  muts.forEach(m => m.addedNodes.forEach(n => {
    if (n.nodeType !== 1) return;
    scan = true;
    if (vfOn && n.id === 'rmBanner') { const tx = n.querySelector('.pf-remind-tx'); if (tx) vfSay(`${vfT().reminder} ${tx.innerText.replace(/\s+/g, ' ')}`); }
  }));
  if (scan && !vfScan._p) { vfScan._p = true; setTimeout(() => { vfScan._p = false; vfScan(document.body); }, 150); }
}).observe(document.body, { childList: true, subtree: true });
vfScan(document.body);