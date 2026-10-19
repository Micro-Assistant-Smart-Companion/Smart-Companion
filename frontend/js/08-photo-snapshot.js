// take or pick a photo, document upload

async function startSnapCapture() {
  if (currentCameraSource === 'webcam') {
    stopIpImgPolling();
    if (snapIpImg) { snapIpImg.style.display = 'none'; snapIpImg.src = ''; }
    if (snapVideo) snapVideo.style.display = 'block';
    if (snapHint) snapHint.textContent = 'Point the webcam, then take a photo';
    try {
      if (!snapStream) snapStream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (snapVideo) snapVideo.srcObject = snapStream;
      if (snapOverlay) snapOverlay.classList.add('active');
    } catch (err) {
      setStatus('Webcam access unavailable.', true);
    }
  } else {
    if (snapStream) {
      snapStream.getTracks().forEach(t => t.stop());
      snapStream = null;
    }
    if (snapVideo) snapVideo.style.display = 'none';
    if (snapIpImg) {
      snapIpImg.style.display = 'block';
      startIpImgPolling(snapIpImg);
    }
    if (snapHint) snapHint.textContent = 'Point the IP camera, then take a photo';
    if (snapOverlay) snapOverlay.classList.add('active');
  }
}

function stopSnapCapture() {
  if (snapStream) {
    snapStream.getTracks().forEach(t => t.stop());
    snapStream = null;
  }
  stopIpImgPolling();
  if (snapIpImg) snapIpImg.src = '';
  if (snapOverlay) snapOverlay.classList.remove('active');
}

if (snapCancelBtn) snapCancelBtn.addEventListener('click', stopSnapCapture);
if (snapOverlay) {
  snapOverlay.addEventListener('click', (e) => {
    if (e.target === snapOverlay) stopSnapCapture();
  });
}

if (snapCaptureBtn) {
  snapCaptureBtn.addEventListener('click', async () => {
    if (currentCameraSource === 'webcam') {
      const canvas = document.createElement('canvas');
      canvas.width = snapVideo.videoWidth || 640;
      canvas.height = snapVideo.videoHeight || 480;
      canvas.getContext('2d').drawImage(snapVideo, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const file = new File([blob], 'webcam-frame.jpg', { type: 'image/jpeg' });
        pendingImageFile = file;
        pendingImageUrl = URL.createObjectURL(blob);
        if (attachThumb) attachThumb.src = pendingImageUrl;
        if (attachPreview) attachPreview.classList.add('active');
        if (goalEl) {
          goalEl.placeholder = "Ask a question about this photo…";
          goalEl.focus();
        }
        stopSnapCapture();
      }, 'image/jpeg', 0.85);
    } else {
      setStatus('Taking a picture from the IP camera…');
      try {
        const res = await fetch(`${API}/camera/frame?t=${Date.now()}`);
        if (!res.ok) throw new Error('Could not retrieve frame');
        const blob = await res.blob();
        const file = new File([blob], 'ipcam-frame.jpg', { type: 'image/jpeg' });
        pendingImageFile = file;
        pendingImageUrl = URL.createObjectURL(blob);
        if (attachThumb) attachThumb.src = pendingImageUrl;
        if (attachPreview) attachPreview.classList.add('active');
        if (goalEl) {
          goalEl.placeholder = "Ask a question about this photo…";
          goalEl.focus();
        }
        stopSnapCapture();
        setStatus('');
      } catch (err) {
        setStatus('Could not take a picture from the camera.', true);
      }
    }
  });
}

// Media Attachment Pickers
if (camInputLibrary) camInputLibrary.addEventListener('change', () => attachPhoto(camInputLibrary));
if (camInputCamera) camInputCamera.addEventListener('change', () => attachPhoto(camInputCamera));

function attachPhoto(inputEl) {
  const file = inputEl.files[0];
  inputEl.value = '';
  if (!file) return;
  clearDocumentAttachment();
  pendingImageFile = file;
  pendingImageUrl = URL.createObjectURL(file);
  if (attachThumb) attachThumb.src = pendingImageUrl;
  if (attachPreview) attachPreview.classList.add('active');
  if (goalEl) {
    goalEl.placeholder = "Ask a question about this photo…";
    goalEl.focus();
  }
}

if (attachRemoveBtn) attachRemoveBtn.addEventListener('click', clearAttachment);

