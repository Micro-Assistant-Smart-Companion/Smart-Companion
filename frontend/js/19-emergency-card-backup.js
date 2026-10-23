// [19/20] emergency card, backup and restore
// Part of the Smart Companion page script. Loaded by index.html in numeric order; all files share one global scope.

// ---- EMERGENCY MEDICAL CARD + BACKUP / RESTORE ----
// Paste at the very bottom of app.js, AFTER health_log_v2.js (it adds two tabs to that panel).
// Everything stays in this browser. Nothing here talks to the server.

const EC_KEY = 'companion_emergency_card';       // blood group, notes, "share in alert" switch
const BK_LAST = 'companion_last_backup';
const EC_BLOOD = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

(function ecInjectStyles() {
  const st = document.createElement('style');
  st.textContent = `
  .ec{border:1.5px solid var(--coral,#f43f5e);border-radius:12px;overflow:hidden;background:var(--bg-surface-elevated,var(--bg-subtle))}
  .ec-head{background:var(--coral,#f43f5e);color:#fff;font-weight:800;font-size:12px;letter-spacing:.08em;padding:6px 12px}
  .ec-body{padding:12px;display:grid;gap:8px}
  .ec-top{display:flex;justify-content:space-between;align-items:center;gap:10px}
  .ec-name{font-size:16px;font-weight:700;color:var(--text-primary)}
  .ec-sub{font-size:12px;color:var(--text-muted)}
  .ec-blood{font-size:30px;font-weight:800;color:var(--coral,#f43f5e);border:2px solid var(--coral,#f43f5e);border-radius:10px;padding:2px 12px;min-width:56px;text-align:center}
  .ec-row{display:grid;grid-template-columns:96px 1fr;gap:8px;font-size:13.5px;color:var(--text-primary)}
  .ec-l{color:var(--text-muted);font-size:11px;font-weight:700;letter-spacing:.05em;padding-top:2px}
  .ec-row.alert .ec-v{color:var(--coral,#f43f5e);font-weight:700}
  .ec-row a{color:var(--teal,#0d9488);font-weight:700;text-decoration:none}
  .ec-big .ec-name{font-size:30px}.ec-big .ec-sub{font-size:16px}.ec-big .ec-row{font-size:21px;grid-template-columns:140px 1fr}
  .ec-big .ec-l{font-size:13px}.ec-big .ec-blood{font-size:68px;padding:4px 20px}.ec-big .ec-body{gap:14px}
  .ec-full{position:fixed;inset:0;z-index:1100;background:#fff;overflow:auto;padding:14px;
    --text-primary:#111;--text-muted:#555;--bg-surface-elevated:#fff;--bg-subtle:#fff;--teal:#0b6b62}
  .ec-full .hl2-btn{margin-top:12px}
  #sosMedCard{margin:10px 0}
  .ec-empty{padding:12px;font-size:13px;color:var(--text-secondary)}
  .bk-drop{border:1px solid var(--border-subtle);border-radius:10px;padding:10px;margin-top:8px;background:var(--bg-surface-elevated,var(--bg-subtle))}
  .bk-counts{font-size:13px;line-height:1.6;color:var(--text-primary)}
  .hl2-nudge{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:9px 12px;margin-bottom:10px;border-radius:10px;
    border:1px solid var(--accent-purple,#7c5cff);background:var(--accent-purple-subtle,rgba(124,92,255,.10));font-size:13px;color:var(--text-primary)}
  `;
  document.head.appendChild(st);
})();

// =====================================================================
//  EMERGENCY CARD
// =====================================================================

function ecGet() {
  const c = hlGet(EC_KEY, {});
  return { blood: c.blood || '', notes: c.notes || '', share: c.share !== false };
}
function ecSet(patch) { hlSet(EC_KEY, Object.assign(ecGet(), patch)); }

