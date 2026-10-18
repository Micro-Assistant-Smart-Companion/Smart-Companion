// [04/19] step cards, chat bubbles, timeline
// Part of the Smart Companion page script. Loaded by index.html in numeric order; all files share one global scope.
// --- 7. STRUCTURED COGNITIVE TIMELINE & HERO STEP CARDS ---

function addUserBubble(text, imageUrl) {
  if (!feedEl) return;
  const hero = document.getElementById('welcomeHero');
  if (hero) hero.style.display = 'none';

  const div = document.createElement('div');
  div.className = 'msg user';

  const metaHeader = document.createElement('div');
  metaHeader.className = 'msg-meta-header';
  metaHeader.innerHTML = `<span>You</span><span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`;
  div.appendChild(metaHeader);

  const textSpan = document.createElement('div');
  textSpan.className = 'msg-body-text';
  textSpan.textContent = text;
  div.appendChild(textSpan);

  if (imageUrl) {
    const img = document.createElement('img');
    img.src = imageUrl;
    img.className = 'msg-thumb';
    img.alt = 'Attached Frame';
    div.appendChild(img);
  }

  feedEl.appendChild(div);
  scrollToBottom();
}

function playCompletionChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch (e) {}
}

function formatTimer(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function addAssistantBubble(steps, isFinal) {
  if (!feedEl) return null;
  const div = document.createElement('div');
  div.className = 'msg assistant';

  const synthesisTag = document.createElement('div');
  synthesisTag.className = 'synthesis-header-tag';
  synthesisTag.innerHTML = `<span>Smart Companion</span>`;
  div.appendChild(synthesisTag);

  // Clarification Handling
  const clarifyStep = steps.find(s => s.clarify);
  if (clarifyStep) {
    const wrap = document.createElement('div');
    wrap.className = 'step-sequence-wrap';

    const q = document.createElement('div');
    q.style.fontSize = '15px';
    q.style.fontWeight = '500';
    q.style.marginBottom = '12px';
    q.textContent = clarifyStep.text;
    wrap.appendChild(q);

    if (clarifyStep.choices && clarifyStep.choices.length) {
      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex; flex-wrap:wrap; gap:8px; margin-top:8px;';
      clarifyStep.choices.forEach(choice => {
        const cb = document.createElement('button');
        cb.className = 'btn-subtle';
        cb.textContent = choice;
        cb.onclick = () => {
          btnRow.querySelectorAll('button').forEach(b => b.disabled = true);
          awaitingClarification = false;
          sendMessage(`${currentGoal} - ${choice}`);
        };
        btnRow.appendChild(cb);
      });
      wrap.appendChild(btnRow);
    } else {
      awaitingClarification = true;
    }

    addSpeakButton(wrap, clarifyStep.text);
    div.appendChild(wrap);
    feedEl.appendChild(div);
    scrollToBottom();
    return div;
  }

  awaitingClarification = false;

  // Hero Micro-Step Component
  const wrap = document.createElement('div');
  wrap.className = 'step-sequence-wrap';

  // Segmented Progression Deck
  const progressionDeck = document.createElement('div');
  progressionDeck.className = 'step-progression-deck';
  progressionDeck.innerHTML = `
    <div class="progression-labels">
      <span class="progression-stage-title">Next steps</span>
      <span class="progression-metric-badge">0 of ${steps.length} completed</span>
    </div>
    <div class="progression-track">
      <div class="progression-fill" style="width: 0%;"></div>
    </div>
  `;
  wrap.appendChild(progressionDeck);

  const list = document.createElement('div');
  list.className = 'step-card-list';
  const stepEntries = [];

  steps.forEach((s, idx) => {
    stepCounter += 1;
    const stepIndex = stepCounter;
    const item = document.createElement('div');
    item.className = 'step-item' + (idx === 0 ? ' active-focus' : ' pending');

    const chk = document.createElement('button');
    chk.className = 'step-checkbox';
    chk.type = 'button';
    chk.setAttribute('aria-label', `Complete milestone ${stepIndex}`);
    chk.textContent = String(stepIndex).padStart(2, '0');

    const body = document.createElement('div');
    body.className = 'step-body';

    const stateTag = document.createElement('span');
    stateTag.className = 'step-state-tag ' + (idx === 0 ? 'focus' : 'pending');
    stateTag.textContent = (idx === 0 ? 'Current step' : `Step ${idx + 1}`);
    body.appendChild(stateTag);

    const title = document.createElement('div');
    title.className = 'step-title';
    title.textContent = s.text ?? '';
    body.appendChild(title);

    const metaRow = document.createElement('div');
    metaRow.className = 'step-meta-row';

    if (s.time) {
      const durChip = document.createElement('span');
      durChip.className = 'step-duration-chip';
      durChip.textContent = `⏱ ~ ${s.time}`;
      metaRow.appendChild(durChip);

      const mMatch = String(s.time).match(/(\d+)/);
      const totalSec = mMatch ? parseInt(mMatch[1], 10) * 60 : 300;
      let remainingSec = totalSec;
      let timerId = null;

      const timerBtn = document.createElement('button');
      timerBtn.type = 'button';
      timerBtn.className = 'step-timer-btn';
      timerBtn.textContent = '⏱ Start Timer';

      timerBtn.onclick = (e) => {
        e.stopPropagation();
        if (timerId) {
          clearInterval(timerId);
          timerId = null;
          timerBtn.classList.remove('running');
          timerBtn.textContent = `⏱ Resume (${formatTimer(remainingSec)})`;
        } else {
          timerBtn.classList.add('running');
          timerId = setInterval(() => {
            remainingSec -= 1;
            if (remainingSec <= 0) {
              clearInterval(timerId);
              timerId = null;
              timerBtn.classList.remove('running');
              timerBtn.textContent = '⏱ Time complete!';
              playCompletionChime();
            } else {
              timerBtn.textContent = `⏱ ${formatTimer(remainingSec)} [Pause]`;
            }
          }, 1000);
        }
      };
      metaRow.appendChild(timerBtn);
    }

    body.appendChild(metaRow);
    item.appendChild(chk);
    item.appendChild(body);
    list.appendChild(item);

    const entry = { item, chk, stateTag, stepIndex };
    stepEntries.push(entry);

    const toggleDone = () => {
      const isCompleted = item.classList.toggle('completed');
      if (isCompleted) {
        chk.textContent = '✓';
        stateTag.className = 'step-state-tag done';
        stateTag.textContent = 'Completed';
        item.classList.remove('active-focus');
        item.classList.remove('pending');
        playCompletionChime();
      } else {
        chk.textContent = String(stepIndex).padStart(2, '0');
        stateTag.className = 'step-state-tag pending';
        stateTag.textContent = `Step ${stepIndex}`;
        item.classList.add('pending');
      }

      // Re-evaluate active focus: next uncompleted step becomes active-focus
      let foundFocus = false;
      let completedCount = 0;
      stepEntries.forEach(se => {
        if (se.item.classList.contains('completed')) {
          completedCount += 1;
        } else if (!foundFocus) {
          se.item.classList.remove('pending');
          se.item.classList.add('active-focus');
          se.stateTag.className = 'step-state-tag focus';
          se.stateTag.textContent = 'Current step';
          foundFocus = true;
        } else {
          se.item.classList.remove('active-focus');
          se.item.classList.add('pending');
          se.stateTag.className = 'step-state-tag pending';
          se.stateTag.textContent = `Step ${se.stepIndex}`;
        }
      });

      // Update progress bar
      const fillEl = progressionDeck.querySelector('.progression-fill');
      const badgeEl = progressionDeck.querySelector('.progression-metric-badge');
      const pct = Math.round((completedCount / stepEntries.length) * 100);
      if (fillEl) fillEl.style.width = pct + '%';
      if (badgeEl) {
        if (completedCount === stepEntries.length) {
          badgeEl.textContent = `All ${stepEntries.length} completed ✓`;
          const doneBtn = wrap.querySelector('.done-btn');
          if (doneBtn) {
            doneBtn.innerHTML = `<span>Done — what's next?</span> <span>→</span>`;
          }
        } else {
          badgeEl.textContent = `${completedCount} of ${stepEntries.length} completed`;
          const doneBtn = wrap.querySelector('.done-btn');
          if (doneBtn) {
            doneBtn.innerHTML = `<span>Done — what's next?</span> <span>→</span>`;
          }
        }
      }
    };

    chk.onclick = (e) => {
      e.stopPropagation();
      toggleDone();
    };
    item.onclick = (e) => {
      if (e.target.closest('.step-timer-btn')) return;
      toggleDone();
    };
  });

  wrap.appendChild(list);

  if (!isFinal) {
    const actionBar = document.createElement('div');
    actionBar.className = 'next-step-action-bar';

    const btn = document.createElement('button');
    btn.className = 'done-btn';
    btn.type = 'button';
    btn.innerHTML = `<span>Done — what's next?</span> <span>→</span>`;
    btn.onclick = () => handleDone(btn);

    actionBar.appendChild(btn);
    wrap.appendChild(actionBar);
  } else {
    const note = document.createElement('div');
    note.className = 'done-note';
    note.innerHTML = `<span>✓ Task completed</span>`;
    wrap.appendChild(note);
  }

  addSpeakButton(wrap, steps.map(s => s.text ?? '').join('. '));
  div.appendChild(wrap);
  feedEl.appendChild(div);
  scrollToBottom();
  return div;
}

function addAnswerBubble(headline, stepsOrDetail) {
  if (!feedEl) return;
  const div = document.createElement('div');
  div.className = 'msg assistant';

  const synthesisTag = document.createElement('div');
  synthesisTag.className = 'synthesis-header-tag';
  synthesisTag.innerHTML = `<span>Smart Companion</span>`;
  div.appendChild(synthesisTag);

  const headlineEl = document.createElement('div');
  headlineEl.className = 'answer-headline';
  headlineEl.textContent = headline;
  div.appendChild(headlineEl);

  if (Array.isArray(stepsOrDetail) && stepsOrDetail.length > 0) {
    const detailEl = document.createElement('div');
    detailEl.className = 'answer-detail';
    stepsOrDetail.forEach(point => {
      const line = document.createElement('div');
      line.className = 'point-line';
      line.innerHTML = `<span class="point-dot">▸</span><span>${escapeHtml(point)}</span>`;
      detailEl.appendChild(line);
    });
    div.appendChild(detailEl);
  } else if (typeof stepsOrDetail === 'string' && stepsOrDetail.trim()) {
    const detailEl = document.createElement('div');
    detailEl.className = 'answer-detail';
    detailEl.textContent = stepsOrDetail;
    div.appendChild(detailEl);
  }

  addSpeakButton(div, flattenAnswer(headline, stepsOrDetail));
  feedEl.appendChild(div);
  scrollToBottom();
}

function flattenAnswer(headline, stepsOrDetail) {
  if (Array.isArray(stepsOrDetail)) return [headline, ...stepsOrDetail].join(' ').trim();
  return `${headline} ${stepsOrDetail || ''}`.trim();
}

function addSpeakButton(container, text) {
  if (!text || !text.trim() || !window.speechSynthesis) return;
  const btn = document.createElement('button');
  btn.className = 'speak-bubble-btn';
  btn.type = 'button';
  btn.title = 'Vocalize';
  btn.innerHTML = `<span>🔊 Read Aloud</span>`;
  btn.onclick = (e) => {
    e.stopPropagation();
    speak(text);
  };
  container.appendChild(btn);
}
