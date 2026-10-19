// encrypted sync and the welcome restore screen
//  ENCRYPTED SYNC + WELCOME RESTORE. The browser encrypts everything with a key made from the user's Sync key. The server only stores scrambled text it cannot open.

const SY_STATE = 'companion_sync';           // { key, rev, last, hash }  (stays on this device, not in backups)
const SY_WELCOME = 'companion_welcome_done';
const SY_B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
let syMerging = false, syBusy = false, syTimer = null, syMsg = '';

const syGet = () => { try { return JSON.parse(localStorage.getItem(SY_STATE) || 'null'); } catch (e) { return null; } };
const sySet = s => { try { s ? localStorage.setItem(SY_STATE, JSON.stringify(s)) : localStorage.removeItem(SY_STATE); } catch (e) {} };
const syCan = () => !!(window.crypto && crypto.subtle);

// ----- the Sync key: 16 random bytes shown as 26 letters/digits in groups of 4 -----
function syNewKey() {
  const b = crypto.getRandomValues(new Uint8Array(16)); let bits = '', out = '';
  b.forEach(x => bits += x.toString(2).padStart(8, '0'));
  for (let i = 0; i < 130; i += 5) out += SY_B32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  return out.match(/.{1,4}/g).join('-');
}
function syBytes(keyStr) {            // text -> the 16 bytes (throws if it is not a valid key)
  const s = String(keyStr || '').toUpperCase().replace(/0/g, 'O').replace(/1/g, 'I').replace(/8/g, 'B').replace(/[^A-Z2-7]/g, '');
  if (s.length !== 26) throw new Error('A Sync key has 26 letters and numbers (like ABCD-EFGH-…). Please check it.');
  let bits = ''; for (const ch of s) bits += SY_B32.indexOf(ch).toString(2).padStart(5, '0');
  const out = new Uint8Array(16); for (let i = 0; i < 16; i++) out[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  return out;
}
function syNorm(keyStr) { syBytes(keyStr); return String(keyStr).toUpperCase().replace(/0/g, 'O').replace(/1/g, 'I').replace(/8/g, 'B').replace(/[^A-Z2-7]/g, '').match(/.{1,4}/g).join('-'); }
const syHex = u8 => Array.from(u8).map(x => x.toString(16).padStart(2, '0')).join('');

// ----- one secret key -> three separate values: account id, access token, encryption key -----
async function syDerive(keyStr) {
  const base = await crypto.subtle.importKey('raw', syBytes(keyStr), 'HKDF', false, ['deriveBits', 'deriveKey']);
  const salt = new TextEncoder().encode('smart-companion-sync-v1');
  const bits = info => crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode(info) }, base, 256);
  const enc = await crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('enc') }, base,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  return { id: syHex(new Uint8Array(await bits('id'))), token: syHex(new Uint8Array(await bits('token'))), enc };
}
async function syEncrypt(obj, enc) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, enc, new TextEncoder().encode(JSON.stringify(obj)));
  return { iv: bkB64(iv), ciphertext: bkB64(new Uint8Array(ct)) };
}
async function syDecrypt(env, enc) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bkUnB64(env.iv) }, enc, bkUnB64(env.ciphertext));
  return JSON.parse(new TextDecoder().decode(pt));
}

