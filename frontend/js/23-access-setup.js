const AC_KEY = 'companion_access';

const AC_T = {
  en: {
    title: 'How would you like to use Smart Companion?',
    sub: 'Choose one. You can change it later.',
    hear: 'Hear these options', hint: 'Press H to hear these options.', lang: 'Language',
    blind: ['I am blind or have low vision', 'I will read every answer aloud and listen when you speak. Text becomes larger. You can say your readings and I will save them.'],
    std: ['Standard', 'The normal screen, with no changes.'],
    cur: 'Currently selected.', saved: 'Saved. You can change this any time from Accessibility.', open: 'Accessibility'
  },
  hi: {
    title: 'आप Smart Companion को कैसे इस्तेमाल करना चाहेंगे?',
    sub: 'एक चुनें। इसे बाद में बदला जा सकता है।',
    hear: 'ये विकल्प सुनें', hint: 'विकल्प सुनने के लिए H दबाएँ।', lang: 'भाषा',
    blind: ['मैं दृष्टिहीन हूँ या मुझे कम दिखता है', 'मैं हर जवाब पढ़कर सुनाऊँगा और आपकी बात सुनूँगा। टेक्स्ट बड़ा हो जाएगा। आप अपनी रीडिंग बोलकर बताएँगे तो मैं उन्हें सेव कर दूँगा।'],
    std: ['सामान्य', 'सामान्य स्क्रीन, कोई बदलाव नहीं।'],
    cur: 'अभी यही चुना हुआ है।', saved: 'सेव हो गया। इसे कभी भी एक्सेसिबिलिटी से बदल सकते हैं।', open: 'एक्सेसिबिलिटी'
  },
  bn: {
    title: 'আপনি Smart Companion কীভাবে ব্যবহার করতে চান?',
    sub: 'একটি বেছে নিন। পরে বদলানো যাবে।',
    hear: 'বিকল্পগুলো শুনুন', hint: 'বিকল্প শুনতে H চাপুন।', lang: 'ভাষা',
    blind: ['আমি দৃষ্টিহীন বা আমার কম দেখা যায়', 'আমি প্রতিটি উত্তর পড়ে শোনাব এবং আপনার কথা শুনব। লেখা বড় হবে। আপনি রিডিং মুখে বললে আমি সেভ করে রাখব।'],
    std: ['সাধারণ', 'সাধারণ পর্দা, কোনো পরিবর্তন নেই।'],
    cur: 'এখন এটিই বেছে নেওয়া আছে।', saved: 'সেভ হয়েছে। অ্যাক্সেসিবিলিটি থেকে যেকোনো সময় বদলানো যাবে।', open: 'অ্যাক্সেসিবিলিটি'
  }
};

function acGet() { try { return JSON.parse(localStorage.getItem(AC_KEY)) || null; } catch (e) { return null; } }
function acSave(p) { try { localStorage.setItem(AC_KEY, JSON.stringify(p)); } catch (e) {} }
function acT() { return AC_T[(typeof currentLangCode === 'function' && currentLangCode()) || 'en'] || AC_T.en; }

// ---------- the look ----------
(function acStyle() {
  const st = document.createElement('style');
  st.textContent = `
  .pf-acc-overlay{position:fixed;inset:0;z-index:99998;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(6,8,16,.86);backdrop-filter:blur(6px)}
  .pf-acc-langs{display:flex;gap:8px;justify-content:center;margin:0 0 14px;flex-wrap:wrap}
  .pf-acc-langs button{min-height:44px;padding:8px 16px;border-radius:12px;border:1.5px solid var(--border-medium);background:transparent;color:var(--text-primary);font:inherit;font-weight:600;cursor:pointer}
  .pf-acc-langs button[aria-pressed="true"]{background:var(--accent-purple);border-color:var(--accent-purple);color:#fff}
  .pf-acc-hear{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:52px;margin:0 0 6px;border-radius:14px;border:1.5px solid var(--accent-purple);background:transparent;color:var(--text-primary);font:inherit;font-weight:700;cursor:pointer}
  .pf-acc-hint{text-align:center;font-size:14px;color:var(--text-muted);margin-bottom:14px}
  .pf-acc-pick{min-height:96px}
  .pf-acc-pick[aria-checked="true"]{border-color:var(--accent-purple);background:var(--accent-purple-subtle)}
  .pf-acc-open{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:44px;margin-top:8px;border-radius:12px;border:1px solid var(--border-subtle);background:var(--bg-subtle);color:var(--text-primary);font:inherit;font-size:13px;cursor:pointer}
  .pf-acc-open:focus-visible,.pf-acc-hear:focus-visible,.pf-acc-langs button:focus-visible,.pf-acc-pick:focus-visible{outline:3px solid var(--accent-purple);outline-offset:2px}
  [data-contrast="high"]{--text-primary:#fff;--text-secondary:#f1f5f9;--text-muted:#e2e8f0;--border-subtle:rgba(255,255,255,.6);--border-medium:#fff}
  [data-contrast="high"][data-theme="light"]{--text-primary:#000;--text-secondary:#111827;--text-muted:#1f2937;--border-subtle:rgba(0,0,0,.65);--border-medium:#000}
  [data-contrast="high"] .main-workspace{background-image:none!important;animation:none!important}
  [data-contrast="high"] *:focus-visible{outline:3px solid #ffd60a!important;outline-offset:2px}`;
  document.head.appendChild(st);
})();

