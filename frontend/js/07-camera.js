// webcam and phone IP camera

const btnSrcWebcam = document.getElementById('btnSrcWebcam');
const btnSrcIp = document.getElementById('btnSrcIp');
const btnIpSettings = document.getElementById('btnIpSettings');
const headerIpDot = document.getElementById('headerIpDot');
const ipModalDot = document.getElementById('ipModalDot');
const ipModalStatusText = document.getElementById('ipModalStatusText');
const ipTestBtn = document.getElementById('ipTestBtn');
const ipCameraUrlInput = document.getElementById('ipCameraUrlInput');
const backendApiHostInput = document.getElementById('backendApiHostInput');
const ipSettingsModal = document.getElementById('ipSettingsModal');
const ipSettingsCancelBtn = document.getElementById('ipSettingsCancelBtn');
const ipSettingsCancelIcon = document.getElementById('ipSettingsCancelIcon');
const ipSettingsSaveBtn = document.getElementById('ipSettingsSaveBtn');

const camBtn = document.getElementById('camBtn');
const camMenu = document.getElementById('camMenu');
const camChooseBtn = document.getElementById('camChooseBtn');
const camTakeBtn = document.getElementById('camTakeBtn');
const camGuideBtn = document.getElementById('camGuideBtn');
const camDocBtn = document.getElementById('camDocBtn');
const camMenuSourceLabel = document.getElementById('camMenuSourceLabel');
const camMenuSwitchBtn = document.getElementById('camMenuSwitchBtn');

const camInputLibrary = document.getElementById('camInputLibrary');
const camInputCamera = document.getElementById('camInputCamera');
const docInput = document.getElementById('docInput');

const attachPreview = document.getElementById('attachPreview');
const attachThumb = document.getElementById('attachThumb');
const attachRemoveBtn = document.getElementById('attachRemoveBtn');
const docAttachPreview = document.getElementById('docAttachPreview');
const docAttachLabel = document.getElementById('docAttachLabel');
const docAttachRemoveBtn = document.getElementById('docAttachRemoveBtn');

const snapOverlay = document.getElementById('snapOverlay');
const snapOverlaySwitcher = document.getElementById('snapOverlaySwitcher');
const snapSrcWebcam = document.getElementById('snapSrcWebcam');
const snapSrcIp = document.getElementById('snapSrcIp');
const snapVideo = document.getElementById('snapVideo');
const snapIpImg = document.getElementById('snapIpImg');
const snapHint = document.getElementById('snapHint');
const snapCaptureBtn = document.getElementById('snapCaptureBtn');
const snapCancelBtn = document.getElementById('snapCancelBtn');

const liveCamOverlay = document.getElementById('liveCamOverlay');
const liveOverlaySwitcher = document.getElementById('liveOverlaySwitcher');
const liveSrcWebcam = document.getElementById('liveSrcWebcam');
const liveSrcIp = document.getElementById('liveSrcIp');
const liveCamBadge = document.getElementById('liveCamBadge');
const liveCamVideo = document.getElementById('liveCamVideo');
const liveCamIpImg = document.getElementById('liveCamIpImg');
const liveCamAnswer = document.getElementById('liveCamAnswer');
const liveCamGoal = document.getElementById('liveCamGoal');
const liveCamMicBtn = document.getElementById('liveCamMicBtn');
const liveCamSendBtn = document.getElementById('liveCamSendBtn');
const ambientToggleBtn = document.getElementById('ambientToggleBtn');
const liveCamCloseBtn = document.getElementById('liveCamCloseBtn');

const panelWebcamPreview = document.getElementById('panelWebcamPreview');
const panelIpImgPreview = document.getElementById('panelIpImgPreview');

function startIpImgPolling(imgEl) {
  stopIpImgPolling();
  ipPollIntervalId = setInterval(() => {
    imgEl.src = `${API}/camera/frame?t=${Date.now()}`;
    if (panelIpImgPreview && panelIpImgPreview.style.display !== 'none') {
      panelIpImgPreview.src = `${API}/camera/frame?t=${Date.now()}`;
    }
  }, 200);
}

function stopIpImgPolling() {
  if (ipPollIntervalId) {
    clearInterval(ipPollIntervalId);
    ipPollIntervalId = null;
  }
}

