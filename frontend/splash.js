/* ==========================================================================
   SMART COMPANION - LOADING SCREEN
   Put this as the FIRST thing inside <body> in index.html:
       <script src="splash.js"></script>

   While the backend is still starting (it can take a few minutes), this shows a calm
   screen. It keeps asking the backend "are you ready?". The moment the backend says yes,
   the screen fades away and the app is there. If the backend answers within a second,
   nothing is shown at all.
   Nothing here pretends to be a progress bar: it shows the real waiting time.
   ========================================================================== */
(function () {
  'use strict';

  var host = '';
  try { host = localStorage.getItem('companion_api_host') || ''; } catch (e) {}
  if (!host) {
    host = (location.hostname && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1')
      ? 'http://' + location.hostname + ':8000' : 'http://127.0.0.1:8000';
  }

  var SHOW_AFTER_MS = 700;        // do not flash the screen if the backend is already up
  var POLL_MS = 1500;
  var SLOW_AFTER_S = 240;         // after 4 minutes, offer "try again" and "open anyway"

  window.__pfPending = true;      // other scripts wait for the 'pf:backend-ready' event while this is true
  var start = Date.now(), root = null, timer = null, tipTimer = null, done = false, slowShown = false, tipIx = 0;

  var TIPS = [
    'Your health notes stay on your own device.',
    'Tip: the A buttons in the side menu make the text bigger.',
    'Tip: you can speak instead of typing. Hindi and Bengali work too.',
    'Tip: your Health Log can make a clean PDF for your doctor.',
    'Take a slow breath. Almost there.'
  ];

  var CSS = '' +
    '#pfSplash{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px;' +
    'background:radial-gradient(circle at 30% 20%,rgba(124,92,255,.22),transparent 55%),radial-gradient(circle at 75% 80%,rgba(34,211,238,.14),transparent 50%),var(--bg-base,#0b0d13);' +
    'color:var(--text-primary,#f8fafc);font-family:var(--font-sans,system-ui,sans-serif);opacity:0;transition:opacity .45s ease}' +
    '#pfSplash.on{opacity:1}#pfSplash.out{opacity:0;pointer-events:none}' +
    '.pfs-card{width:100%;max-width:440px;text-align:center}' +
    '.pfs-orb{position:relative;width:170px;height:170px;margin:0 auto 26px;display:flex;align-items:center;justify-content:center}' +
    '.pfs-ring{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,rgba(124,92,255,.35),rgba(124,92,255,.05) 70%);animation:pfsBreathe 8s ease-in-out infinite}' +
    '.pfs-ring.two{inset:18px;background:radial-gradient(circle,rgba(34,211,238,.30),rgba(34,211,238,.04) 70%);animation-delay:-.6s}' +
    '.pfs-logo{position:relative;width:84px;height:84px;border-radius:50%;object-fit:cover;box-shadow:0 8px 30px rgba(124,92,255,.35);animation:pfsFloat 8s ease-in-out infinite}' +
    '@keyframes pfsBreathe{0%,100%{transform:scale(.82);opacity:.7}50%{transform:scale(1.08);opacity:1}}' +
    '@keyframes pfsFloat{0%,100%{transform:scale(.96)}50%{transform:scale(1.05)}}' +
    '.pfs-breath{height:24px;margin-bottom:14px;position:relative;font-size:15px;letter-spacing:.08em;color:var(--accent-purple,#7c5cff);font-weight:600}' +
    '.pfs-breath span{position:absolute;left:0;right:0;opacity:0;animation:pfsFade 8s ease-in-out infinite}' +
    '.pfs-breath span+span{animation-delay:-4s}' +
    '@keyframes pfsFade{0%,8%{opacity:0}20%,40%{opacity:1}52%,100%{opacity:0}}' +
    '.pfs-title{font-size:26px;font-weight:700;line-height:1.25;margin-bottom:8px}' +
    '.pfs-sub{font-size:17px;line-height:1.6;color:var(--text-secondary,#94a3b8);margin-bottom:22px}' +
    '.pfs-bar{height:6px;border-radius:6px;background:var(--border-subtle,rgba(255,255,255,.1));overflow:hidden;margin:0 auto 10px;max-width:320px}' +
    '.pfs-bar i{display:block;height:100%;width:40%;border-radius:6px;background:linear-gradient(90deg,transparent,var(--accent-purple,#7c5cff),transparent);animation:pfsSlide 1.8s ease-in-out infinite}' +
    '@keyframes pfsSlide{0%{transform:translateX(-100%)}100%{transform:translateX(260%)}}' +
    '.pfs-time{font-size:14.5px;color:var(--text-muted,#64748b);margin-bottom:18px}' +
    '.pfs-tip{min-height:52px;font-size:16px;line-height:1.55;color:var(--text-secondary,#94a3b8);padding:12px 16px;border-radius:14px;background:var(--bg-subtle,rgba(255,255,255,.04));border:1px solid var(--border-subtle,rgba(255,255,255,.1));transition:opacity .4s}' +
    '.pfs-sos{margin-top:18px;font-size:15px;line-height:1.6;color:var(--text-secondary,#94a3b8)}' +
    '.pfs-sos a{color:var(--accent-rose,#f43f5e);font-weight:700;text-decoration:none;white-space:nowrap}' +
    '.pfs-slow{display:none;margin-top:18px}.pfs-slow.on{display:block}' +
    '.pfs-slow p{font-size:15.5px;line-height:1.6;color:var(--text-secondary,#94a3b8);margin-bottom:12px}' +
    '.pfs-btns{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}' +
    '.pfs-btn{min-height:50px;padding:10px 20px;border-radius:14px;font-size:16px;font-weight:700;cursor:pointer;border:1.5px solid var(--border-medium,rgba(255,255,255,.2));background:transparent;color:var(--text-primary,#f8fafc);font-family:inherit}' +
    '.pfs-btn.main{background:var(--accent-purple,#7c5cff);border-color:var(--accent-purple,#7c5cff);color:#fff}' +
    '.pfs-ok .pfs-bar i{animation:none;width:100%;transform:none;background:var(--accent-mint,#10b981)}' +
    '@media (prefers-reduced-motion:reduce){.pfs-ring,.pfs-logo,.pfs-bar i,.pfs-breath span{animation:none!important}.pfs-breath span+span{display:none}.pfs-breath span{opacity:1}}';

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }

  function build() {
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    root = el('div'); root.id = 'pfSplash'; root.setAttribute('role', 'status'); root.setAttribute('aria-live', 'polite');
    root.innerHTML =
      '<div class="pfs-card">' +
      '<div class="pfs-orb"><div class="pfs-ring"></div><div class="pfs-ring two"></div>' +
      '<img class="pfs-logo" src="logo.png" alt="" onerror="this.style.display=\'none\'"></div>' +
      '<div class="pfs-breath" aria-hidden="true"><span>Breathe in…</span><span>Breathe out…</span></div>' +
      '<h1 class="pfs-title" id="pfsTitle">Getting everything ready</h1>' +
      '<p class="pfs-sub" id="pfsSub">Your companion is waking up. The first start can take a couple of minutes while it loads its voice and vision tools.</p>' +
      '<div class="pfs-bar" aria-hidden="true"><i></i></div>' +
      '<div class="pfs-time" id="pfsTime">Waiting 0:00</div>' +
      '<div class="pfs-tip" id="pfsTip"></div>' +
      '<div class="pfs-slow" id="pfsSlow"><p>This is taking longer than usual. Please check that the backend is running in your terminal.</p>' +
      '<div class="pfs-btns"><button class="pfs-btn main" id="pfsRetry" type="button">Try again</button>' +
      '<button class="pfs-btn" id="pfsSkip" type="button">Open the app anyway</button></div></div>' +
      '<p class="pfs-sos">In an emergency do not wait. Call <a href="tel:108">108</a> for an ambulance or <a href="tel:104">104</a> for the health helpline.</p>' +
      '</div>';
    document.body.appendChild(root);
    requestAnimationFrame(function () { root.classList.add('on'); });
    root.querySelector('#pfsRetry').onclick = function () { start = Date.now(); slowShown = false; root.querySelector('#pfsSlow').classList.remove('on'); check(); };
    root.querySelector('#pfsSkip').onclick = function () { finish(false); };
    setTip(); tickTime();
    timer = setInterval(tickTime, 1000);
    tipTimer = setInterval(setTip, 6000);
  }

  function setTip() {
    var t = root && root.querySelector('#pfsTip'); if (!t) return;
    t.style.opacity = 0;
    setTimeout(function () { t.textContent = TIPS[tipIx++ % TIPS.length]; t.style.opacity = 1; }, 300);
  }

  function tickTime() {
    var s = Math.floor((Date.now() - start) / 1000), m = Math.floor(s / 60), r = s % 60;
    var t = root && root.querySelector('#pfsTime'); if (t) t.textContent = 'Waiting ' + m + ':' + (r < 10 ? '0' : '') + r;
    if (s >= SLOW_AFTER_S && !slowShown && root) { slowShown = true; root.querySelector('#pfsSlow').classList.add('on'); }
  }

  function finish(ok) {
    if (done) return; done = true; window.__pfPending = false;
    clearInterval(timer); clearInterval(tipTimer);
    try { window.dispatchEvent(new CustomEvent('pf:backend-ready', { detail: { ok: ok } })); } catch (e) {}
    if (!root) return;
    if (ok) {
      root.classList.add('pfs-ok');
      root.querySelector('#pfsTitle').textContent = 'All set';
      root.querySelector('#pfsSub').textContent = 'Welcome. Opening your companion…';
    }
    setTimeout(function () { root.classList.add('out'); setTimeout(function () { root && root.remove(); }, 500); }, ok ? 700 : 0);
  }

  function check() {
    if (done) return;
    var ctrl = window.AbortController ? new AbortController() : null;
    var to = setTimeout(function () { ctrl && ctrl.abort(); }, 4000);
    fetch(host + '/health', { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { clearTimeout(to); if (r.ok) finish(true); else again(); })
      .catch(function () { clearTimeout(to); again(); });
  }
  function again() { if (!done) setTimeout(check, POLL_MS); }

  function begin() {
    setTimeout(function () { if (!done && !root) build(); }, SHOW_AFTER_MS);
    check();
  }
  if (document.body) begin(); else document.addEventListener('DOMContentLoaded', begin);
})();