// name / age / allergies are shared with the "About me" box of the doctor report (one place to edit)
function ecData() {
  const c = ecGet(), prof = hlGet(HL.profile, {});
  let contacts = [];
  try { contacts = loadEmergencyContacts().slice(0, 2); } catch (e) {}
  return {
    name: prof.name || '', age: prof.age || '', allergies: prof.allergies || '',
    blood: c.blood, notes: c.notes, share: c.share,
    conds: hlGet(HL.conds, []).map(x => x.name).filter(Boolean),
    meds: hlMeds().filter(m => m.active).map(m => [m.name, m.dose].filter(Boolean).join(' ')),
    contacts,
  };
}
function ecIsEmpty(d) { return !(d.blood || d.allergies || d.notes || d.conds.length || d.meds.length || d.name); }

function ecHtml(d, big) {
  const row = (label, val, cls) => val ? `<div class="ec-row ${cls || ''}"><span class="ec-l">${label}</span><span class="ec-v">${hlEsc(val)}</span></div>` : '';
  const phones = d.contacts.filter(c => c && c.phone).map(c => {
    const digits = String(c.phone).replace(/\D/g, '');
    return `<a href="tel:${digits}">📞 ${hlEsc(c.name || 'Contact')} ${hlEsc(c.phone)}</a>`;
  }).join('<br>');
  return `<div class="ec ${big ? 'ec-big' : ''}"><div class="ec-head">MEDICAL EMERGENCY CARD</div><div class="ec-body">
    <div class="ec-top"><div><div class="ec-name">${hlEsc(d.name || 'Name not added')}</div>${d.age ? `<div class="ec-sub">${hlEsc(d.age)} years</div>` : ''}</div>
      ${d.blood ? `<div class="ec-blood" aria-label="Blood group ${hlEsc(d.blood)}">${hlEsc(d.blood)}</div>` : ''}</div>
    ${row('ALLERGIES', d.allergies, 'alert')}
    ${row('CONDITIONS', d.conds.join(', '))}
    ${row('MEDICINES', d.meds.join(', '))}
    ${row('IMPORTANT', d.notes)}
    ${phones ? `<div class="ec-row"><span class="ec-l">CALL</span><span class="ec-v">${phones}</span></div>` : ''}
  </div></div>`;
}

// lines added to the SOS message the user taps to send (only if the "share" switch is on)
function ecAlertLines() {
  const d = ecData();
  if (!d.share) return '';
  const p = [];
  if (d.blood) p.push(`Blood group: ${d.blood}`);
  if (d.allergies) p.push(`Allergies: ${d.allergies}`);
  if (d.conds.length) p.push(`Conditions: ${d.conds.slice(0, 6).join(', ')}`);
  if (d.meds.length) p.push(`Medicines: ${d.meds.slice(0, 8).join(', ')}`);
  if (d.notes) p.push(`Important: ${d.notes}`);
  return p.length ? `🩺 My medical info:\n${p.join('\n')}\n\n` : '';
}

// the card inside the SOS screen
function ecRenderSos(el) {
  if (!el) return;
  const d = ecData();
  if (ecIsEmpty(d)) {
    el.innerHTML = `<div class="ec"><div class="ec-head">MEDICAL EMERGENCY CARD</div><div class="ec-empty">
      Your card is empty. Add your blood group and allergies once, and they will show here in an emergency.
      <div style="margin-top:8px"><button type="button" class="hl2-btn small" id="ecSosAdd">Add now</button></div></div></div>`;
    const b = el.querySelector('#ecSosAdd');
    if (b) b.onclick = () => hlOpenPanel('card');
    return;
  }
  el.innerHTML = ecHtml(d, false) +
    `<div style="margin-top:8px"><button type="button" class="hl2-btn small ghost" id="ecSosFull">Show full screen to a helper</button></div>`;
  el.querySelector('#ecSosFull').onclick = ecShowFull;
}

function ecShowFull() {
  const ov = document.createElement('div');
  ov.className = 'ec-full'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
  ov.innerHTML = ecHtml(ecData(), true) + `<button type="button" class="hl2-btn wide ghost" id="ecFullClose" style="color:#111;border-color:#999">Close</button>`;
  document.body.appendChild(ov);
  ov.querySelector('#ecFullClose').onclick = () => ov.remove();
}