function setCameraSource(source) {
  currentCameraSource = source;
  localStorage.setItem('companion_cam_source', source);
  const isWebcam = source === 'webcam';

  btnSrcWebcam && btnSrcWebcam.classList.toggle('active', isWebcam);
  btnSrcIp && btnSrcIp.classList.toggle('active', !isWebcam);
  liveSrcWebcam && liveSrcWebcam.classList.toggle('active', isWebcam);
  liveSrcIp && liveSrcIp.classList.toggle('active', !isWebcam);
  snapSrcWebcam && snapSrcWebcam.classList.toggle('active', isWebcam);
  snapSrcIp && snapSrcIp.classList.toggle('active', !isWebcam);

  if (camMenuSourceLabel) camMenuSourceLabel.textContent = isWebcam ? 'Webcam' : 'IP Camera';
  if (camMenuSwitchBtn) camMenuSwitchBtn.textContent = isWebcam ? 'Use IP Cam' : 'Use Webcam';
  if (contextCamSource) contextCamSource.textContent = isWebcam ? 'WEBCAM' : 'IP CAM';

  if (isWebcam) {
    if (panelIpImgPreview) panelIpImgPreview.style.display = 'none';
    if (panelWebcamPreview) panelWebcamPreview.style.display = 'block';
  } else {
    if (panelWebcamPreview) panelWebcamPreview.style.display = 'none';
    if (panelIpImgPreview) {
      panelIpImgPreview.style.display = 'block';
      startIpImgPolling(panelIpImgPreview);
    }
  }

  if (snapOverlay && snapOverlay.classList.contains('active')) startSnapCapture();
  if (liveCamOverlay && liveCamOverlay.classList.contains('active')) startGuidedSearch();
}

if (btnSrcWebcam) btnSrcWebcam.addEventListener('click', () => setCameraSource('webcam'));
if (btnSrcIp) btnSrcIp.addEventListener('click', () => setCameraSource('ipcamera'));
if (liveSrcWebcam) liveSrcWebcam.addEventListener('click', () => setCameraSource('webcam'));
if (liveSrcIp) liveSrcIp.addEventListener('click', () => setCameraSource('ipcamera'));
if (snapSrcWebcam) snapSrcWebcam.addEventListener('click', () => setCameraSource('webcam'));
if (snapSrcIp) snapSrcIp.addEventListener('click', () => setCameraSource('ipcamera'));
if (camMenuSwitchBtn) camMenuSwitchBtn.addEventListener('click', () => {
  setCameraSource(currentCameraSource === 'webcam' ? 'ipcamera' : 'webcam');
});

async function checkCameraStatus() {
  try {
    const res = await fetch(`${API}/camera/status`);
    if (res.ok) {
      const data = await res.json();
      if (data.url && ipCameraUrlInput && document.activeElement !== ipCameraUrlInput) {
        ipCameraUrlInput.value = data.url;
      }
      const isConnected = !!data.connected;
      const color = isConnected ? 'var(--teal)' : 'var(--coral)';
      if (headerIpDot) {
        headerIpDot.style.background = color;
        headerIpDot.title = isConnected ? `IP Camera online (${data.url})` : 'IP Camera offline';
      }
      if (ipModalDot) ipModalDot.style.background = color;
      if (ipModalStatusText) {
        ipModalStatusText.textContent = isConnected
          ? 'Camera connected'
          : (data.message || 'Camera not connected');
        ipModalStatusText.style.color = color;
      }
      return data;
    }
  } catch (e) {
    if (headerIpDot) headerIpDot.style.background = 'var(--text-faint)';
    if (ipModalDot) ipModalDot.style.background = 'var(--text-faint)';
    if (ipModalStatusText) {
      ipModalStatusText.textContent = 'App server offline';
      ipModalStatusText.style.color = 'var(--text-muted)';
    }
  }
  return null;
}
checkCameraStatus();
// check every 20s, and not at all while the tab is in the background
setInterval(() => { if (!document.hidden) checkCameraStatus(); }, 20000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkCameraStatus(); });

