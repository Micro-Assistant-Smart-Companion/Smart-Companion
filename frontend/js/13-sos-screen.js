// [13/19] the emergency SOS screen, location, hospital directions
// Part of the Smart Companion page script. Loaded by index.html in numeric order; all files share one global scope.
// --- 15. EMERGENCY SOS MEDICAL PROTOCOL ---

// Caches the browser's last known location client-side, so we don't
// re-ask GPS (with its own permission prompt + latency) on every single
// lookup - same pattern apps like Zomato/Swiggy use. maxAgeMs controls
// how stale a cached fix is allowed to be before we fetch a fresh one.
const LOCATION_CACHE_KEY = 'companion_last_location';

function getCachedOrFreshLocation(maxAgeMs = 10 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    try {
      const cached = JSON.parse(localStorage.getItem(LOCATION_CACHE_KEY));
      if (cached && (Date.now() - cached.timestamp) < maxAgeMs) {
        resolve({ lat: cached.lat, lon: cached.lon, fromCache: true });
        return;
      }
    } catch (e) {}

    if (!navigator.geolocation) { reject(new Error('Geolocation not supported')); return; }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude, lon = pos.coords.longitude;
        try { localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({ lat, lon, timestamp: Date.now() })); } catch (e) {}
        resolve({ lat, lon, fromCache: false });
      },
      (err) => reject(err),
      { timeout: 8000 }
    );
  });
}

const sosBtnEl = document.getElementById('sosBtn');
if (sosBtnEl) sosBtnEl.addEventListener('click', showEmergencyPanel);

