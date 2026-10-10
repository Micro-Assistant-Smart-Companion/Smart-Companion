/* ==========================================================================
   SMART COMPANION - ICONS + PATIENT-FRIENDLY ENHANCEMENTS
   Load AFTER app.js:   <script src="icons.js"></script>

   1. Replaces every emoji / symbol glyph (also in text that app.js creates
      later) with a clean SVG icon that inherits the surrounding text colour.
   2. Adds a "Text size" control to the sidebar (Normal / Large / Extra large).
   3. Adds an icon to the SOS button.
   ========================================================================== */
(function () {
  'use strict';

  // ---- Icon set (24x24, stroke based, Lucide-style) -----------------------
  const P = {
    timer: '<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>',
    volume: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    lifebuoy: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/>',
    ambulance: '<path d="M10 10H6"/><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.28a1 1 0 0 0-.684-.948l-1.923-.641a1 1 0 0 1-.578-.502l-1.539-3.076A1 1 0 0 0 16.382 8H14"/><path d="M8 8v4"/><path d="M9 18h6"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    message: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    smartphone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/>',
    pill: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    siren: '<path d="M7 18v-6a5 5 0 1 1 10 0v6"/><path d="M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z"/><path d="M21 12h1"/><path d="M18.5 4.5 18 5"/><path d="M2 12h1"/><path d="M12 2v1"/><path d="m4.929 4.929.707.707"/><path d="M12 12v6"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    checkcircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    map: '<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/>',
    hospital: '<path d="M12 6v4"/><path d="M14 14h-4"/><path d="M14 18h-4"/><path d="M14 8h-4"/><path d="M18 12h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2"/><path d="M18 22V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v18"/>',
    car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
    walk: '<circle cx="12" cy="5" r="1"/><path d="m9 20 3-6 3 6"/><path d="m6 8 6 2 6-2"/><path d="M12 10v4"/>',
    bus: '<path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    mic: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="23"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    external: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
    circle: '<circle cx="12" cy="12" r="9"/>',
    sprout: '<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
    plant: '<path d="M12 22v-9"/><path d="M12 13c0-3 2-5 5-5 0 3-2 5-5 5z"/><path d="M12 15c0-2.5-1.8-4.5-4.5-4.5 0 2.5 1.8 4.5 4.5 4.5z"/><path d="M7 22h10"/>',
    tree: '<path d="M8 19a4 4 0 0 1-2.24-7.32A3.5 3.5 0 0 1 9 6.03V6a3 3 0 1 1 6 0v.04a3.5 3.5 0 0 1 3.24 5.65A4 4 0 0 1 16 19Z"/><path d="M12 19v3"/>',
    flower: '<circle cx="12" cy="12" r="3"/><path d="M12 16.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 1 1 4.5 4.5 4.5 4.5 0 1 1-4.5 4.5"/><path d="M12 7.5V9"/><path d="M7.5 12H9"/><path d="M16.5 12H15"/><path d="M12 16.5V15"/><path d="m8 8 1.88 1.88"/><path d="M14.12 9.88 16 8"/><path d="m8 16 1.88-1.88"/><path d="M14.12 14.12 16 16"/>'
  };

  function svg(name) {
    return '<svg class="pf-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true" focusable="false">' + P[name] + '</svg>';
  }
  function icon(name) {
    return '<span class="pf-ic pf-' + name + '" aria-hidden="true">' + svg(name) + '</span>';
  }

  // ---- Emoji / glyph -> icon name ----------------------------------------
  const PAIRS = [
    ['\u{1F468}\u200D\u{1F469}\u200D\u{1F467}', 'users'],
    ['\u23F1', 'timer'], ['\u{1F50A}', 'volume'], ['\u{1F4CD}', 'pin'], ['\u{1F50D}', 'search'],
    ['\u{1F198}', 'lifebuoy'], ['\u{1F691}', 'ambulance'], ['\u260E', 'phone'], ['\u{1F4DE}', 'phone'],
    ['\u{1F4AC}', 'message'], ['\u2709', 'mail'], ['\u{1F4C4}', 'file'], ['\u{1F48A}', 'pill'],
    ['\u{1F464}', 'user'], ['\u{1F6A8}', 'siren'], ['\u26A0', 'alert'], ['\u2705', 'checkcircle'],
    ['\u26A1', 'zap'], ['\u{1F5FA}', 'map'], ['\u{1F3E5}', 'hospital'], ['\u{1F697}', 'car'],
    ['\u{1F6B6}', 'walk'], ['\u{1F68C}', 'bus'], ['\u{1F504}', 'refresh'], ['\u2795', 'plus'],
    ['\uFF0B', 'plus'], ['\u{1F5D1}', 'trash'], ['\u2699', 'settings'], ['\u{1F4F2}', 'smartphone'],
    ['\u{1F4E8}', 'send'], ['\u{1F399}', 'mic'], ['\u2713', 'check'], ['\u2714', 'check'],
    ['\u2715', 'x'], ['\u2716', 'x'], ['\u2192', 'arrow'], ['\u25B8', 'chevron'], ['\u2197', 'external'],
    ['\u25CB', 'circle'], ['\u{1F331}', 'sprout'], ['\u{1F33F}', 'leaf'], ['\u{1FAB4}', 'plant'],
    ['\u{1F333}', 'tree'], ['\u{1F338}', 'flower']
  ];
  const LOOKUP = {};
  PAIRS.forEach(function (p) { LOOKUP[p[0]] = p[1]; });
  const MATCH_RE = new RegExp('(' + PAIRS.map(function (p) { return p[0]; }).join('|') + ')\\uFE0F?', 'gu');
  const LEFTOVER_RE = /[\u{1F000}-\u{1FAFF}\u2600-\u27BF]\uFE0F?/gu;

  // Pure helper: text -> array of strings / {icon} parts (also used by the self test)
  function splitText(text, stripLeftover) {
    const parts = text.split(MATCH_RE);
    const out = [];
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 1) { out.push({ icon: LOOKUP[parts[i]] }); continue; }
      let s = parts[i];
      if (stripLeftover) s = s.replace(LEFTOVER_RE, '');
      if (s) out.push(s);
    }
    return out;
  }

  if (typeof document === 'undefined') {            // node self-test mode
    if (typeof module !== 'undefined') module.exports = { splitText: splitText, PAIRS: PAIRS, P: P };
    return;
  }

  // ---- DOM walker ----------------------------------------------------------
  const SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, OPTION: 1, SVG: 1, svg: 1 };

  function processTextNode(node) {
    const parent = node.parentNode;
    if (!parent || parent.nodeType !== 1) return;
    if (SKIP_TAGS[parent.tagName]) return;
    if (parent.closest && (parent.closest('[data-no-icons]') || parent.closest('.pf-ic'))) return;

    const text = node.nodeValue;
    if (!text) return;
    MATCH_RE.lastIndex = 0;
    LEFTOVER_RE.lastIndex = 0;
    const inAssistant = !!(parent.closest && parent.closest('.msg.assistant'));
    if (!MATCH_RE.test(text) && !(inAssistant && LEFTOVER_RE.test(text))) return;
    MATCH_RE.lastIndex = 0;

    const parts = splitText(text, inAssistant);
    const frag = document.createDocumentFragment();
    parts.forEach(function (part) {
      if (typeof part === 'string') {
        frag.appendChild(document.createTextNode(part));
      } else {
        const holder = document.createElement('span');
        holder.innerHTML = icon(part.icon);
        frag.appendChild(holder.firstChild);
      }
    });
    parent.replaceChild(frag, node);
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { processTextNode(root); return; }
    if (root.nodeType !== 1 || SKIP_TAGS[root.tagName]) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(processTextNode);
  }

  let observer = null;
  const OBS_OPTS = { childList: true, subtree: true, characterData: true };
  function onMutations(muts) {
    observer.disconnect();                 // our own edits must not re-trigger us
    try {
      muts.forEach(function (m) {
        if (m.type === 'characterData') processTextNode(m.target);
        else m.addedNodes.forEach(walk);
      });
    } finally {
      observer.observe(document.body, OBS_OPTS);
    }
  }

  // ---- Extras ----------------------------------------------------------------
  const TEXT_KEY = 'companion_text_size';

  // The scale is also set from JS, so it works even if a cached copy of
  // patient-ui.css is still loaded in the browser.
  const SCALES = { small: 0.8, normal: 1, large: 1.15, xlarge: 1.3 };

  function applyTextSize(size) {
    if (!SCALES[size]) size = 'normal';
    document.documentElement.setAttribute('data-pf-text', size);
    document.documentElement.style.setProperty('--pf-t', String(SCALES[size]));
    try { localStorage.setItem(TEXT_KEY, size); } catch (e) {}
    document.querySelectorAll('.pf-textsize-btns button').forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.size === size ? 'true' : 'false');
    });
  }

  function injectTextSizeControl() {
    if (document.querySelector('.pf-textsize')) return;
    const anchor = document.querySelector('.theme-switcher-bar');
    if (!anchor || !anchor.parentNode) return;
    const wrap = document.createElement('div');
    wrap.className = 'pf-textsize';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Text size');
    wrap.innerHTML =
      '<span class="pf-textsize-label">Text size</span>' +
      '<div class="pf-textsize-btns">' +
      '<button type="button" class="pf-ts-0" data-size="small" aria-label="Small text">A</button>' +
      '<button type="button" class="pf-ts-1" data-size="normal" aria-label="Normal text">A</button>' +
      '<button type="button" class="pf-ts-2" data-size="large" aria-label="Large text">A</button>' +
      '<button type="button" class="pf-ts-3" data-size="xlarge" aria-label="Extra large text">A</button>' +
      '</div>';
    anchor.parentNode.insertBefore(wrap, anchor);
    wrap.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () { applyTextSize(b.dataset.size); });
    });
  }

  function init() {
    let saved = 'normal';
    try { saved = localStorage.getItem(TEXT_KEY) || 'normal'; } catch (e) {}
    injectTextSizeControl();
    applyTextSize(saved);

    const sos = document.getElementById('sosBtn');
    if (sos) {
      sos.setAttribute('aria-label', 'Emergency SOS');
      if (!sos.querySelector('.pf-ic')) sos.insertAdjacentHTML('afterbegin', icon('lifebuoy'));
    }

    walk(document.body);
    observer = new MutationObserver(onMutations);
    observer.observe(document.body, OBS_OPTS);
  }

  window.PF_ICON = icon;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();