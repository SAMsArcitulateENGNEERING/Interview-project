// Forms-like MCQ-only host dashboard
(function() {
  const el = (sel, root=document) => root.querySelector(sel);
  const els = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  let currentExamId = null;
  let questions = []; // local cache

  function toast(msg, type='info') {
    console[type === 'error' ? 'error' : 'log'](msg);
    
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
        <span>${msg}</span>
      </div>
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
  }

  function setStatus(text) {
    const pill = el('#status-pill');
    if (pill) {
      pill.textContent = text;
      pill.className = 'pill ' + (text === 'Active' ? 'active' : 'draft');
    }
  }

  function showDeleteExamButton(show) {
    const deleteBtn = el('#btn-delete-exam');
    if (deleteBtn) {
      deleteBtn.style.display = show ? 'inline-block' : 'none';
    }
  }

  function showActivateExamButton(show) {
    const activateBtn = el('#btn-activate-exam');
    if (activateBtn) {
      activateBtn.style.display = show ? 'inline-block' : 'none';
    }
  }

  function buildQuestionDom(q, index) {
    const tmpl = el('#tmpl-question');
    const node = tmpl.content.firstElementChild.cloneNode(true);
    el('.q-index', node).textContent = '#' + (index + 1);
    const textInput = el('.q-text', node);
    textInput.value = q.text || '';
    const optsBox = el('.options', node);
    (q.options || []).forEach((opt, i) => addOptionDom(optsBox, { text: opt, correct: opt === q.correct_answer }));
    if ((q.options || []).length === 0) {
      addOptionDom(optsBox, { text: '', correct: false });
      addOptionDom(optsBox, { text: '', correct: false });
    }
    el('.q-points', node).value = q.points || 1;

    el('.add-opt', node).addEventListener('click', () => addOptionDom(optsBox, { text: '', correct: false }));
    el('.delete', node).addEventListener('click', async () => {
      if (!confirm('Are you sure you want to delete this question?')) return;
      
      try {
        if (q.id) {
          const r = await fetch(`/api/question/${q.id}`, { method: 'DELETE' });
          if (!r.ok) { 
            toast('Failed to delete question from database', 'error'); 
            return; 
          }
        }
        questions.splice(index, 1);
        renderQuestions();
        toast('Question deleted successfully');
      } catch (error) {
        toast('Failed to delete question: ' + error.message, 'error');
      }
    });


    // persist on blur
    textInput.addEventListener('blur', () => saveQuestionFromDom(node, index));
    el('.q-points', node).addEventListener('change', () => saveQuestionFromDom(node, index));
    
    // Auto-save options when they change
    const optionsContainer = el('.options', node);
    optionsContainer.addEventListener('change', () => saveQuestionFromDom(node, index));
    optionsContainer.addEventListener('blur', () => saveQuestionFromDom(node, index));

    return node;
  }

  function addOptionDom(container, { text, correct }) {
    const tmpl = el('#tmpl-option');
    const node = tmpl.content.firstElementChild.cloneNode(true);
    el('.opt-text', node).value = text || '';
    const radio = el('.opt-correct', node);
    radio.name = 'correct-' + Math.random().toString(36).slice(2);
    container.appendChild(node);
    // ensure one correct
    if (correct) radio.checked = true;
    radio.addEventListener('change', () => { /* visual only */ });
    el('.opt-text', node).addEventListener('blur', () => {/* handled on save */});
    return node;
  }

  function readQuestionFromDom(node) {
    const text = el('.q-text', node).value.trim();
    const options = els('.option', node).map(opt => el('.opt-text', opt).value.trim()).filter(Boolean);
    const radios = els('.option .opt-correct', node);
    let correct_answer = '';
    radios.forEach((r, i) => { if (r.checked) correct_answer = options[i] || correct_answer; });
    const points = parseInt(el('.q-points', node).value || '1', 10);
    return { text, options, correct_answer, points };
  }

  async function saveQuestionFromDom(node, index) {
    const data = readQuestionFromDom(node);
    if (!data.text || data.options.length < 2 || !data.correct_answer) return; // wait for valid
    try {
      if (!currentExamId) { toast('Select or save quiz first', 'error'); return; }
      let res;
      if (questions[index] && questions[index].id) {
        res = await fetch(`/api/question/${questions[index].id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const fd = new FormData();
        fd.append('text', data.text);
        fd.append('options', JSON.stringify(data.options));
        fd.append('correct_answer', data.correct_answer);
        fd.append('points', String(data.points));
        fd.append('exam_id', String(currentExamId));
        res = await fetch('/api/create_question', { method: 'POST', body: fd });
        if (!res.ok) throw new Error(await res.text());
        const created = await res.json();
        questions[index] = created;
      }
      await loadQuestions();
      toast('Saved');
    } catch (e) {
      toast('Save failed: ' + e.message, 'error');
    }
  }



  function renderQuestions() {
    const list = el('#questions-list');
    list.innerHTML = '';
    questions.forEach((q, i) => list.appendChild(buildQuestionDom(q, i)));
  }

  async function deleteExam() {
    if (!currentExamId || !confirm('Are you sure you want to delete this exam? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/exam/${currentExamId}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('Failed to delete exam');
      }
      
      toast('Exam deleted successfully');
      currentExamId = null;
      questions = [];
      renderQuestions();
      showDeleteExamButton(false);
      showActivateExamButton(false);
      setStatus('Draft');
      await loadExams();
      
      // Clear form
      el('#quiz-title').value = '';
      el('#quiz-desc').value = '';
      el('#quiz-duration').value = '60';
      el('#quiz-start').value = '';
      el('#existing-exams').value = '';
      
    } catch (error) {
      toast('Failed to delete exam: ' + error.message, 'error');
    }
  }

  async function activateExam() {
    if (!currentExamId || !confirm('Are you sure you want to activate this exam? It will be available for participants to take.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/exam/${currentExamId}/start`, { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to activate exam');
      }
      
      toast('Exam activated successfully!');
      setStatus('Active');
      showActivateExamButton(false);
      
    } catch (error) {
      toast('Failed to activate exam: ' + error.message, 'error');
    }
  }

  async function loadQuestions() {
    if (!currentExamId) return;
    const r = await fetch(`/api/exam/${currentExamId}/questions`);
    if (!r.ok) { questions = []; renderQuestions(); return; }
    questions = await r.json();
    renderQuestions();
  }

  async function loadExams() {
    const r = await fetch('/api/active_exams');
    const data = await r.json();
    const sel = el('#existing-exams');
    sel.innerHTML = '<option value="">Select existing exam…</option>' + data.map(e => `<option value="${e.id}">${e.title}</option>`).join('');
  }

  async function createOrUpdateExam() {
    const title = el('#quiz-title').value.trim() || 'Untitled Quiz';
    const description = el('#quiz-desc').value.trim();
    const duration = parseInt(el('#quiz-duration').value || '60', 10);
    const startVal = el('#quiz-start').value;
    const payload = { title, description, duration };
    if (startVal) payload.start_date = new Date(startVal).toISOString();
    if (!currentExamId) {
      const r = await fetch('/api/create_exam', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await r.json();
      if (result.success) { 
        currentExamId = result.exam_id; 
        toast('Exam created'); 
        setStatus('Draft'); 
        showDeleteExamButton(true);
        showActivateExamButton(true);
        await loadExams(); 
        await loadQuestions(); 
      }
      else toast(result.error || 'Failed to create exam', 'error');
    } else {
      const r = await fetch(`/api/exam/${currentExamId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, description, duration_minutes: duration, start_date: payload.start_date || null }) });
      if (r.ok) {
        toast('Exam settings saved');
        showDeleteExamButton(true);
        showActivateExamButton(true);
      } else {
        toast('Failed to save exam', 'error');
      }
    }
  }

  function addBlankQuestion() {
    questions.push({ text: '', options: [], correct_answer: '', points: 1 });
    renderQuestions();
    // Auto-save the new question if we have an exam selected
    if (currentExamId) {
      setTimeout(() => {
        const lastQuestionNode = el('#questions-list .q-item:last-child');
        if (lastQuestionNode) {
          saveQuestionFromDom(lastQuestionNode, questions.length - 1);
        }
      }, 100);
    }
  }

  // Activity Management
  let activityInterval = null;

  function initializeActivityTabs() {
    const tabBtns = els('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        switchTab(tabName);
      });
    });
  }

  function switchTab(tabName) {
    // Update tab buttons
    els('.tab-btn').forEach(btn => btn.classList.remove('active'));
    el(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update tab content
    els('.tab-pane').forEach(pane => pane.classList.remove('active'));
    el(`#${tabName}-tab`).classList.add('active');
    
    // Load tab data
    loadTabData(tabName);
  }

  async function loadTabData(tabName) {
    if (!currentExamId) return;
    
    try {
      switch(tabName) {
        case 'participants':
          await loadParticipants();
          break;
        case 'violations':
          await loadViolations();
          break;
        case 'recent':
          await loadRecentActivity();
          break;
      }
    } catch (error) {
      console.error(`Error loading ${tabName} data:`, error);
    }
  }

  async function loadParticipants() {
    const response = await fetch(`/api/exam/${currentExamId}/participants`);
    const participants = await response.json();
    
    const container = el('#participants-list');
    if (participants.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-users"></i>
          <p>No participants yet</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = participants.map(p => `
      <div class="participant-item">
        <div class="participant-avatar">${p.name.charAt(0).toUpperCase()}</div>
        <div class="participant-info">
          <div class="participant-name">${p.name}</div>
          <div class="participant-email">${p.email}</div>
        </div>
        <div class="participant-status ${p.status}">${p.status}</div>
      </div>
    `).join('');
  }

  async function loadViolations() {
    const response = await fetch(`/api/exam/${currentExamId}/violations`);
    const violations = await response.json();
    
    const container = el('#violations-list');
    if (violations.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-shield-alt"></i>
          <p>No violations detected</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = violations.map(v => `
      <div class="violation-item">
        <div class="violation-icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <div class="violation-info">
          <div class="violation-participant">${v.participant_name}</div>
          <div class="violation-details">Alt+Tab violation (${v.count} times)</div>
        </div>
        <div class="violation-time">${formatTime(v.timestamp)}</div>
      </div>
    `).join('');
  }

  async function loadRecentActivity() {
    const response = await fetch(`/api/exam/${currentExamId}/activity`);
    const activities = await response.json();
    
    const container = el('#recent-activity');
    if (activities.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-history"></i>
          <p>No recent activity</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = activities.map(a => `
      <div class="activity-item">
        <div class="activity-icon">
          <i class="fas ${getActivityIcon(a.type)}"></i>
        </div>
        <div class="activity-info">
          <div class="activity-text">${a.description}</div>
          <div class="activity-time">${formatTime(a.timestamp)}</div>
        </div>
      </div>
    `).join('');
  }

  function getActivityIcon(type) {
    const icons = {
      'start': 'fa-play',
      'submit': 'fa-check',
      'violation': 'fa-exclamation-triangle',
      'complete': 'fa-flag-checkered',
      'default': 'fa-circle'
    };
    return icons[type] || icons.default;
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  }

  async function updateActivityStats() {
    if (!currentExamId) return;
    
    try {
      const response = await fetch(`/api/exam/${currentExamId}/stats`);
      const stats = await response.json();
      
      el('#active-participants').textContent = stats.active_participants || 0;
      el('#total-violations').textContent = stats.total_violations || 0;
      el('#completion-rate').textContent = `${stats.completion_rate || 0}%`;
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  }

  function startActivityPolling() {
    if (activityInterval) clearInterval(activityInterval);
    activityInterval = setInterval(() => {
      updateActivityStats();
      const activeTab = el('.tab-btn.active');
      if (activeTab) {
        loadTabData(activeTab.dataset.tab);
      }
    }, 5000); // Update every 5 seconds
  }

  function stopActivityPolling() {
    if (activityInterval) {
      clearInterval(activityInterval);
      activityInterval = null;
    }
  }

  // Wire up UI
  document.addEventListener('DOMContentLoaded', async () => {
    await loadExams();
    initializeActivityTabs();
    
    el('#btn-new').addEventListener('click', () => { 
      currentExamId = null; 
      questions = []; 
      renderQuestions(); 
      setStatus('Draft'); 
      showDeleteExamButton(false);
      showActivateExamButton(false);
      stopActivityPolling();
      const sel=el('#existing-exams'); 
      if (sel) sel.value=''; 
    });
    
    const saveBtn = el('#btn-save');
    if (saveBtn) saveBtn.addEventListener('click', createOrUpdateExam);
    
    el('#existing-exams').addEventListener('change', async (e) => { 
      currentExamId = e.target.value || null; 
      await loadQuestions(); 
      setStatus('Draft'); 
      showDeleteExamButton(!!currentExamId);
      showActivateExamButton(!!currentExamId);
      
      if (currentExamId) {
        startActivityPolling();
        updateActivityStats();
        loadTabData('participants');
      } else {
        stopActivityPolling();
      }
    });
    
    el('#btn-add-q').addEventListener('click', addBlankQuestion);
    el('#btn-delete-exam').addEventListener('click', deleteExam);
    el('#btn-activate-exam').addEventListener('click', activateExam);
  });
})();