// a picture of the card (for a phone lock screen, or to print)
function ecDownloadPng() {
  const d = ecData(), W = 1080, H = 1920, pad = 64, maxW = W - pad * 2;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const FONT = "'Noto Sans','Noto Sans Devanagari','Noto Sans Bengali',system-ui,Arial,sans-serif";
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#c0182f'; g.fillRect(0, 0, W, 160);
  g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.font = `800 60px ${FONT}`;
  g.fillText('MEDICAL EMERGENCY CARD', pad, 80);
  g.textBaseline = 'top';
  let y = 210;
  const limit = H - 150;
  const text = (s, size, weight, color, lh) => {
    g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = color;
    let line = '';
    for (const w of String(s).split(/\s+/)) {
      const t = line ? line + ' ' + w : w;
      if (g.measureText(t).width > maxW && line) { if (y < limit) g.fillText(line, pad, y); y += lh; line = w; } else line = t;
    }
    if (line) { if (y < limit) g.fillText(line, pad, y); y += lh; }
  };
  const block = (label, val, color) => {
    if (!val) return;
    text(label, 28, 700, '#666', 40); text(val, 44, 600, color || '#111', 58); y += 22;
  };
  text(d.name || 'Name not added', 64, 800, '#111', 80);
  if (d.age) text(`${d.age} years`, 36, 500, '#444', 50);
  y += 10;
  if (d.blood) {
    text('BLOOD GROUP', 28, 700, '#666', 40);
    g.font = `800 190px ${FONT}`; g.fillStyle = '#c0182f'; g.fillText(d.blood, pad, y); y += 230;
  }
  block('ALLERGIES', d.allergies, '#c0182f');
  block('CONDITIONS', d.conds.join(', '));
  const meds = d.meds.slice(0, 10).join(', ') + (d.meds.length > 10 ? `  (+${d.meds.length - 10} more)` : '');
  block('MEDICINES', meds);
  block('IMPORTANT', d.notes);
  if (d.contacts.length) block('CALL', d.contacts.map(c => `${c.name || 'Contact'}: ${c.phone}`).join('   '));
  g.font = `400 26px ${FONT}`; g.fillStyle = '#777'; g.textBaseline = 'alphabetic';
  g.fillText(`Updated ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · Smart Companion · please confirm with the patient or a doctor`, pad, H - 50, maxW);
  cv.toBlob(b => bkDownload(b, 'Emergency-card.png'), 'image/png');
}

function hlTabCard(body) {
  const d = ecData();
  body.innerHTML = `
    <p class="hl2-hint">Fill this once. In an emergency it appears on the SOS screen so a helper can read it in seconds.</p>
    <div class="hl2-card">
      <div class="hl2-row"><input id="ecName" placeholder="Full name" value="${hlEsc(d.name)}"><input id="ecAge" placeholder="Age" value="${hlEsc(d.age)}">
        <select id="ecBlood" aria-label="Blood group">${EC_BLOOD.map(b => `<option value="${b}" ${b === d.blood ? 'selected' : ''}>${b || 'Blood group'}</option>`).join('')}</select></div>
      <div class="hl2-row"><input id="ecAll" placeholder="Allergies (e.g. Penicillin, peanuts)" value="${hlEsc(d.allergies)}"></div>
      <textarea id="ecNotes" placeholder="Anything a helper must know (e.g. diabetic, on blood thinners, has a pacemaker)">${hlEsc(d.notes)}</textarea>
      <label style="display:flex;gap:8px;align-items:flex-start;margin-top:10px;font-size:13px;color:var(--text-primary)">
        <input type="checkbox" id="ecShare" ${d.share ? 'checked' : ''} style="width:18px;height:18px;margin-top:2px">
        <span>Add these details to the SOS message I send to my emergency contact (I still tap Send myself)</span></label>
    </div>
    <p class="hl2-hint">Your conditions and current medicines come from the Conditions and Medicines tabs. Name, age and allergies are shared with the doctor report.</p>
    <div class="hl2-sub">PREVIEW</div><div id="ecPreview"></div>
    <div class="hl2-row" style="margin-top:10px">
      <button class="hl2-btn" id="ecFull" type="button">Show full screen</button>
      <button class="hl2-btn ghost" id="ecPng" type="button">Save as picture</button></div>
    <p class="hl2-hint">Tip: set the saved picture as your phone's lock-screen wallpaper, so anyone can read it without unlocking your phone.</p>
    <div class="hl2-hint" id="ecContactsHint"></div>`;

  const q = s => body.querySelector(s);
  const preview = () => { q('#ecPreview').innerHTML = ecHtml(ecData(), false); };
  const saveProfile = () => hlSet(HL.profile, Object.assign(hlGet(HL.profile, {}), { name: q('#ecName').value.trim(), age: q('#ecAge').value.trim(), allergies: q('#ecAll').value.trim() }));
  ['#ecName', '#ecAge', '#ecAll'].forEach(s => q(s).oninput = () => { saveProfile(); preview(); });
  q('#ecBlood').onchange = e => { ecSet({ blood: e.target.value }); preview(); };
  q('#ecNotes').oninput = e => { ecSet({ notes: e.target.value.trim() }); preview(); };
  q('#ecShare').onchange = e => ecSet({ share: e.target.checked });
  q('#ecFull').onclick = ecShowFull;
  q('#ecPng').onclick = ecDownloadPng;
  preview();

  const hint = q('#ecContactsHint');
  if (d.contacts.length) {
    hint.textContent = `Emergency contact: ${d.contacts.map(c => c.name || c.phone).join(', ')}. You can change it from the SOS screen.`;
  } else {
    hint.innerHTML = 'No emergency contact yet. Add one so the SOS message has someone to go to. ';
    if (typeof showEmergencyContactsModal === 'function') {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'hl2-btn small ghost'; b.textContent = 'Add a contact';
      b.onclick = () => showEmergencyContactsModal(); hint.appendChild(b);
    }
  }
}