if (btnIpSettings) {
  btnIpSettings.addEventListener('click', () => {
    if (ipSettingsModal) ipSettingsModal.classList.add('active');
    if (backendApiHostInput) backendApiHostInput.value = localStorage.getItem('companion_api_host') || '';
    checkCameraStatus();
    if (ipCameraUrlInput) ipCameraUrlInput.focus();
  });
}
if (ipSettingsCancelBtn) ipSettingsCancelBtn.addEventListener('click', () => ipSettingsModal.classList.remove('active'));
if (ipSettingsCancelIcon) ipSettingsCancelIcon.addEventListener('click', () => ipSettingsModal.classList.remove('active'));
if (ipSettingsModal) {
  ipSettingsModal.addEventListener('click', (e) => {
    if (e.target === ipSettingsModal) ipSettingsModal.classList.remove('active');
  });
}

if (ipTestBtn) {
  ipTestBtn.addEventListener('click', async () => {
    ipTestBtn.disabled = true;
    ipTestBtn.textContent = 'Pinging…';
    const status = await checkCameraStatus();
    ipTestBtn.disabled = false;
    ipTestBtn.textContent = 'Test camera';
    if (status && status.connected) setStatus('Camera connected.');
    else setStatus('Camera not connected. Check the address.', true);
  });
}

if (ipSettingsSaveBtn) {
  ipSettingsSaveBtn.addEventListener('click', async () => {
    if (backendApiHostInput) {
      const customHost = backendApiHostInput.value.trim();
      if (customHost) {
        API = customHost;
        localStorage.setItem('companion_api_host', API);
      } else {
        localStorage.removeItem('companion_api_host');
        API = (window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
          ? `http://${window.location.hostname}:8000`
          : "http://127.0.0.1:8000";
      }
    }
    const newUrl = ipCameraUrlInput ? ipCameraUrlInput.value.trim() : '';
    if (!newUrl) {
      if (ipSettingsModal) ipSettingsModal.classList.remove('active');
      setStatus('Settings applied.');
      return;
    }
    setStatus('Connecting to camera…');
    ipSettingsSaveBtn.disabled = true;
    ipSettingsSaveBtn.textContent = 'Connecting…';
    try {
      const res = await fetch(`${API}/camera/set-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl })
      });
      if (res.ok) {
        const data = await res.json();
        ipCameraUrlInput.value = data.url;
        setCameraSource('ipcamera');
        await checkCameraStatus();
        setStatus(data.connected ? 'Camera connected.' : 'Camera address saved.');
      } else {
        setStatus('Could not save the camera settings.', true);
      }
    } catch (err) {
      setStatus('Cannot reach the app server.', true);
    } finally {
      ipSettingsSaveBtn.disabled = false;
      ipSettingsSaveBtn.textContent = 'Save & Apply';
      if (ipSettingsModal) ipSettingsModal.classList.remove('active');
    }
  });
}

// Camera Menu Controls
if (camBtn) {
  camBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    camMenu.classList.toggle('open');
  });
}
document.addEventListener('click', () => {
  if (camMenu) camMenu.classList.remove('open');
});
if (camChooseBtn) {
  camChooseBtn.addEventListener('click', () => {
    camMenu.classList.remove('open');
    if (camInputLibrary) camInputLibrary.click();
  });
}
if (camTakeBtn) {
  camTakeBtn.addEventListener('click', () => {
    camMenu.classList.remove('open');
    startSnapCapture();
  });
}
if (camGuideBtn) {
  camGuideBtn.addEventListener('click', () => {
    camMenu.classList.remove('open');
    startGuidedSearch();
  });
}
if (camDocBtn) {
  camDocBtn.addEventListener('click', () => {
    camMenu.classList.remove('open');
    if (docInput) docInput.click();
  });
}

// Tool Nav Shortcuts
const camVisionToolBtn = document.getElementById('camVisionToolBtn');
if (camVisionToolBtn) {
  camVisionToolBtn.addEventListener('click', () => {
    toggleSidebar(false);
    startGuidedSearch();
  });
}
const docToolBtn = document.getElementById('docToolBtn');
if (docToolBtn) {
  docToolBtn.addEventListener('click', () => {
    toggleSidebar(false);
    if (docInput) docInput.click();
  });
}