function showEmergencyPanel() {
  const overlay = document.createElement('div');
  overlay.className = 'settings-modal active';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.style.zIndex = '999';

  const box = document.createElement('div');
  box.className = 'settings-box emergency-dialog';

  // State tracking for SOS Location & Google Maps Navigation:
  let originData = null; // { lat, lon, label }
  let destinationData = null; // { id, name, lat, lon, address, phone, distance_km }
  let currentTravelMode = 'driving'; // 'driving', 'walking', 'transit'
  let currentDirFlg = 'd'; // 'd', 'w', 'r'
  let nearbyHospitalsList = [];
  let alertDispatched = false;

  box.innerHTML = `
    <div class="dialog-header">
      <div class="dialog-title-group">
        <div class="dialog-badge" style="color:var(--coral); display:flex; align-items:center; gap:6px;">
          <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:var(--coral); box-shadow:0 0 8px var(--coral); animation:pulse-dot 1.5s infinite;"></span>
          EMERGENCY
        </div>
        <div class="dialog-title" style="color:var(--coral);">Emergency Help</div>
      </div>
      <button type="button" class="dialog-close-btn" id="sosCloseBtn" aria-label="Close">✕</button>
    </div>

    <div class="sos-dialog-body">
      <p style="font-size:13px; color:var(--text-secondary); margin:0;">
        If you or someone nearby is experiencing chest pain, acute respiratory distress, severe trauma, or urgent symptoms, call emergency services directly:
      </p>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        <a href="tel:108" style="display:flex; align-items:center; justify-content:space-between; padding:11px 13px; border-radius:var(--radius-sm); background-color:var(--coral); color:#ffffff; font-weight:700; text-decoration:none; box-shadow:0 3px 12px rgba(244,63,94,0.3);">
          <span>🚨 Call Ambulance</span>
          <span style="font-family:var(--font-mono); font-size:15px;">108</span>
        </a>
        <a href="tel:104" style="display:flex; align-items:center; justify-content:space-between; padding:11px 13px; border-radius:var(--radius-sm); background-color:var(--bg-subtle); border:1px solid var(--border-subtle); color:var(--text-primary); font-weight:700; text-decoration:none;">
          <span>📞 Health Helpline</span>
          <span style="font-family:var(--font-mono); font-size:15px;">104</span>
        </a>
      </div>

      <!-- Medical emergency card -->
      <div id="sosMedCard"></div>

      <!-- Emergency Contact & Automated Message Alert Section -->
      <div id="sosContactSection" class="sos-contact-section"></div>

      <!-- SOS Location & Google Map Route Section -->
      <div id="sosLocationSection" class="sos-card-container">
        <div class="sos-location-header">
          <div class="sos-location-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--coral);"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
            <span>Directions to a hospital</span>
          </div>
          <span class="sos-google-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>
            Google Maps
          </span>
        </div>

        <div id="sosLocationContent">
          <div id="sosLocationLoading" style="display:flex; align-items:center; gap:10px; padding:16px 12px; background:var(--bg-subtle); border-radius:var(--radius-sm); border:1px solid var(--border-subtle); color:var(--text-secondary); font-size:12.5px;">
            <span style="display:inline-block; width:14px; height:14px; border-radius:50%; border:2px solid var(--coral); border-top-color:transparent; animation:spin 0.8s linear infinite; flex-shrink:0;"></span>
            <span>Finding your location and the nearest hospital…</span>
          </div>
        </div>
      </div>

      <button id="sosCloseActionBtn" class="btn-subtle" style="width:100%;">Close</button>
    </div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  const closeMe = () => overlay.remove();
  box.querySelector('#sosCloseBtn').onclick = closeMe;
  box.querySelector('#sosCloseActionBtn').onclick = closeMe;
  overlay.onclick = (e) => { if (e.target === overlay) closeMe(); };

  const contentArea = box.querySelector('#sosLocationContent');
  const contactArea = box.querySelector('#sosContactSection');
  if (typeof ecRenderSos === 'function') ecRenderSos(box.querySelector('#sosMedCard'));

  function renderEmergencyContactCard() {
    if (!contactArea) return;
    const contacts = loadEmergencyContacts();

    if (!contacts.length) {
      contactArea.innerHTML = `
        <div class="sos-contact-header">
          <div class="sos-contact-title">
            <span style="font-size:15px;">⚠️</span>
            <span>Emergency Contact</span>
          </div>
          <span class="sos-alert-badge pending">NO CONTACT YET</span>
        </div>
        <p style="font-size:12px; color:var(--text-secondary); margin:0;">
          Add a trusted contact number so an automated emergency message with your live GPS coordinates & map link is prepared and sent immediately:
        </p>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:2px;">
          <input id="sosQuickName" placeholder="Name (e.g. Mom)" style="flex:1; min-width:110px; padding:7px 9px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); background:var(--bg-subtle); color:var(--text-primary); font-size:12.5px;">
          <input id="sosQuickPhone" placeholder="Phone (+91...)" style="flex:1; min-width:140px; padding:7px 9px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); background:var(--bg-subtle); color:var(--text-primary); font-size:12.5px;">
          <button type="button" id="sosQuickSaveBtn" class="btn-execute" style="padding:7px 12px; font-size:12px; white-space:nowrap; background:var(--coral);">Save contact</button>
        </div>
      `;

      const quickSaveBtn = contactArea.querySelector('#sosQuickSaveBtn');
      const quickNameInput = contactArea.querySelector('#sosQuickName');
      const quickPhoneInput = contactArea.querySelector('#sosQuickPhone');

      const handleQuickSave = () => {
        const name = quickNameInput.value.trim() || 'Emergency Contact';
        const phone = quickPhoneInput.value.trim();
        if (!phone) return;
        saveEmergencyContacts([{ id: 'ec-' + Date.now(), name, phone, relationship: 'Emergency Contact' }]);
        renderEmergencyContactCard();
      };

      if (quickSaveBtn) quickSaveBtn.onclick = handleQuickSave;
      if (quickPhoneInput) {
        quickPhoneInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleQuickSave(); });
      }
      return;
    }

    const primaryContact = contacts[0];
    const alertMessage = buildEmergencyAlertMessage(primaryContact, originData, destinationData);

    const cleanDigits = primaryContact.phone.replace(/\D/g, '');
    const waDigits = cleanDigits.length === 10 ? '91' + cleanDigits : cleanDigits;
    const waUrl = `https://wa.me/${waDigits}?text=${encodeURIComponent(alertMessage)}`;
    const smsUrl = `sms:${cleanDigits}?body=${encodeURIComponent(alertMessage)}`;
    const telUrl = `tel:${cleanDigits}`;

    contactArea.innerHTML = `
      <div class="sos-contact-header">
        <div class="sos-contact-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--coral);"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="22" y1="11" x2="16" y2="11"></line></svg>
          <span>Alert your emergency contact</span>
        </div>
        <span id="sosAlertStatusBadge" class="sos-alert-badge ${alertDispatched ? 'dispatched' : 'pending'}">
          ${alertDispatched ? '✅ Alert Dispatched & Logged' : '⚡ Preparing alert…'}
        </span>
      </div>

      <div class="sos-contact-details">
        <div class="sos-contact-name-tag">
          <span>👤</span>
          <span>${escapeHtml(primaryContact.name)}</span>
          ${primaryContact.relationship ? `<span style="font-size:10.5px; color:var(--text-muted);">(${escapeHtml(primaryContact.relationship)})</span>` : ''}
        </div>
        <div class="sos-contact-phone-tag">
          📞 ${escapeHtml(primaryContact.phone)}
        </div>
      </div>

      <div class="sos-message-preview-box">${escapeHtml(alertMessage)}</div>

      <div class="sos-contact-actions">
        <a id="sosSendSmsLink" href="${smsUrl}" class="btn-sos-sms" title="Send SMS message directly">
          <span>📲 Send SMS (${escapeHtml(primaryContact.name)})</span>
        </a>
        <a id="sosSendWaLink" href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn-sos-wa" title="Send WhatsApp alert">
          <span>💬 WhatsApp Alert</span>
        </a>
        <a href="${telUrl}" class="btn-sos-contact-call" title="Call directly">
          <span>📞 Call</span>
        </a>
        <button type="button" id="sosManageContactsBtn" class="btn-subtle" style="padding:6px 10px; font-size:11.5px; border-radius:var(--radius-sm);" title="Manage Emergency Contacts">
          ⚙️
        </button>
      </div>
    `;

    const manageBtn = contactArea.querySelector('#sosManageContactsBtn');
    if (manageBtn) {
      manageBtn.onclick = () => {
        showEmergencyContactsModal();
      };
    }

    // Automatically dispatch alert to backend service
    if (!alertDispatched && primaryContact.phone) {
      alertDispatched = true;
      fetch(`${API}/directory/alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_name: primaryContact.name,
          contact_phone: primaryContact.phone,
          message: alertMessage,
          lat: originData ? originData.lat : null,
          lon: originData ? originData.lon : null,
          hospital_name: destinationData ? destinationData.name : null
        })
      })
      .then(res => res.json())
      .then(resData => {
        const badge = contactArea.querySelector('#sosAlertStatusBadge');
        if (badge) {
          badge.className = 'sos-alert-badge dispatched';
          badge.textContent = '✅ Alert Dispatched & Logged';
        }
      })
      .catch(() => {
        const badge = contactArea.querySelector('#sosAlertStatusBadge');
        if (badge) {
          badge.className = 'sos-alert-badge dispatched';
          badge.textContent = '✅ Alert ready. Tap Send below';
        }
      });
    }
  }

  // Initial render of contact card
  renderEmergencyContactCard();

  function getEmbedAndNavUrls() {
    if (!originData || !destinationData) return { embedUrl: '', navUrl: '' };

    const originParam = (originData.lat != null && originData.lon != null)
      ? `${originData.lat},${originData.lon}`
      : originData.label;

    const destParam = (destinationData.lat != null && destinationData.lon != null)
      ? `${destinationData.lat},${destinationData.lon}`
      : (destinationData.address ? `${destinationData.name}, ${destinationData.address}` : destinationData.name);

    const embedUrl = `https://maps.google.com/maps?saddr=${encodeURIComponent(originParam)}&daddr=${encodeURIComponent(destParam)}&dirflg=${currentDirFlg}&output=embed`;
    const navUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originParam)}&destination=${encodeURIComponent(destParam)}&travelmode=${currentTravelMode}`;

    return { embedUrl, navUrl };
  }

  function renderMapRouteUI() {
    if (!originData || !destinationData) return;

    const { embedUrl, navUrl } = getEmbedAndNavUrls();
    const phone = destinationData.phone ? destinationData.phone.split(';')[0].trim() : null;
    const destMetaParts = [];
    if (destinationData.distance_km != null) destMetaParts.push(`${destinationData.distance_km} km away`);
    if (destinationData.address) destMetaParts.push(destinationData.address);
    const destMetaStr = destMetaParts.join(' · ') || 'Emergency Healthcare Facility';

    const originText = (originData.lat != null && originData.lon != null)
      ? `GPS: ${originData.lat.toFixed(4)}°, ${originData.lon.toFixed(4)}°`
      : escapeHtml(originData.label);

    let chipsHtml = '';
    if (nearbyHospitalsList && nearbyHospitalsList.length > 1) {
      chipsHtml = nearbyHospitalsList.map(h => {
        const isActive = (destinationData.id && h.id === destinationData.id) || (h.name === destinationData.name);
        return `
          <button type="button" class="sos-facility-chip ${isActive ? 'active' : ''}" data-hospital-id="${h.id || ''}" data-hospital-name="${escapeHtml(h.name)}">
            <span>🏥</span>
            <span>${escapeHtml(h.name)}</span>
            <span style="opacity:0.75; font-size:10.5px;">(${h.distance_km} km)</span>
          </button>
        `;
      }).join('');
    }

    contentArea.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:10px;">
        <div class="sos-route-summary">
          <div class="sos-route-point">
            <div class="sos-point-icon" style="color:#38bdf8;">📍</div>
            <div class="sos-point-content">
              <div class="sos-point-label">Your Current Location (Origin)</div>
              <div class="sos-point-val" id="sosOriginDisplay">${originText}</div>
              <div class="sos-point-meta" style="display:flex; align-items:center; gap:8px;">
                <span>Your live location</span>
                <button type="button" id="sosRefreshLocBtn" class="btn-subtle" style="padding:2px 7px; font-size:10.5px; border-radius:3px; cursor:pointer;">🔄 Refresh GPS</button>
              </div>
            </div>
          </div>

          <div style="border-top:1px dashed var(--border-subtle); margin:2px 0;"></div>

          <div class="sos-route-point">
            <div class="sos-point-icon" style="color:var(--coral);">🏥</div>
            <div class="sos-point-content">
              <div class="sos-point-label">Destination Facility</div>
              <div class="sos-point-val" id="sosDestName">${escapeHtml(destinationData.name)}</div>
              <div class="sos-point-meta" id="sosDestMeta">${escapeHtml(destMetaStr)}</div>
            </div>
          </div>
        </div>

        <!-- Travel Mode Selector -->
        <div class="sos-mode-selector">
          <button type="button" class="sos-mode-btn ${currentTravelMode === 'driving' ? 'active' : ''}" data-mode="driving" data-dir="d">
            <span>🚗</span> Drive (Fastest)
          </button>
          <button type="button" class="sos-mode-btn ${currentTravelMode === 'walking' ? 'active' : ''}" data-mode="walking" data-dir="w">
            <span>🚶</span> Walk
          </button>
          <button type="button" class="sos-mode-btn ${currentTravelMode === 'transit' ? 'active' : ''}" data-mode="transit" data-dir="r">
            <span>🚌</span> Transit
          </button>
        </div>

        <!-- Embedded Google Map -->
        <div class="sos-map-viewport">
          <iframe id="sosMapIframe" class="sos-map-iframe" src="${embedUrl}" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade" title="Google Map Directions"></iframe>
        </div>

        <!-- Action Buttons -->
        <div class="sos-actions-row">
          <a id="sosNavBtn" href="${navUrl}" target="_blank" rel="noopener noreferrer" class="btn-sos-navigate">
            <span>🗺️ Start Turn-by-Turn Navigation (${currentTravelMode.toUpperCase()})</span>
            <span style="font-size:11px; opacity:0.85;">↗</span>
          </a>
          ${phone ? `
            <a id="sosCallBtn" href="tel:${phone.replace(/\D/g, '')}" class="btn-sos-call">
              📞 Call ${escapeHtml(phone)}
            </a>
          ` : ''}
        </div>

        ${chipsHtml ? `
          <div class="sos-facilities-chips-container">
            <div class="sos-facilities-label">Other Nearby Facilities:</div>
            <div class="sos-facilities-chips">
              ${chipsHtml}
            </div>
          </div>
        ` : ''}

        <!-- Custom Destination Toggle & Input -->
        <div style="margin-top:2px;">
          <button type="button" id="sosCustomDestToggle" class="sos-custom-search-toggle">
            <span>🔍 Route to a specific hospital or address</span>
          </button>
          <div id="sosCustomInputBar" class="sos-custom-input-bar">
            <input id="sosCustomDestInput" placeholder="Enter hospital name or destination address..." style="flex:1; padding:7px 10px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); background:var(--bg-subtle); color:var(--text-primary); font-size:12.5px;">
            <button type="button" id="sosCustomDestApplyBtn" class="btn-execute" style="padding:7px 14px; font-size:12px; white-space:nowrap;">Route</button>
          </div>
        </div>
      </div>
    `;

    bindMapControls();
    renderEmergencyContactCard();
  }

  function bindMapControls() {
    // Mode switcher
    contentArea.querySelectorAll('.sos-mode-btn').forEach(btn => {
      btn.onclick = () => {
        contentArea.querySelectorAll('.sos-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTravelMode = btn.dataset.mode;
        currentDirFlg = btn.dataset.dir;
        const { embedUrl, navUrl } = getEmbedAndNavUrls();
        const iframe = contentArea.querySelector('#sosMapIframe');
        const navBtn = contentArea.querySelector('#sosNavBtn');
        if (iframe) iframe.src = embedUrl;
        if (navBtn) {
          navBtn.href = navUrl;
          navBtn.innerHTML = `<span>🗺️ Start Turn-by-Turn Navigation (${currentTravelMode.toUpperCase()})</span> <span style="font-size:11px; opacity:0.85;">↗</span>`;
        }
      };
    });

    // Facility chip switcher
    contentArea.querySelectorAll('.sos-facility-chip').forEach(chip => {
      chip.onclick = () => {
        const hid = chip.dataset.hospitalId;
        const hname = chip.dataset.hospitalName;
        const match = nearbyHospitalsList.find(h => (hid && String(h.id) === hid) || h.name === hname);
        if (match) {
          destinationData = { ...match };
          renderMapRouteUI();
        }
      };
    });

    // Refresh GPS
    const refreshBtn = contentArea.querySelector('#sosRefreshLocBtn');
    if (refreshBtn) {
      refreshBtn.onclick = () => {
        try { localStorage.removeItem(LOCATION_CACHE_KEY); } catch (e) {}
        loadEmergencyLocation(true);
      };
    }

    // Custom destination input toggle & apply
    const customToggle = contentArea.querySelector('#sosCustomDestToggle');
    const customBar = contentArea.querySelector('#sosCustomInputBar');
    const customInput = contentArea.querySelector('#sosCustomDestInput');
    const customApply = contentArea.querySelector('#sosCustomDestApplyBtn');

    if (customToggle && customBar) {
      customToggle.onclick = () => {
        customBar.classList.toggle('open');
        if (customBar.classList.contains('open') && customInput) customInput.focus();
      };
    }

    const applyCustom = () => {
      const val = customInput ? customInput.value.trim() : '';
      if (!val) return;
      destinationData = {
        id: 'custom-' + Date.now(),
        name: val,
        lat: null,
        lon: null,
        address: 'Custom Emergency Destination',
        phone: null,
        distance_km: null
      };
      renderMapRouteUI();
    };

    if (customApply) customApply.onclick = applyCustom;
    if (customInput) {
      customInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') applyCustom();
      });
    }
  }

  function renderLocationFallbackUI(errorMsg) {
    contentArea.innerHTML = `
      <div style="background:var(--bg-subtle); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:14px; font-size:12.5px; color:var(--text-secondary); display:flex; flex-direction:column; gap:10px;">
        <div style="font-weight:600; color:var(--coral); display:flex; align-items:center; gap:6px;">
          <span>⚠️</span> Can not find your location
        </div>
        <p style="margin:0; line-height:1.4;">
          ${escapeHtml(errorMsg || 'Unable to detect your exact GPS coordinates automatically.')} You can enter your current location to plot the Google Map directions, or open Google Maps directly:
        </p>
        <div style="display:flex; gap:8px;">
          <input id="sosManualOriginInput" placeholder="Enter your current city or area (e.g. Salt Lake, Kolkata)..." style="flex:1; padding:8px 10px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); background:var(--bg-surface-elevated); color:var(--text-primary); font-size:12.5px;">
          <button type="button" id="sosManualRouteBtn" class="btn-execute" style="padding:8px 14px; font-size:12px; white-space:nowrap;">Get Directions</button>
        </div>
        <div style="display:flex; gap:8px; margin-top:2px;">
          <a href="https://www.google.com/maps/search/nearest+emergency+hospital" target="_blank" rel="noopener noreferrer" class="btn-sos-navigate" style="flex:1;">
            <span>🗺️ Search Nearest Hospitals on Google Maps</span>
            <span style="font-size:11px; opacity:0.85;">↗</span>
          </a>
        </div>
      </div>
    `;

    const manualInput = contentArea.querySelector('#sosManualOriginInput');
    const manualBtn = contentArea.querySelector('#sosManualRouteBtn');
    const handleManual = () => {
      const area = manualInput ? manualInput.value.trim() : '';
      if (!area) return;
      originData = { lat: null, lon: null, label: area };
      destinationData = {
        name: 'Nearest Emergency Hospital',
        lat: null,
        lon: null,
        address: 'Resolving route via Google Maps',
        phone: null,
        distance_km: null
      };
      renderMapRouteUI();
    };
    if (manualBtn) manualBtn.onclick = handleManual;
    if (manualInput) {
      manualInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleManual();
      });
    }
    renderEmergencyContactCard();
  }

  function loadEmergencyLocation(forceFresh = false) {
    contentArea.innerHTML = `
      <div id="sosLocationLoading" style="display:flex; align-items:center; gap:10px; padding:16px 12px; background:var(--bg-subtle); border-radius:var(--radius-sm); border:1px solid var(--border-subtle); color:var(--text-secondary); font-size:12.5px;">
        <span style="display:inline-block; width:14px; height:14px; border-radius:50%; border:2px solid var(--coral); border-top-color:transparent; animation:spin 0.8s linear infinite; flex-shrink:0;"></span>
        <span>${forceFresh ? 'Updating your location…' : 'Finding your location and the nearest hospital…'}</span>
      </div>
    `;

    getCachedOrFreshLocation(forceFresh ? 0 : 2 * 60 * 1000)
      .then(async ({ lat, lon }) => {
        originData = { lat, lon, label: `${lat.toFixed(4)}, ${lon.toFixed(4)}` };

        try {
          const res = await fetch(`${API}/directory/search?lat=${lat}&lon=${lon}&radius_km=25&limit=4`);
          const data = await res.json();
          if (data.doctors && data.doctors.length) {
            nearbyHospitalsList = data.doctors;
            destinationData = { ...nearbyHospitalsList[0] };
          } else {
            // No doctors in local DB radius -> Google Maps fallback
            nearbyHospitalsList = [];
            destinationData = {
              name: 'Nearest Emergency Hospital',
              lat: null,
              lon: null,
              address: 'Auto-resolved via Google Maps navigation',
              phone: null,
              distance_km: null
            };
          }
        } catch (e) {
          // Backend offline or error -> Google Maps still resolves route!
          nearbyHospitalsList = [];
          destinationData = {
            name: 'Nearest Emergency Hospital',
            lat: null,
            lon: null,
            address: 'Direct Google Maps Emergency Routing',
            phone: null,
            distance_km: null
          };
        }

        renderMapRouteUI();
      })
      .catch((err) => {
        renderLocationFallbackUI(err && err.message ? err.message : 'Location telemetry unavailable.');
      });
  }

  // Initial load
  loadEmergencyLocation(false);
}