// ----- talking to the server -----
async function syReq(method, d, body) {
  const r = await fetch(`${API}/sync/${d.id}`, { method, headers: Object.assign({ Authorization: 'Bearer ' + d.token }, body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, json: j };
}
function syMergeIn(remoteObj) {          // add anything we do not have yet; never throws away local data
  const v = bkValidate(remoteObj);
  syMerging = true; try { bkApply(v.data, 'merge'); } finally { syMerging = false; }
}

// one full round: get -> merge -> send. Safe to call any time.
async function syRun() {
  const st = syGet(); if (!st || !st.key || syBusy || !syCan()) return;
  syBusy = true;
  try {
    const d = await syDerive(st.key); let rev = st.rev || 0;
    const g = await syReq('GET', d);
    if (g.status === 403) throw new Error('This device\'s Sync key is no longer valid.');
    if (g.status === 200 && g.json.rev !== rev) { syMergeIn(await syDecrypt(JSON.parse(g.json.blob), d.enc)); rev = g.json.rev; }
    if (g.status === 404) rev = 0;
    for (let tries = 0; tries < 3; tries++) {
      const payload = bkCollect(false), hash = JSON.stringify(payload.data);
      if (g.status === 200 && hash === st.hash && rev === g.json.rev) break;           // nothing new to send
      const p = await syReq('PUT', d, { base_rev: rev, blob: JSON.stringify(await syEncrypt(payload, d.enc)) });
      if (p.status === 200) { sySet(Object.assign(syGet() || st, { rev: p.json.rev, hash, last: new Date().toISOString() })); break; }
      if (p.status === 409) { const det = p.json.detail; syMergeIn(await syDecrypt(JSON.parse(det.blob), d.enc)); rev = det.rev; continue; }
      throw new Error('Server said ' + p.status);
    }
    sySet(Object.assign(syGet() || st, { rev, last: new Date().toISOString() })); syMsg = '';
  } catch (e) { console.warn('sync:', e); syMsg = /fetch|network/i.test(e.message) ? 'offline' : 'error'; }
  syBusy = false; syRefreshUi();
}
function syLater() { clearTimeout(syTimer); syTimer = setTimeout(syRun, 4000); }

// any change to saved health data triggers a sync a few seconds later
(function syWatch() {
  const all = new Set(BK_KEYS);
  const set = Storage.prototype.setItem, rem = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (k, v) { set.call(this, k, v); if (!syMerging && this === localStorage && all.has(k) && syGet()) syLater(); };
  Storage.prototype.removeItem = function (k) { rem.call(this, k); if (!syMerging && this === localStorage && all.has(k) && syGet()) syLater(); };
  window.addEventListener('online', () => syGet() && syRun());
  document.addEventListener('visibilitychange', () => { if (!document.hidden && syGet()) syRun(); });
  setTimeout(() => syGet() && syRun(), 2000);
})();

// ----- turn on / off / restore -----
async function syTurnOn() {
  const key = syNewKey(); sySet({ key, rev: 0, hash: '', last: '' });
  await syRun();
  const st = syGet();
  if (!st || !st.last) { sySet(null); throw new Error('Could not reach the server. Check your connection and try again.'); }
  return key;
}
async function syTurnOff(deleteRemote) {
  const st = syGet(); if (!st) return;
  if (deleteRemote) { try { await syReq('DELETE', await syDerive(st.key)); } catch (e) { throw new Error('Could not reach the server, so nothing was deleted. Try again when online.'); } }
  sySet(null);
}
// bring data back on a new device from the Sync key
async function syRestoreFromKey(keyStr) {
  const d = await syDerive(keyStr);
  const g = await syReq('GET', d);
  if (g.status === 404 || g.status === 403) throw new Error('No saved data was found for this key. Check the key, or use a backup file instead.');
  if (g.status !== 200) throw new Error('Could not reach the server.');
  const obj = await syDecrypt(JSON.parse(g.json.blob), d.enc);
  const v = bkValidate(obj);
  syMerging = true; try { bkApply(v.data, 'merge'); } finally { syMerging = false; }
  sySet({ key: syNorm(keyStr), rev: g.json.rev, hash: JSON.stringify(bkCollect(false).data), last: new Date().toISOString() });
  return v;
}

// ----- backup FILE protected with the same Sync key (one secret to remember, not two) -----
async function bkEncryptWithSync(obj, keyStr) {
  const d = await syDerive(keyStr), e = await syEncrypt(obj, d.enc);
  return { app: 'smart-companion', kind: 'backup', version: 1, encrypted: true, kdf: 'sync-key',
    note: 'Smart Companion backup. Open the app and choose "Restore" on the welcome screen.', iv: e.iv, ciphertext: e.ciphertext };
}
async function bkDecryptWithSync(env, keyStr) { return syDecrypt(env, (await syDerive(keyStr)).enc); }

// ----- the card shown at the top of Health Log -> Backup -----
function syCardHtml() {
  const st = syGet();
  if (!syCan()) return `<div class="hl2-card"><div class="hl2-card-title">☁️ Automatic encrypted sync</div><div class="hl2-hint">Needs a secure page (https). It is switched off here.</div></div>`;
  if (!st) return `<div class="hl2-card"><div class="hl2-card-title">☁️ Automatic encrypted sync</div>
    <div class="hl2-hint" style="margin-bottom:8px">Keeps a private copy of your health data so you never lose it, even if you lose your phone. It is locked on your device with a key only you hold. <b>Our server cannot read it.</b></div>
    <button class="hl2-btn wide" id="syOn" type="button">Turn on sync</button><div class="hl2-err" id="syMsg"></div></div>`;
  const when = st.last ? bkAgo(st.last) : '';
  return `<div class="hl2-card"><div class="hl2-card-title">☁️ Sync is on <span id="syStatus" class="hl2-tag">${hlEsc(syStatusText())}</span></div>
    <div class="hl2-hint" style="margin-bottom:8px">${when ? `Last synced ${hlEsc(when)}. ` : ''}Changes are saved automatically. Chat history is not synced.</div>
    <div class="hl2-sub" style="margin-top:4px">YOUR SYNC KEY</div>
    <div id="syKeyBox" style="display:none"><div style="font:700 17px/1.4 monospace;letter-spacing:.04em;word-break:break-all;padding:10px;border:1px dashed var(--accent-purple,#7c5cff);border-radius:10px;margin:4px 0 8px;color:var(--text-primary)">${hlEsc(st.key)}</div>
      <div class="hl2-row"><button class="hl2-btn ghost" id="syCopy" type="button">Copy</button><button class="hl2-btn ghost" id="syDl" type="button">Save as file</button></div></div>
    <button class="hl2-btn ghost wide" id="syShow" type="button">Show my key</button>
    <div class="hl2-hint" style="margin:6px 0 8px">Save this key somewhere safe (a note, a printout, a family member). It is the <b>only</b> way to get your data on a new phone. We cannot recover it.</div>
    <button class="hl2-btn ghost wide danger" id="syOff" type="button">Turn off sync and delete my copy from the server</button><div class="hl2-err" id="syMsg"></div></div>`;
}
function syStatusText() { return syMsg === 'offline' ? 'waiting for internet' : syMsg === 'error' ? 'problem, will retry' : syBusy ? 'syncing…' : 'up to date'; }
function syRefreshUi() { const s = document.getElementById('syStatus'); if (s) s.textContent = syStatusText(); }

function syBind(body, rerender) {
  const q = s => body.querySelector(s), msg = text => { const m = q('#syMsg'); if (m) { m.className = 'hl2-err'; m.textContent = text; } };
  if (q('#syOn')) q('#syOn').onclick = async ev => {
    ev.currentTarget.disabled = true; msg('');
    try { await syTurnOn(); rerender(); setTimeout(() => { const b = body.querySelector('#syShow'); b && b.click(); }, 50); }
    catch (e) { msg(e.message); ev.currentTarget.disabled = false; }
  };
  if (q('#syShow')) q('#syShow').onclick = ev => { q('#syKeyBox').style.display = 'block'; ev.currentTarget.style.display = 'none'; };
  if (q('#syCopy')) q('#syCopy').onclick = async ev => { try { await navigator.clipboard.writeText(syGet().key); ev.currentTarget.textContent = 'Copied ✓'; } catch (e) { ev.currentTarget.textContent = 'Select and copy it by hand'; } };
  if (q('#syDl')) q('#syDl').onclick = () => bkDownload(new Blob([`Smart Companion Sync key\r\n\r\n${syGet().key}\r\n\r\nKeep this private. With this key (and the app) you can get your health data back on a new phone.\r\n`], { type: 'text/plain' }), 'smart-companion-sync-key.txt');
  if (q('#syOff')) q('#syOff').onclick = async () => {
    if (!(await askConfirm({ title: 'Turn off sync?', message: 'Your private copy on the server will be deleted. The data on this phone stays.', ok: 'Yes, turn off', cancel: 'Keep sync on', danger: true }))) return;
    try { await syTurnOff(true); rerender(); } catch (e) { msg(e.message); }
  };
}

// ----- welcome screen for a fresh install: "Do you have a backup?" -----
function wcClose(remember) { const o = document.getElementById('wcOverlay'); if (o) o.remove(); if (remember) { try { localStorage.setItem(SY_WELCOME, '1'); } catch (e) {} } }
function wcShow() {
  if (document.getElementById('wcOverlay')) return;
  const o = document.createElement('div'); o.id = 'wcOverlay';
  o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-labelledby', 'wcTitle');
  o.innerHTML = `<div class="pf-welcome-box">
    <div class="pf-welcome-ic">👋</div>
    <h2 class="pf-welcome-title" id="wcTitle">Welcome</h2>
    <p class="pf-welcome-sub">Used Smart Companion before? Bring your health details back in one step: readings, medicines, conditions and your emergency card.</p>
    <div id="wcBody">
      <label class="pf-choice" tabindex="0"><span>📂</span><span><strong>I have a backup file</strong><small>The .json file you saved earlier</small></span><input type="file" id="wcFile" accept=".json,application/json" hidden></label>
      <button class="pf-choice" id="wcKey" type="button"><span>🔑</span><span><strong>I have my Sync key</strong><small>26 letters and numbers, like ABCD-EFGH-…</small></span></button>
      <button class="pf-choice quiet" id="wcNew" type="button"><span>✓</span><span><strong>I am new here</strong><small>Start with an empty Health Log</small></span></button>
    </div><div id="wcMsg" role="status" aria-live="polite"></div></div>`;
  document.body.appendChild(o);
  const q = s => o.querySelector(s), msg = (t, ok) => { const m = q('#wcMsg'); m.className = ok ? 'hl2-ok' : 'hl2-err'; m.textContent = t; };
  const done = (v) => { msg(`✓ Restored: ${bkCountText(bkCount(v.data))}. Reloading…`, true); try { localStorage.setItem(SY_WELCOME, '1'); } catch (e) {} setTimeout(() => location.reload(), 1300); };
  const askKey = (title, onGo) => {
    q('#wcBody').innerHTML = `<div class="pf-welcome-form"><label for="wcIn">${title}</label><input id="wcIn" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD-EFGH-…"><button class="pf-btn pf-btn-main" id="wcGo" type="button">Restore my data</button><button class="pf-link" id="wcBack" type="button">Go back</button></div>`;
    q('#wcBack').onclick = () => { o.remove(); wcShow(); };
    const go = async () => { msg(''); q('#wcGo').disabled = true; try { await onGo(q('#wcIn').value); } catch (e) { msg(e && (e.name === 'OperationError' || /operation|decrypt/i.test(e.message || '')) ? 'That key does not open this file.' : (e.message || 'Something went wrong.')); q('#wcGo').disabled = false; } };
    q('#wcGo').onclick = go; q('#wcIn').onkeydown = e => { if (e.key === 'Enter') go(); }; q('#wcIn').focus();
  };
  q('#wcNew').onclick = () => wcClose(true);
  q('label.pf-choice').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); q('#wcFile').click(); } };
  q('#wcKey').onclick = () => askKey('Type or paste your Sync key.', async k => done(await syRestoreFromKey(k)));
  q('#wcFile').onchange = async ev => {
    const f = ev.target.files[0]; if (!f) return; msg('');
    if (f.size > 8 * 1024 * 1024) return msg('That file is too big to be a backup.');
    let parsed; try { parsed = JSON.parse(await f.text()); } catch (e) { return msg('That file could not be read. Is it the backup file you saved?'); }
    try {
      if (parsed && parsed.encrypted) {
        if (!syCan()) return msg('This file is protected. Open the app on https to unlock it.');
        const sync = parsed.kdf === 'sync-key';
        return askKey(sync ? 'This backup is protected. Enter your Sync key.' : 'This backup is protected. Enter its password.', async pw => {
          const obj = sync ? await bkDecryptWithSync(parsed, pw) : await bkDecrypt(parsed, pw);
          const v = bkValidate(obj); bkApply(v.data, 'merge');
          if (sync) sySet({ key: syNorm(pw), rev: 0, hash: '', last: '' });      // they hold the key, so keep this phone synced too
          done(v);
        });
      }
      const v = bkValidate(parsed); bkApply(v.data, 'merge'); done(v);
    } catch (e) { msg(e.message); }
  };
}
// show it once, only when this device has no health data and no sync yet
setTimeout(() => {
  let seen = ''; try { seen = localStorage.getItem(SY_WELCOME) || ''; } catch (e) {}
  if (!seen && !bkHasData() && !syGet()) wcShow();
}, 800);