// =====================================================================
//  BACKUP / RESTORE
// =====================================================================

// what gets saved. (Not included: last location, camera address, backup date: they belong to this device only.)
const BK_KEYS = ['companion_health_log', 'companion_medicines', 'companion_conditions', 'companion_profile',
  'companion_doctor_notes', 'companion_report_range', 'companion_emergency_contacts', 'companion_emergency_card',
  'companion_gamify', 'companion_lang', 'companion_theme', 'companion_dose_log', 'companion_reminder_prefs'];
const BK_CHATS = 'companion_sessions';
const BK_ITER = 250000;
const bkCanEncrypt = () => !!(window.crypto && crypto.subtle);

function bkDownload(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function bkB64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
function bkUnB64(s) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }

function bkCollect(includeChats) {
  const data = {};
  BK_KEYS.concat(includeChats ? [BK_CHATS] : []).forEach(k => { try { const v = localStorage.getItem(k); if (v !== null) data[k] = v; } catch (e) {} });
  return { app: 'smart-companion', kind: 'backup', version: 1, note: 'Smart Companion backup. Open the app and choose Restore on the welcome screen.', exportedAt: new Date().toISOString(), includesChats: !!includeChats, data };
}

async function bkKey(password, salt, iter) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function bkEncrypt(obj, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await bkKey(password, salt, BK_ITER);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
  return { app: 'smart-companion', kind: 'backup', version: 1, encrypted: true, kdf: 'PBKDF2-SHA256', iter: BK_ITER, salt: bkB64(salt), iv: bkB64(iv), ciphertext: bkB64(new Uint8Array(ct)) };
}
async function bkDecrypt(env, password) {
  const key = await bkKey(password, bkUnB64(env.salt), Math.min(Number(env.iter) || BK_ITER, 1000000));
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bkUnB64(env.iv) }, key, bkUnB64(env.ciphertext));
  return JSON.parse(new TextDecoder().decode(pt));
}