// ---------- turning the choice on ----------
function acApply(p, fresh) {
  const root = document.documentElement;
  p = p || {};
  if (p.blind) root.setAttribute('data-contrast', 'high'); else root.removeAttribute('data-contrast');
  root.removeAttribute('data-calm');
  if (fresh) {
    const size = document.querySelector(`.pf-textsize-btns button[data-size="${p.blind ? 'xlarge' : 'normal'}"]`);
    if (size) size.click();                                        // icon.js stores the size itself
    if (typeof vfSet === 'function') vfSet(!!p.blind, !p.blind);   // switching on speaks the voice-mode welcome
  }
}
acApply(acGet(), false);                                           // on every load

// ---------- the dialog ----------
function acClose() { const o = document.getElementById('accOverlay'); if (o) o.remove(); }
function acShow(onDone, isEdit) {
  if (document.getElementById('accOverlay')) return;
  const now = !!(acGet() && acGet().blind);
  const o = document.createElement('div'); o.id = 'accOverlay'; o.className = 'pf-acc-overlay';
  o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-labelledby', 'accTitle');
  document.body.appendChild(o);
  const text = () => { const T = acT(); return [T.title, T.sub, `${T.blind[0]}. ${T.blind[1]}`, `${T.std[0]}. ${T.std[1]}`].join(' '); };
  const finish = (blind) => {
    acSave({ blind, done: true }); acClose(); acApply({ blind }, true);
    if (!blind) { try { setStatus(acT().saved); setTimeout(() => setStatus(''), 4000); } catch (e) {} }
    if (onDone) onDone();
  };
  const draw = () => {
    const T = acT(), lc = currentLangCode();
    const pick = (id, v, blindVal, selected) => `<div class="pf-choice pf-acc-pick" role="button" tabindex="0" id="${id}" aria-checked="${selected}" aria-label="${v[0]}. ${v[1]}${selected ? ' ' + T.cur : ''}"><span><strong>${v[0]}</strong><small>${v[1]}</small></span></div>`;
    o.innerHTML = `<div class="pf-welcome-box">
      <h2 class="pf-welcome-title" id="accTitle">${T.title}</h2>
      <p class="pf-welcome-sub">${T.sub}</p>
      <div class="pf-acc-langs" role="group" aria-label="${T.lang}">
        <button type="button" data-l="en" lang="en" aria-pressed="${lc === 'en'}">English</button>
        <button type="button" data-l="hi" lang="hi" aria-pressed="${lc === 'hi'}">हिन्दी</button>
        <button type="button" data-l="bn" lang="bn" aria-pressed="${lc === 'bn'}">বাংলা</button>
      </div>
      <button type="button" class="pf-acc-hear" id="accHear">${T.hear}</button>
      <p class="pf-acc-hint">${T.hint}</p>
      ${pick('accBlind', T.blind, true, isEdit && now)}
      ${pick('accStd', T.std, false, isEdit && !now)}
      </div>`;
    o.querySelectorAll('[data-l]').forEach(b => b.onclick = () => {
      if (typeof setLangCode === 'function') setLangCode(b.dataset.l); else { try { localStorage.setItem('companion_lang', b.dataset.l); } catch (e) {} }
      draw(); const t = o.querySelector('[data-l="' + b.dataset.l + '"]'); if (t) t.focus();
    });
    const act = (el, v) => { el.onclick = () => finish(v); el.onkeydown = e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); finish(v); } }; };
    act(o.querySelector('#accBlind'), true); act(o.querySelector('#accStd'), false);
    o.querySelector('#accHear').onclick = () => { try { speak(text()); } catch (e) {} };
  };
  draw();
  const first = o.querySelector('#accHear'); if (first) first.focus();       // a screen reader announces the dialog, then this button
  o.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isEdit) { acClose(); return; }
    if ((e.key === 'h' || e.key === 'H') && !/INPUT|TEXTAREA|SELECT/.test((e.target.tagName || ''))) { e.preventDefault(); try { speak(text()); } catch (x) {} }
    if (e.key === 'Tab') {                                                   // keep Tab inside the dialog
      const f = Array.from(o.querySelectorAll('button, [tabindex="0"]')).filter(x => !x.disabled);
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  });
}

// ---------- when it appears ----------
// first-ever open: this comes BEFORE the backup/sync welcome screen
if (typeof wcShow === 'function') {
  const _acWelcome = wcShow;
  wcShow = function () {
    if (acGet() && acGet().done) return _acWelcome.apply(this, arguments);
    const args = arguments; acShow(() => _acWelcome.apply(null, args));
  };
}
// someone with data already (so the welcome screen never shows) still gets asked once
setTimeout(() => {
  if ((acGet() && acGet().done) || document.getElementById('wcOverlay') || document.getElementById('accOverlay') || document.getElementById('pfSplash')) return;
  acShow();
}, 1500);

// ---------- coming back to it ----------
function acAddOpener() {
  if (document.getElementById('accOpen')) return true;
  const where = document.querySelector('.pf-textsize');
  if (!where) return false;
  const b = document.createElement('button');
  b.type = 'button'; b.id = 'accOpen'; b.className = 'pf-acc-open'; b.textContent = acT().open;
  b.onclick = () => acShow(null, true);
  where.parentNode.insertBefore(b, where.nextSibling);
  return true;
}
(function waitForSidebar() { let n = 0; const iv = setInterval(() => { if (acAddOpener() || ++n > 40) clearInterval(iv); }, 500); })();
const _acLang = document.getElementById('langPicker');
if (_acLang) _acLang.addEventListener('change', () => { const b = document.getElementById('accOpen'); if (b) b.textContent = acT().open; });
document.addEventListener('keydown', (e) => {
  if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'a') { e.preventDefault(); acShow(null, true); }
});