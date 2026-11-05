async function callBackend(goal, resetTask, followup) {
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
      health_context: (currentLabel === 'medical') ? recentHealthLogSummary() : '',
      followup: !!followup
    }),
  });
  if (!res.ok) throw new Error(`Server responded with ${res.status}`);
  return res.json();
}

// what the assistant said, with the step numbers the person sees on screen ("Step 2: ...")
function historyLine(steps, offset) {
  const task = steps.some(s => s && s.time);
  return steps.map((s, i) => (task ? `Step ${(offset || 0) + i + 1}: ` : '') + s.text).join(' ');
}

async function sendMessage(text) {
  if (!text.trim()) return;
  await classifyAndSwitch(text);
  const fu = isFollowUp(text);                       // a question about the steps already given
  const prev = { goal: currentGoal, done: completedSteps, count: stepCounter };
  addUserBubble(text);
  history.push({ role: "user", content: text });
  if (!fu) { currentGoal = text; stepCounter = 0; }
  setStatus('Thinking…');
  if (sendBtn) sendBtn.disabled = true;

  try {
    const data = await callBackend(text, !fu, fu);
    const steps = data.steps || [];
    if (fu || data.is_followup) { currentGoal = prev.goal; completedSteps = prev.done; }   // the task itself carries on unchanged
    else completedSteps = steps.map(s => s.text);
    const bubble = addAssistantBubble(steps, data.is_final);
    if ((fu || data.is_followup) && prev.count) stepCounter = prev.count;
    if (!fu && !data.is_followup && !data.is_emergency && !data.was_error && !steps.some(s => s.clarify) && currentLabel !== 'medical') {
    attachResources(text, bubble);
}
    if (!data.was_error) {
      history.push({ role: "assistant", content: historyLine(steps, 0) });
    }
    snapshotCurrentSession();

    if (data.is_crisis) {
      showCrisisPanel();
    } else if (data.is_emergency) {
      showEmergencyPanel();
    } else {
      maybeShowNearbyHealthcare();
    }

    if (data.is_final && !fu && !data.is_followup) celebrateTaskDone();
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
    const before = completedSteps.length;
    completedSteps = completedSteps.concat(newSteps.map(s => s.text));
    btnEl.remove();
    addAssistantBubble(newSteps, data.is_final);
    if (!data.was_error) {
      history.push({ role: "assistant", content: historyLine(newSteps, before) });
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