// returns only the allowed keys, each a string; throws a readable message if it is not one of our backups
function bkValidate(obj) {
  if (!obj || obj.app !== 'smart-companion' || obj.kind !== 'backup') throw new Error('This is not a Smart Companion backup file.');
  if (obj.version !== 1) throw new Error('This backup was made by a newer version of the app.');
  if (!obj.data || typeof obj.data !== 'object') throw new Error('The backup file is empty or damaged.');
  const allowed = new Set(BK_KEYS.concat([BK_CHATS])), clean = {};
  Object.keys(obj.data).forEach(k => { if (allowed.has(k) && typeof obj.data[k] === 'string') clean[k] = obj.data[k]; });
  if (!Object.keys(clean).length) throw new Error('The backup file has no data in it.');
  return { data: clean, exportedAt: obj.exportedAt || '' };
}

function bkParse(raw, fallback) { try { const v = JSON.parse(raw); return v === null || v === undefined ? fallback : v; } catch (e) { return fallback; } }
function bkCount(data) {
  const n = k => { const v = bkParse(data[k], []); return Array.isArray(v) ? v.length : 0; };
  const card = bkParse(data.companion_emergency_card, {}) || {};
  const sess = bkParse(data[BK_CHATS], {}) || {};
  return {
    readings: n('companion_health_log'), medicines: n('companion_medicines'), conditions: n('companion_conditions'),
    contacts: n('companion_emergency_contacts'), card: !!(card.blood || card.notes),
    chats: Object.keys(sess).length,
  };
}
function bkCountText(c) {
  const bits = [`${c.readings} reading${c.readings === 1 ? '' : 's'}`, `${c.medicines} medicine${c.medicines === 1 ? '' : 's'}`,
    `${c.conditions} condition${c.conditions === 1 ? '' : 's'}`, `${c.contacts} emergency contact${c.contacts === 1 ? '' : 's'}`];
  if (c.card) bits.push('emergency card');
  if (c.chats) bits.push(`${c.chats} chat topic${c.chats === 1 ? '' : 's'}`);
  return bits.join(' · ');
}
function bkCurrentData() {
  const d = {}; BK_KEYS.concat([BK_CHATS]).forEach(k => { try { const v = localStorage.getItem(k); if (v !== null) d[k] = v; } catch (e) {} }); return d;
}

// how to decide "is this the same item?" when merging two lists
function bkIdentity(key, x) {
  if (!x || typeof x !== 'object') return JSON.stringify(x);
  const low = s => String(s || '').trim().toLowerCase();
  if (key === 'companion_medicines') return 'm|' + low(x.name) + '|' + low(x.dose ?? x.dosage);
  if (key === 'companion_conditions') return 'c|' + low(x.name);
  if (key === 'companion_emergency_contacts') return 'p|' + String(x.phone || '').replace(/\D/g, '');
  return 'i|' + (x.id ?? JSON.stringify(x));
}
function bkMergeKey(key, incoming) {
  const cur = localStorage.getItem(key);
  if (cur === null || cur === '') { localStorage.setItem(key, incoming); return; }
  const a = bkParse(cur, undefined), b = bkParse(incoming, undefined);
  if (Array.isArray(a) && Array.isArray(b)) {
    const seen = new Set(a.map(x => bkIdentity(key, x)));
    const extra = b.filter(x => !seen.has(bkIdentity(key, x)));
    if (!extra.length) return;
    let all = a.concat(extra);
    if (key === 'companion_health_log') all.sort((p, q) => new Date(q.timestamp) - new Date(p.timestamp));
    localStorage.setItem(key, JSON.stringify(all));
  } else if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const mine = Object.fromEntries(Object.entries(a).filter(([, v]) => v !== '' && v !== null && v !== undefined));
    localStorage.setItem(key, JSON.stringify(Object.assign({}, b, mine)));
  }
  // anything else (plain text like language or theme): keep what is already here
}
function bkApply(data, mode) {
  let failed = 0;
  Object.keys(data).forEach(k => {
    try { mode === 'replace' ? localStorage.setItem(k, data[k]) : bkMergeKey(k, data[k]); } catch (e) { failed++; }
  });
  if (mode === 'replace') {
    BK_KEYS.forEach(k => { if (!(k in data)) { try { localStorage.removeItem(k); } catch (e) {} } });
    if (BK_CHATS in data) {/* already written */}
  }
  return failed;
}