function clearAttachment() {
  pendingImageFile = null;
  if (pendingImageUrl) URL.revokeObjectURL(pendingImageUrl);
  pendingImageUrl = null;
  if (attachPreview) attachPreview.classList.remove('active');
  if (goalEl) goalEl.placeholder = "Specify a goal or question — e.g. how do I make biryani";
}

// Document Upload
if (docInput) {
  docInput.addEventListener('change', async () => {
    const file = docInput.files[0];
    docInput.value = '';
    if (!file) return;
    clearAttachment();
    setStatus('Opening your document…');
    if (sendBtn) sendBtn.disabled = true;

    const formData = new FormData();
    formData.append('file', file, file.name);

    try {
      const res = await fetch(`${API}/upload-document`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error('upload failed');
      const data = await res.json();
      pendingDocumentId = data.document_id;
      pendingDocumentName = data.filename;
      if (docAttachLabel) docAttachLabel.textContent = `${data.filename} (${data.page_count} pages)`;
      if (docAttachPreview) docAttachPreview.classList.add('active');
      if (goalEl) {
        goalEl.placeholder = "Ask a question about this document…";
        goalEl.focus();
      }
      setStatus(data.truncated ? 'Opened the first part of this large document.' : '');
    } catch (err) {
      setStatus('Could not open the document. Please try again.', true);
    } finally {
      if (sendBtn) sendBtn.disabled = false;
    }
  });
}

if (docAttachRemoveBtn) docAttachRemoveBtn.addEventListener('click', clearDocumentAttachment);

function clearDocumentAttachment() {
  pendingDocumentId = null;
  pendingDocumentName = null;
  if (docAttachPreview) docAttachPreview.classList.remove('active');
  if (goalEl) goalEl.placeholder = "Specify a goal or question — e.g. how do I make biryani";
}

// Unified Send Dispatcher
function handleSendClick() {
  const text = goalEl ? goalEl.value.trim() : '';

  if (awaitingClarification && text && !pendingDocumentId && !pendingImageFile) {
    awaitingClarification = false;
    goalEl.value = '';
    goalEl.style.height = 'auto';
    sendMessage(`${currentGoal} - ${text}`);
    return;
  }

  if (pendingDocumentId) {
    const question = text || "Summarize the primary conclusions of this document.";
    goalEl.value = '';
    goalEl.style.height = 'auto';
    askDocument(question);
  } else if (pendingImageFile) {
    const question = text || "Describe the contents and objects within this image.";
    goalEl.value = '';
    goalEl.style.height = 'auto';
    sendImageMessage(pendingImageFile, pendingImageUrl, question);
    clearAttachment();
  } else {
    if (!text) return;
    goalEl.value = '';
    goalEl.style.height = 'auto';
    sendMessage(text);
  }
}

async function askDocument(question) {
  unlockBadge('doc', 'Bookworm');
  addUserBubble(`📄 ${question}`);
  history.push({ role: "user", content: question });
  setStatus('Reading your document…');
  if (sendBtn) sendBtn.disabled = true;

  try {
    const res = await fetch(`${API}/ask-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_id: pendingDocumentId, question }),
    });
    if (!res.ok) throw new Error('ask-document failed');
    const data = await res.json();
    addAnswerBubble(data.headline, data.detail);
    history.push({ role: "assistant", content: flattenAnswer(data.headline, data.detail) });
    setStatus('');
  } catch (err) {
    setStatus('Could not read the document. Please try again.', true);
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

async function sendImageMessage(file, imageUrl, question) {
  unlockBadge('photo', 'Photo Detective');
  addUserBubble(question, imageUrl);
  history.push({ role: "user", content: question });
  setStatus('Looking at your photo…');
  if (sendBtn) sendBtn.disabled = true;

  const formData = new FormData();
  formData.append('file', file, file.name || 'snapshot.jpg');
  formData.append('question', question);
  formData.append('history', JSON.stringify(history.slice(-8)));

  try {
    const res = await fetch(`${API}/caption-image`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('caption failed');
    const data = await res.json();
    addAnswerBubble(data.headline, data.steps);
    history.push({ role: "assistant", content: flattenAnswer(data.headline, data.steps) });
    setStatus('');
  } catch (err) {
    setStatus('Could not read the photo. Please try again.', true);
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}
