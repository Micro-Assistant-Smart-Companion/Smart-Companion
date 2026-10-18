// [14/19] nearby doctors and hospitals
// Part of the Smart Companion page script. Loaded by index.html in numeric order; all files share one global scope.
// --- 16. CLINICAL DIRECTORY & LOCATION INTEGRATION ---

const INDIA_HEALTH_HELPLINES = [
  { name: "National Health Helpline", phone: "104" },
  { name: "Ambulance", phone: "108" },
  { name: "Ask your local ASHA worker or nearest PHC", phone: null },
];

function maybeShowNearbyHealthcare() {
  if (currentLabel !== 'medical') return;
  if (!feedEl) return;
  const div = document.createElement('div');
  div.className = 'msg assistant';
  div.innerHTML = '<div style="font-weight:600; margin-bottom:6px;">Need local clinic or medical facility listings?</div>';

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex; flex-wrap:wrap; gap:8px; margin-top:8px;';

  const hereBtn = document.createElement('button');
  hereBtn.className = 'btn-subtle';
  hereBtn.textContent = '📍 Search Near Me';
  hereBtn.onclick = () => {
    btnRow.remove();
    searchNearbyByGeolocation();
  };

  const elsewhereBtn = document.createElement('button');
  elsewhereBtn.className = 'btn-subtle';
  elsewhereBtn.textContent = '🔍 Search by Area / City';
  elsewhereBtn.onclick = () => {
    btnRow.remove();
    showPlaceInput(div);
  };

  btnRow.appendChild(hereBtn);
  btnRow.appendChild(elsewhereBtn);
  div.appendChild(btnRow);
  feedEl.appendChild(div);
  scrollToBottom();
}

function searchNearbyByGeolocation() {
  setStatus('Searching OSM healthcare directory…');
  getCachedOrFreshLocation(10 * 60 * 1000) // reuse up to 10 min old - plenty fresh for "nearby doctors"
    .then(({ lat, lon }) => {
      setStatus('');
      fetchAndRenderNearby(lat, lon);
    })
    .catch(() => {
      setStatus('');
      renderNearbyCard([]);
    });
}

function showPlaceInput(parentDiv) {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex; gap:8px; margin-top:8px;';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'e.g. Park Street, Kolkata';
  input.style.cssText = 'flex:1; padding:7px 10px; border-radius:4px; border:1px solid var(--border-subtle); background:var(--bg-subtle); color:var(--text-primary); font-size:13px;';

  const goBtn = document.createElement('button');
  goBtn.className = 'btn-execute';
  goBtn.textContent = 'Search';
  goBtn.onclick = async () => {
    const place = input.value.trim();
    if (!place) return;
    row.remove();
    setStatus('Looking up area coordinates…');
    try {
      const res = await fetch(`${API}/directory/geocode?place=${encodeURIComponent(place)}`);
      const data = await res.json();
      setStatus('');
      if (!data.found) {
        renderNearbyCard([]);
        return;
      }
      await fetchAndRenderNearby(data.lat, data.lon);
    } catch (e) {
      setStatus('Area resolution error.', true);
    }
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') goBtn.click(); });
  row.appendChild(input);
  row.appendChild(goBtn);
  parentDiv.appendChild(row);
}

async function fetchAndRenderNearby(lat, lon) {
  try {
    const res = await fetch(`${API}/directory/search?lat=${lat}&lon=${lon}&radius_km=10`);
    const data = await res.json();
    renderNearbyCard(data.doctors || []);
  } catch (e) {
    renderNearbyCard([]);
  }
}

function renderNearbyCard(doctors) {
  if (!feedEl) return;
  const div = document.createElement('div');
  div.className = 'msg assistant';

  let html = '<div style="font-weight:600; margin-bottom:6px;">Nearby clinics and hospitals</div>';
  if (doctors.length) {
    html += '<div style="display:flex; flex-direction:column; gap:8px; margin-top:6px;">';
    doctors.forEach(d => {
      html += `
        <div style="background:var(--bg-subtle); border:1px solid var(--border-subtle); padding:10px 12px; border-radius:4px; font-size:13px;">
          <div style="font-weight:600; color:var(--text-primary);">${escapeHtml(d.name)}</div>
          <div style="color:var(--text-muted); font-size:12px;">${escapeHtml(d.specialty)} ${d.distance_km ? `· ${d.distance_km} km away` : ''}</div>
          ${d.address ? `<div style="color:var(--text-secondary); font-size:11.5px; margin-top:2px;">${escapeHtml(d.address)}</div>` : ''}
          <div style="display:flex; gap:12px; margin-top:8px; align-items:center; flex-wrap:wrap;">
            ${d.phone ? `<a href="tel:${escapeHtml(d.phone.replace(/\D/g, ''))}" style="color:var(--teal); font-weight:600; text-decoration:none;">📞 Call ${escapeHtml(d.phone)}</a>` : ''}
            <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent((d.lat != null && d.lon != null) ? `${d.lat},${d.lon}` : d.name)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-purple); font-weight:600; text-decoration:none; display:inline-flex; align-items:center; gap:4px; font-size:12px;">
              <span>🗺️ Google Maps Directions</span>
            </a>
          </div>
        </div>
      `;
    });
    html += '</div>';
  } else {
    html += '<p style="font-size:13px; color:var(--text-secondary); margin-bottom:8px;">No listed facilities found nearby. Please contact helpline services:</p>';
    INDIA_HEALTH_HELPLINES.forEach(h => {
      html += `<div style="font-size:12.5px; margin-bottom:4px;">${escapeHtml(h.name)}: <b>${h.phone ? `<a href="tel:${h.phone}">${h.phone}</a>` : 'Contact local clinic'}</b></div>`;
    });
  }

  div.innerHTML = html;
  feedEl.appendChild(div);
  scrollToBottom();
}