function bkAgo(iso) {
  const t = new Date(iso).getTime(); if (!t) return '';
  const d = Math.floor((Date.now() - t) / 86400000);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
}
function bkHasData() { return !!(hlGet(HL.vitals, []).length || hlGet(HL.meds, []).length || hlGet(HL.conds, []).length); }
function bkNeedsNudge() {
  if (!bkHasData()) return false;
  let last = ''; try { last = localStorage.getItem(BK_LAST) || ''; } catch (e) {}
  if (typeof syGet === 'function' && syGet()) return false;        // sync keeps it safe automatically
  return !last || (Date.now() - new Date(last).getTime()) > 30 * 86400000;
}

function hlTabBackup(body, rerender) {
  let last = ''; try { last = localStorage.getItem(BK_LAST) || ''; } catch (e) {}
  const lock = bkCanEncrypt(), sy = (typeof syGet === 'function') && syGet();
  body.innerHTML = `
    <p class="hl2-hint">Your health data is kept on this device. Turn on sync for an automatic private copy, and keep a backup file as a second safety net. On a new phone, choose "Restore" on the welcome screen with either one.</p>
    ${typeof syCardHtml === 'function' ? syCardHtml() : ''}
    <div class="hl2-card"><div class="hl2-card-title">💾 Save a backup file</div>
      <div class="hl2-hint" style="margin-bottom:8px">${last ? `Last backup: ${hlEsc(bkAgo(last))}` : 'You have not made a backup yet.'}</div>
      <label style="display:flex;gap:8px;align-items:center;font-size:13px;margin-bottom:8px"><input type="checkbox" id="bkChats" style="width:18px;height:18px"> Also include my chat history (bigger file)</label>
      ${sy ? `<div class="hl2-hint" style="margin:0 0 8px">🔒 This file is locked with your Sync key, so there is no second password to remember. To open it later you need that key.</div>`
        : lock ? `<input id="bkPass" type="password" autocomplete="new-password" placeholder="Password to protect the file (optional)" style="margin-bottom:6px">
        <div class="hl2-hint" style="margin:0 0 8px">If you set a password, nobody can open the file without it, and <b>we cannot recover it</b> if you forget it.</div>`
        : `<div class="hl2-hint" style="margin:0 0 8px">Password protection needs a secure page (https or localhost), so it is switched off here.</div>`}
      <button class="hl2-btn wide" id="bkSave" type="button">⬇ Download backup</button>
      <div class="hl2-err" id="bkSaveMsg"></div>
      <div class="hl2-hint" style="margin:6px 0 0">The file contains your health details. Keep it somewhere private.</div></div>
    <div class="hl2-card"><div class="hl2-card-title">♻️ Restore from a backup</div>
      <label class="hl2-upload"><span style="font-size:22px">📂</span><span>Choose a backup file<small>The file you downloaded earlier (.json)</small></span>
        <input type="file" id="bkFile" accept=".json,application/json" hidden></label>
      <div class="hl2-err" id="bkRestoreMsg"></div><div id="bkPreview"></div></div>`;

  const q = s => body.querySelector(s);
  if (typeof syBind === 'function') syBind(body, rerender || (() => hlTabBackup(body, rerender)));

  q('#bkSave').onclick = async ev => {
    const btn = ev.currentTarget, msg = q('#bkSaveMsg'); msg.textContent = ''; msg.className = 'hl2-err';
    btn.disabled = true;
    try {
      const plain = bkCollect(q('#bkChats').checked);
      const pass = (!sy && lock && q('#bkPass')) ? q('#bkPass').value : '';
      const out = sy ? await bkEncryptWithSync(plain, sy.key) : pass ? await bkEncrypt(plain, pass) : plain;
      const day = new Date().toISOString().slice(0, 10);
      bkDownload(new Blob([JSON.stringify(out)], { type: 'application/json' }), `smart-companion-backup-${day}${(pass || sy) ? '-protected' : ''}.json`);
      try { localStorage.setItem(BK_LAST, new Date().toISOString()); } catch (e) {}
      msg.className = 'hl2-ok'; msg.textContent = `✓ Saved. ${bkCountText(bkCount(plain.data))}`;
    } catch (e) { console.error(e); msg.textContent = 'Could not make the backup. Please try again.'; }
    btn.disabled = false;
  };

  q('#bkFile').onchange = async ev => {
    const f = ev.target.files[0]; ev.target.value = '';
    const msg = q('#bkRestoreMsg'), box = q('#bkPreview'); msg.textContent = ''; box.innerHTML = '';
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { msg.textContent = 'That file is too big to be a backup.'; return; }
    let parsed;
    try { parsed = JSON.parse(await f.text()); } catch (e) { msg.textContent = 'That file could not be read. Is it the backup file you downloaded?'; return; }
    try {
      if (parsed && parsed.encrypted) return bkAskPassword(parsed, box, msg);
      bkShowPreview(bkValidate(parsed), box, msg);
    } catch (e) { msg.textContent = e.message; }
  };
}

