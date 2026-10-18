// [12/19] emergency contact storage and SOS message text
// Part of the Smart Companion page script. Loaded by index.html in numeric order; all files share one global scope.
// --- 14.5. EMERGENCY CONTACTS STORAGE & ALERT SYSTEM ---

const EMERGENCY_CONTACTS_KEY = 'companion_emergency_contacts';

function loadEmergencyContacts() {
  try {
    const raw = localStorage.getItem(EMERGENCY_CONTACTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveEmergencyContacts(list) {
  try {
    localStorage.setItem(EMERGENCY_CONTACTS_KEY, JSON.stringify(list));
  } catch (e) {}
}

function buildEmergencyAlertMessage(contact, coords, hospital) {
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = new Date().toLocaleDateString([], { month: 'short', day: 'numeric' });
  let msg = `🚨 EMERGENCY SOS ALERT from Smart Companion 🚨\n`;
  msg += `Hi ${contact.name || 'there'}, I need immediate emergency medical assistance!\n\n`;
  if (coords && coords.lat != null && coords.lon != null) {
    msg += `📍 My GPS Coordinates: ${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}\n`;
    msg += `🗺️ Google Maps Location & Directions:\nhttps://maps.google.com/?q=${coords.lat},${coords.lon}\n\n`;
  }
  if (hospital && hospital.name) {
    msg += `🏥 Target / Nearest Facility: ${hospital.name}`;
    if (hospital.distance_km != null) msg += ` (${hospital.distance_km} km away)`;
    msg += `\n`;
    if (hospital.address) msg += `Address: ${hospital.address}\n`;
    msg += `\n`;
  }
  if (typeof ecAlertLines === 'function') msg += ecAlertLines();
  msg += `⏰ Timestamp: ${timeStr}, ${dateStr}\n`;
  msg += `Please call me or send emergency help immediately!`;
  return msg;
}

const emergencyContactsBtnEl = document.getElementById('emergencyContactsBtn');
if (emergencyContactsBtnEl) emergencyContactsBtnEl.addEventListener('click', showEmergencyContactsModal);

function showEmergencyContactsModal() {
  toggleSidebar(false);
  const overlay = document.createElement('div');
  overlay.className = 'settings-modal active';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.style.zIndex = '999';

  const box = document.createElement('div');
  box.className = 'settings-box';
  box.style.maxWidth = '540px';

  function renderModalContent() {
    const contacts = loadEmergencyContacts();
    box.innerHTML = `
      <div class="dialog-header">
        <div class="dialog-title-group">
          <div class="dialog-badge" style="color:var(--coral);">SAFETY</div>
          <div class="dialog-title">Emergency Contacts & SOS Alerts</div>
        </div>
        <button type="button" class="dialog-close-btn" id="ecCloseBtn" aria-label="Close">✕</button>
      </div>

      <div class="dialog-body" style="padding:16px 18px; max-height:80vh; overflow-y:auto; display:flex; flex-direction:column; gap:12px;">
        <p style="font-size:12.5px; color:var(--text-secondary); margin:0;">
          Save trusted emergency contacts (family, physician, close friend). When you activate the SOS Protocol, an automated emergency alert with your live GPS location and Google Maps link will be sent to them immediately.
        </p>

        <!-- Add Contact Form -->
        <div style="background:var(--bg-subtle); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:12px; display:flex; flex-direction:column; gap:8px;">
          <div style="font-size:12px; font-weight:700; color:var(--text-primary); text-transform:uppercase; letter-spacing:0.04em;">
            ➕ Add Emergency Contact
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <input id="ecNameInput" placeholder="Name (e.g. Mom, Dr. Sarah)" style="flex:1; min-width:140px; padding:8px 10px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); background:var(--bg-surface-elevated); color:var(--text-primary); font-size:12.5px;">
            <input id="ecPhoneInput" placeholder="Phone (e.g. +91 98765 43210)" style="flex:1; min-width:160px; padding:8px 10px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); background:var(--bg-surface-elevated); color:var(--text-primary); font-size:12.5px;">
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            <input id="ecRelInput" placeholder="Relationship (e.g. Parent, Spouse, Physician)" style="flex:1; padding:8px 10px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); background:var(--bg-surface-elevated); color:var(--text-primary); font-size:12.5px;">
            <button type="button" id="ecSaveBtn" class="btn-execute" style="padding:8px 16px; font-size:12.5px; white-space:nowrap; background:var(--coral);">Save Contact</button>
          </div>
        </div>

        <!-- Saved Contacts List -->
        <div style="display:flex; flex-direction:column; gap:6px; margin-top:4px;">
          <div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em;">
            SAVED EMERGENCY CONTACTS (${contacts.length})
          </div>
          <div id="ecList" style="display:flex; flex-direction:column; gap:6px;">
            ${contacts.length ? contacts.map(c => `
              <div class="contacts-manager-card">
                <div>
                  <div style="font-weight:600; color:var(--text-primary); display:flex; align-items:center; gap:6px; font-size:13px;">
                    <span>👤</span>
                    <span>${escapeHtml(c.name)}</span>
                    ${c.relationship ? `<span style="font-size:10.5px; color:var(--text-muted); border:1px solid var(--border-subtle); padding:1px 5px; border-radius:4px;">${escapeHtml(c.relationship)}</span>` : ''}
                  </div>
                  <div style="color:var(--text-secondary); font-family:var(--font-mono); font-size:12px; margin-top:2px;">
                    📞 ${escapeHtml(c.phone)}
                  </div>
                </div>
                <div style="display:flex; align-items:center; gap:6px;">
                  <a href="tel:${escapeHtml(c.phone.replace(/\D/g, ''))}" class="btn-subtle" style="padding:4px 8px; font-size:11.5px; text-decoration:none; color:var(--teal);" title="Call">📞 Call</a>
                  <button type="button" class="btn-subtle ec-delete-btn" data-id="${c.id}" style="padding:4px 8px; font-size:11.5px; color:var(--coral);" title="Delete">🗑️</button>
                </div>
              </div>
            `).join('') : `
              <div style="color:var(--text-muted); font-size:12px; padding:10px; text-align:center; background:var(--bg-subtle); border-radius:var(--radius-sm); border:1px dashed var(--border-subtle);">
                No emergency contacts saved yet. Add one above to enable automated SMS & WhatsApp SOS alerts.
              </div>
            `}
          </div>
        </div>

        <!-- Sample Emergency SMS Preview -->
        <div style="margin-top:4px;">
          <div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px;">
            MESSAGE THAT WILL BE SENT
          </div>
          <div class="sos-message-preview-box">🚨 EMERGENCY SOS ALERT from Smart Companion 🚨
Hi Mom, I need immediate emergency medical assistance!

📍 My GPS Coordinates: 22.57264, 88.36389
🗺️ Google Maps Location & Directions:
https://maps.google.com/?q=22.57264,88.36389

🏥 Target / Nearest Facility: SSKM Hospital (1.2 km away)
⏰ Timestamp: 10:55 AM, Oct 9
Please call me or send emergency help immediately!</div>
        </div>

        <button type="button" id="ecDismissBtn" class="btn-subtle" style="width:100%; margin-top:4px;">Close</button>
      </div>
    `;

    box.querySelector('#ecCloseBtn').onclick = () => overlay.remove();
    box.querySelector('#ecDismissBtn').onclick = () => overlay.remove();

    box.querySelectorAll('.ec-delete-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const remaining = loadEmergencyContacts().filter(c => c.id !== id);
        saveEmergencyContacts(remaining);
        renderModalContent();
      };
    });

    const saveBtn = box.querySelector('#ecSaveBtn');
    const nameInput = box.querySelector('#ecNameInput');
    const phoneInput = box.querySelector('#ecPhoneInput');
    const relInput = box.querySelector('#ecRelInput');

    const handleSave = () => {
      const name = nameInput.value.trim();
      const phone = phoneInput.value.trim();
      const rel = relInput.value.trim();
      if (!name || !phone) return;
      const list = loadEmergencyContacts();
      list.push({ id: 'ec-' + Date.now(), name, phone, relationship: rel });
      saveEmergencyContacts(list);
      renderModalContent();
    };

    if (saveBtn) saveBtn.onclick = handleSave;
    [nameInput, phoneInput, relInput].forEach(inp => {
      if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSave(); });
    });
  }

  renderModalContent();
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
}
