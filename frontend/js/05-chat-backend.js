// [05/19] sending a message to the server (/decompose-task)
// Part of the Smart Companion page script. Loaded by index.html in numeric order; all files share one global scope.
// --- 8. TASK DECOMPOSITION BACKEND INTEGRATION ---

async function callBackend(goal, resetTask) {
  if (resetTask) completedSteps = [];
  const res = await fetch(`${API}/decompose-task`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      goal,
      reading_level: "simple",
      max_steps: 3,
      tone: "encouraging",
      completed_steps: completedSteps,
      history,
      session_note: currentSessionNote,
      language: currentLangCode(),
      health_context: (currentLabel === 'medical') ? recentHealthLogSummary() : ''
    }),
  });
  if (!res.ok) throw new Error(`Server responded with ${res.status}`);
  return res.json();
}

async function sendMessage(text) {
  if (!text.trim()) return;
  await classifyAndSwitch(text);
  addUserBubble(text);
  history.push({ role: "user", content: text });
  currentGoal = text;
  stepCounter = 0;
  setStatus('Thinking…');
  if (sendBtn) sendBtn.disabled = true;

  try {
    const data = await callBackend(text, true);
    const steps = data.steps || [];
    completedSteps = steps.map(s => s.text);
    const bubble = addAssistantBubble(steps, data.is_final);
    if (!data.is_emergency && !data.was_error && !steps.some(s => s.clarify) && currentLabel !== 'medical') {
    attachResources(text, bubble);
}
    if (!data.was_error) {
      history.push({ role: "assistant", content: steps.map(s => s.text).join(' ') });
    }
    snapshotCurrentSession();

    if (data.is_emergency) {
      showEmergencyPanel();
    } else {
      maybeShowNearbyHealthcare();
    }

    if (data.is_final) celebrateTaskDone();
    setStatus('');
  } catch (err) {
    console.error('sendMessage error:', err);
    setStatus("Cannot connect right now. Please check that the app server is running.", true);
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

async function handleDone(btnEl) {
  btnEl.disabled = true;
  btnEl.innerHTML = `<span>Getting your next steps…</span>`;
  setStatus('Getting your next steps…');

  try {
    const data = await callBackend(currentGoal, false);
    const newSteps = data.steps || [];
    completedSteps = completedSteps.concat(newSteps.map(s => s.text));
    btnEl.remove();
    addAssistantBubble(newSteps, data.is_final);
    if (!data.was_error) {
      history.push({ role: "assistant", content: newSteps.map(s => s.text).join(' ') });
    }
    celebrateStep();
    snapshotCurrentSession();
    if (data.is_final) celebrateTaskDone();
    setStatus('');
  } catch (err) {
    console.error('handleDone error:', err);
    setStatus("Something went wrong. Please try again.", true);
    btnEl.disabled = false;
    btnEl.innerHTML = `<span>Next step</span><span>→</span>`;
  }
}

if (sendBtn) sendBtn.addEventListener('click', () => handleSendClick());