function bkAskPassword(env, box, msg) {
  if (!bkCanEncrypt()) { msg.textContent = 'This backup is password protected. Open the app on https or localhost to unlock it.'; return; }
  const sync = env.kdf === 'sync-key';
  box.innerHTML = `<div class="bk-drop"><div class="hl2-hint" style="margin-bottom:6px">This backup is protected. Enter ${sync ? 'your Sync key' : 'its password'}.</div>
    <div class="hl2-row"><input id="bkUnlockPass" type="${sync ? 'text' : 'password'}" autocomplete="off" placeholder="${sync ? 'ABCD-EFGH-…' : 'Password'}"><button class="hl2-btn" id="bkUnlock" type="button">Unlock</button></div></div>`;
  const go = async () => {
    msg.textContent = '';
    try { const pw = box.querySelector('#bkUnlockPass').value; bkShowPreview(bkValidate(sync ? await bkDecryptWithSync(env, pw) : await bkDecrypt(env, pw)), box, msg); }
    catch (e) { msg.textContent = e && e.message && !/operation/i.test(e.message) ? e.message : (sync ? 'That key does not open this file.' : 'Wrong password, or the file is damaged.'); }
  };
  box.querySelector('#bkUnlock').onclick = go;
  box.querySelector('#bkUnlockPass').onkeydown = e => { if (e.key === 'Enter') go(); };
}

function bkShowPreview(v, box, msg) {
  const inc = bkCount(v.data), cur = bkCount(bkCurrentData());
  box.innerHTML = `<div class="bk-drop"><div class="hl2-card-title">This backup${v.exportedAt ? ` (${hlEsc(hlDate(v.exportedAt))})` : ''} has:</div>
    <div class="bk-counts">${hlEsc(bkCountText(inc))}</div>
    <div class="hl2-hint" style="margin:8px 0">On this device now: ${hlEsc(bkCountText(cur))}</div>
    <button class="hl2-btn wide" id="bkMerge" type="button">Add what is missing (recommended)</button>
    <div class="hl2-hint" style="margin:4px 0 10px">Keeps everything here and adds only the items you do not have yet.</div>
    <button class="hl2-btn wide ghost danger" id="bkReplace" type="button">Replace everything with this backup</button></div>`;
  const finish = (mode) => {
    const failed = bkApply(v.data, mode);
    msg.className = failed ? 'hl2-err' : 'hl2-ok';
    msg.textContent = failed ? `Restored, but ${failed} item(s) could not be saved (the browser storage may be full).` : '✓ Restored. Reloading…';
    if (!failed) setTimeout(() => location.reload(), 1200);
  };
  box.querySelector('#bkMerge').onclick = () => finish('merge');
  box.querySelector('#bkReplace').onclick = async () => {
    if (await askConfirm({ title: 'Replace everything on this phone?', message: 'Your current health data here will be swapped for the data in the backup.', ok: 'Yes, replace', cancel: 'No, go back', danger: true })) finish('replace');
  };
}

// small reminder at the top of "Today" when there is data but no recent backup
function bkNudgeHtml() {
  return bkNeedsNudge()
    ? `<div class="hl2-nudge"><span>💾 Your data is only on this device. Turn on sync or save a backup.</span><button type="button" class="hl2-btn small" id="bkNudgeGo">Back up</button></div>` : '';
}