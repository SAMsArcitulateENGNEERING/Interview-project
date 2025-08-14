// Host Dashboard JavaScript
class HostDashboard {
    constructor() {
        this.exams = [];
        this.participants = [];
        this.violations = [];
        this.stats = {
            totalParticipants: 0,
            activeParticipants: 0,
            totalViolations: 0
        };
        this.isLoadingQuestions = false;
        this.questionsCache = [];
        this.currentExamId = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setDefaultDateTime();
        this.loadActiveExams();
        this.loadAllExamAttempts();
        this.startRealTimeUpdates();
        this.updateConnectionStatus();
    }

    setupEventListeners() {
        // Exam form submission
        document.getElementById('exam-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createExam();
        });

        // Question form submission
        document.getElementById('question-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createQuestion();
        });

        // Bulk question creation
        document.getElementById('bulk-create-btn').addEventListener('click', (e) => {
            e.preventDefault();
            this.createBulkQuestions();
        });

        // Add option button
        document.getElementById('add-option').addEventListener('click', () => {
            this.addOption();
        });

        // Selected exam change
        document.getElementById('selected-exam').addEventListener('change', (e) => {
            this.currentExamId = e.target.value || null;
            this.loadExamQuestions(this.currentExamId);
        });

        // Modal close
        document.querySelector('.close').addEventListener('click', () => {
            this.closeModal();
        });

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('exam-details-modal');
            if (e.target === modal) {
                this.closeModal();
            }
        });
    }

    setDefaultDateTime() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        document.getElementById('start-date').value = tomorrow.toISOString().split('T')[0];
        document.getElementById('start-time').value = '09:00';
    }

    async createExam() {
        const formData = {
            title: document.getElementById('exam-title').value,
            description: document.getElementById('exam-description').value,
            duration: parseInt(document.getElementById('exam-duration').value),
            questionCount: parseInt(document.getElementById('question-count').value),
            startDate: document.getElementById('start-date').value,
            startTime: document.getElementById('start-time').value,
            password: document.getElementById('exam-password').value,
            enableMonitoring: document.getElementById('enable-monitoring').checked
        };

        try {
            const response = await fetch('/api/create_exam', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage('Exam created successfully!', 'success');
                document.getElementById('exam-form').reset();
                this.setDefaultDateTime();
                this.loadActiveExams();
                this.showQuestionsSection();
                this.loadExamSelect();
            } else {
                this.showMessage(result.error || 'Failed to create exam', 'error');
            }
        } catch (error) {
            this.showMessage('Error creating exam: ' + error.message, 'error');
        }
    }

    showQuestionsSection() {
        document.getElementById('questions-section').style.display = 'block';
        this.loadExamSelect();
    }

    async loadExamSelect() {
        try {
            const response = await fetch('/api/active_exams');
            const exams = await response.json();
            
            const select = document.getElementById('selected-exam');
            select.innerHTML = '<option value="">Choose an exam...</option>';
            
            exams.forEach(exam => {
                const option = document.createElement('option');
                option.value = exam.id;
                option.textContent = exam.title;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading exams for select:', error);
        }
    }

    async createQuestion() {
        const formData = new FormData();
        formData.append('text', document.getElementById('question-text').value);
        formData.append('correct_answer', document.querySelector('input[name="correct-answer"]:checked')?.value || '');
        formData.append('points', document.getElementById('question-points').value || '1');
        formData.append('exam_id', this.currentExamId);

        const options = [];
        document.querySelectorAll('.option-text').forEach(input => {
            if (input.value.trim()) {
                options.push(input.value.trim());
            }
        });
        formData.append('options', JSON.stringify(options));

        if (!formData.get('text') || !formData.get('correct_answer') || options.length < 2) {
            this.showMessage('Please fill in all required fields and add at least 2 options.', 'error');
            return;
        }

        try {
            const response = await fetch('/api/create_question', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                this.showMessage('Question created successfully!', 'success');
                document.getElementById('question-form').reset();
                this.resetOptions();
                this.loadExamQuestions(this.currentExamId);
            } else {
                const error = await response.json();
                this.showMessage(`Error: ${error.detail}`, 'error');
            }
        } catch (error) {
            this.showMessage(`Error: ${error.message}`, 'error');
        }
    }

    // Add bulk question creation method
    async createBulkQuestions() {
        const bulkText = document.getElementById('bulk-questions-text').value.trim();
        if (!bulkText) {
            this.showMessage('Please enter questions in the bulk format.', 'error');
            return;
        }

        const questions = this.parseBulkQuestions(bulkText);
        console.log('Parsed questions:', questions); // Debug log
        
        if (questions.length === 0) {
            this.showMessage('No valid questions found in the bulk format.', 'error');
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const question of questions) {
            try {
                const formData = new FormData();
                formData.append('text', question.text);
                formData.append('correct_answer', question.correct_answer);
                formData.append('points', question.points || '1');
                formData.append('exam_id', this.currentExamId);
                formData.append('options', JSON.stringify(question.options));

                const response = await fetch('/api/create_question', {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    successCount++;
                } else {
                    errorCount++;
                }
            } catch (error) {
                errorCount++;
            }
        }

        if (successCount > 0) {
            this.showMessage(`✅ Successfully created ${successCount} questions${errorCount > 0 ? `, ${errorCount} failed` : ''}!`, 'success');
            document.getElementById('bulk-questions-text').value = '';
            this.loadExamQuestions(this.currentExamId);
        } else {
            this.showMessage(`❌ Failed to create any questions. ${errorCount} errors occurred.`, 'error');
        }
    }

                    // Parse bulk questions from text format - ULTRA SIMPLIFIED VERSION
                parseBulkQuestions(text) {
                    const questions = [];
                    const questionBlocks = text.split('---').filter(block => block.trim());

                    for (const block of questionBlocks) {
                        const lines = block.trim().split('\n').filter(line => line.trim());
                        if (lines.length < 3) continue; // Need at least question + 2 options

                        const question = {
                            text: '',
                            options: [],
                            correct_answer: '',
                            points: 1
                        };

                        // First line is the question
                        question.text = lines[0].trim();

                        // Next lines are options (2-4 options)
                        for (let i = 1; i < lines.length && i <= 4; i++) {
                            const line = lines[i].trim();
                            if (line) {
                                question.options.push(line);
                            }
                        }

                        // If we have at least 2 options, add the question
                        if (question.options.length >= 2) {
                            // Set the first option as correct by default
                            question.correct_answer = question.options[0];
                            questions.push(question);
                        }
                    }

                    console.log('Parsed questions:', questions);
                    return questions;
                }

    addOption() {
        const optionsContainer = document.getElementById('options-container');
        const optionCount = optionsContainer.children.length;
        
        const optionRow = document.createElement('div');
        optionRow.className = 'option-row';
        optionRow.innerHTML = `
            <input type="radio" name="correct-answer" value="${optionCount}" required>
            <input type="text" class="option-text" placeholder="Option ${String.fromCharCode(65 + optionCount)}" required>
            <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        optionsContainer.appendChild(optionRow);
    }

    resetOptions() {
        const optionsContainer = document.getElementById('options-container');
        optionsContainer.innerHTML = `
            <div class="option-row">
                <input type="radio" name="correct-answer" value="0" required>
                <input type="text" class="option-text" placeholder="Option A" required>
            </div>
            <div class="option-row">
                <input type="radio" name="correct-answer" value="1" required>
                <input type="text" class="option-text" placeholder="Option B" required>
            </div>
            <div class="option-row">
                <input type="radio" name="correct-answer" value="2" required>
                <input type="text" class="option-text" placeholder="Option C" required>
            </div>
            <div class="option-row">
                <input type="radio" name="correct-answer" value="3" required>
                <input type="text" class="option-text" placeholder="Option D" required>
            </div>
        `;
    }

    async loadExamQuestions(examId) {
        const container = document.getElementById('questions-list');
        if (!examId) {
            container.innerHTML = '<p class="message info">Please select an exam to view questions</p>';
            this.questionsCache = [];
            return;
        }
        // debounce concurrent loads
        if (this.isLoadingQuestions) return;
        this.isLoadingQuestions = true;
        container.innerHTML = '<p class="message info">Loading questions...</p>';
        try {
            const response = await fetch(`/api/exam/${examId}/questions`);
            const questions = await response.json();
            this.questionsCache = Array.isArray(questions) ? questions : [];
            // Render on next animation frame to avoid flicker
            requestAnimationFrame(() => this.renderQuestions(this.questionsCache));
        } catch (error) {
            console.error('Error loading exam questions:', error);
            container.innerHTML = '<p class="message error">Error loading questions</p>';
        } finally {
            this.isLoadingQuestions = false;
        }
    }

    renderQuestions(questions) {
        const container = document.getElementById('questions-list');
        const frag = document.createDocumentFragment();
        if (!questions || questions.length === 0) {
            container.innerHTML = '<p class="message info">No questions in this exam yet</p>';
            return;
        }
        container.innerHTML = '';
        questions.forEach((question, index) => {
            const questionElement = this.createQuestionElement(question, index + 1);
            frag.appendChild(questionElement);
        });
        container.appendChild(frag);
    }

    createQuestionElement(question, number) {
        const div = document.createElement('div');
        div.className = 'question-item';
        const options = Array.isArray(question.options) ? question.options : (JSON.parse(question.options || '[]'));
        const optionsList = options.map((option, idx) => {
            const isCorrect = option === question.correct_answer;
            return `
                <div class="option-item ${isCorrect ? 'correct' : ''}">
                    <span class="option-label">${String.fromCharCode(65 + idx)}</span>
                    <span class="option-text">${option}</span>
                    ${isCorrect ? '<i class="fas fa-check"></i>' : ''}
                </div>
            `;
        }).join('');
        div.innerHTML = `
            <div class="question-header">
                <span class="question-number">#${question.order_index || number}</span>
                <span class="question-points">${question.points} pts</span>
            </div>
            <div class="question-text">${question.text}</div>
            <div class="options-list">${optionsList}</div>
            <div class="question-actions">
                <button class="btn btn-sm btn-secondary" onclick="hostDashboard.openEditQuestion(${question.id})"><i class="fas fa-edit"></i> Edit</button>
                <button class="btn btn-sm btn-danger" onclick="hostDashboard.deleteQuestion(${question.id})"><i class="fas fa-trash"></i> Delete</button>
                <button class="btn btn-sm btn-info" onclick="hostDashboard.moveQuestion(${question.id}, 'up')" title="Move Up"><i class="fas fa-arrow-up"></i></button>
                <button class="btn btn-sm btn-info" onclick="hostDashboard.moveQuestion(${question.id}, 'down')" title="Move Down"><i class="fas fa-arrow-down"></i></button>
            </div>
        `;
        return div;
    }

    async deleteQuestion(questionId) {
        if (!confirm('Are you sure you want to delete this question?')) {
            return;
        }

        try {
            const response = await fetch(`/api/question/${questionId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.showMessage('Question deleted successfully!', 'success');
                // remove locally to prevent flicker
                this.questionsCache = this.questionsCache.filter(q => q.id !== questionId);
                this.renderQuestions(this.questionsCache);
            } else {
                const result = await response.json();
                this.showMessage(result.detail || 'Failed to delete question', 'error');
            }
        } catch (error) {
            this.showMessage('Error deleting question: ' + error.message, 'error');
        }
    }

    openEditQuestion = async (questionId) => {
        try {
            const res = await fetch(`/get_question/${questionId}`);
            const q = await res.json();
            const options = Array.isArray(q.options) ? q.options : (JSON.parse(q.options || '[]'));
            const html = `
                <div>
                    <h3>Edit Question</h3>
                    <label>Text</label>
                    <textarea id="edit-q-text" style="width:100%;min-height:80px;">${q.text || ''}</textarea>
                    <label>Options</label>
                    ${options.map((opt,i)=>`<div style='display:flex;gap:8px;align-items:center;margin:6px 0;'><span>${String.fromCharCode(65+i)}.</span><input id='edit-opt-${i}' value='${opt}' style='flex:1;padding:6px;border:1px solid var(--border);background:#0b1220;color:var(--text);border-radius:6px;'><input type='radio' name='edit-correct' ${opt===q.correct_answer?"checked":""} value='${i}'></div>`).join('')}
                    <label>Points</label>
                    <input id="edit-q-points" type="number" value="${q.points || 1}" style="width:120px;padding:6px;border:1px solid var(--border);background:#0b1220;color:var(--text);border-radius:6px;" />
                    <div style="margin-top:12px;display:flex;gap:8px;">
                        <button class="btn btn-primary" onclick="hostDashboard.saveQuestionEdit(${q.id})">Save</button>
                        <button class="btn btn-secondary" onclick="document.getElementById('host-modal').remove()">Cancel</button>
                    </div>
                </div>`;
            this.showModal(html);
        } catch (e) {
            this.showMessage('Failed to open editor', 'error');
        }
    }

    saveQuestionEdit = async (questionId) => {
        try {
            const text = document.getElementById('edit-q-text').value.trim();
            const points = parseInt(document.getElementById('edit-q-points').value) || 1;
            const optionInputs = Array.from(document.querySelectorAll('[id^=edit-opt-]'));
            const options = optionInputs.map(i => i.value.trim()).filter(Boolean);
            const correctIdxInput = document.querySelector('input[name="edit-correct"]:checked');
            if (!text || options.length < 2 || !correctIdxInput) {
                this.showMessage('Provide text, at least 2 options, and select correct answer', 'error');
                return;
            }
            const correct_answer = options[parseInt(correctIdxInput.value)];
            const res = await fetch(`/api/question/${questionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, options, correct_answer, points })
            });
            if (res.ok) {
                this.showMessage('Question updated', 'success');
                const modal = document.getElementById('host-modal');
                if (modal) modal.remove();
                // update cache & UI without refetch
                this.questionsCache = this.questionsCache.map(q => q.id === questionId ? { ...q, text, options, correct_answer, points } : q);
                this.renderQuestions(this.questionsCache);
            } else {
                const out = await res.json();
                this.showMessage(out.detail || 'Failed to update', 'error');
            }
        } catch (e) {
            this.showMessage('Error updating question: ' + e.message, 'error');
        }
    }

    moveQuestion = async (questionId, dir) => {
        console.log(`Moving question ${questionId} ${dir}`); // Debug log
        
        const examId = this.currentExamId || document.getElementById('selected-exam').value;
        if (!examId) {
            console.error('No exam ID found');
            this.showMessage('Please select an exam first', 'error');
            return;
        }
        
        if (!this.questionsCache || this.questionsCache.length === 0) {
            console.error('No questions cache found');
            return;
        }
        
        // local reorder for instant feedback
        const order = this.questionsCache.map(q => q.id);
        const idx = order.indexOf(questionId);
        if (idx === -1) {
            console.error(`Question ${questionId} not found in cache`);
            return;
        }
        
        const newOrder = order.slice();
        let moved = false;
        
        if (dir === 'up' && idx > 0) {
            [newOrder[idx-1], newOrder[idx]] = [newOrder[idx], newOrder[idx-1]];
            moved = true;
        } else if (dir === 'down' && idx < newOrder.length - 1) {
            [newOrder[idx+1], newOrder[idx]] = [newOrder[idx], newOrder[idx+1]];
            moved = true;
        } else {
            console.log(`Cannot move ${dir} - already at ${dir === 'up' ? 'top' : 'bottom'}`);
            return;
        }
        
        if (moved) {
            // apply locally for instant feedback
            const idToQuestion = new Map(this.questionsCache.map(q => [q.id, q]));
            this.questionsCache = newOrder.map((id, i) => ({ ...idToQuestion.get(id), order_index: i + 1 }));
            this.renderQuestions(this.questionsCache);
            
            // sync to server
            try {
                console.log('Sending reorder request to server...');
                const r = await fetch(`/api/exam/${examId}/reorder`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order: newOrder })
                });
                
                if (!r.ok) {
                    const errorText = await r.text();
                    console.error('Reorder failed:', errorText);
                    throw new Error(`Reorder failed: ${errorText}`);
                }
                
                console.log('Reorder successful');
                this.showMessage(`Question moved ${dir} successfully!`, 'success');
            } catch (err) {
                console.error('Reorder error:', err);
                this.showMessage(`Failed to persist order: ${err.message}`, 'error');
                // Reload to get correct state
                this.loadExamQuestions(examId);
            }
        }
    }

    async loadActiveExams() {
        try {
            const response = await fetch('/api/active_exams');
            this.exams = await response.json();
            this.renderActiveExams();
        } catch (error) {
            console.error('Error loading active exams:', error);
        }
    }

    async loadAllExamAttempts() {
        try {
            const response = await fetch('/get_all_exam_attempts');
            const attempts = await response.json();
            this.renderExamHistory(attempts);
        } catch (error) {
            console.error('Error loading exam attempts:', error);
        }
    }

    renderExamHistory(attempts) {
        const historyContainer = document.getElementById('exam-history');
        
        if (attempts.length === 0) {
            historyContainer.innerHTML = '<p>No exam attempts found.</p>';
            return;
        }
        
        const attemptsHtml = attempts.map(attempt => {
            const startTime = new Date(attempt.start_time).toLocaleString();
            const endTime = attempt.end_time ? new Date(attempt.end_time).toLocaleString() : 'In Progress';
            const duration = attempt.duration_seconds ? 
                `${Math.floor(attempt.duration_seconds / 60)}m ${attempt.duration_seconds % 60}s` : 'N/A';
            const avgTime = attempt.average_time_per_question_seconds ? 
                `${Math.floor(attempt.average_time_per_question_seconds / 60)}m ${Math.floor(attempt.average_time_per_question_seconds % 60)}s` : 'N/A';
            
            return `
                <div class="exam-attempt-card">
                    <div class="attempt-header">
                        <h3>Attempt #${attempt.id}</h3>
                        <span class="attempt-score">Score: ${attempt.score || 0}/${attempt.answered_questions?.length || 0}</span>
                    </div>
                    <div class="attempt-details">
                        <p><strong>User ID:</strong> ${attempt.user_id}</p>
                        <p><strong>Start Time:</strong> ${startTime}</p>
                        <p><strong>End Time:</strong> ${endTime}</p>
                        <p><strong>Duration:</strong> ${duration}</p>
                        <p><strong>Avg Time per Question:</strong> ${avgTime}</p>
                        <p><strong>Violations:</strong> ${attempt.alt_tab_count || 0}</p>
                    </div>
                    <div class="attempt-actions">
                        <button onclick="hostDashboard.viewExamAnalysis(${attempt.id})" class="btn btn-primary">
                            <i class="fas fa-chart-line"></i> View Analysis
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        historyContainer.innerHTML = `
            <div class="exam-history-header">
                <h3>All Exam Attempts (${attempts.length})</h3>
                <button onclick="hostDashboard.loadAllExamAttempts()" class="btn btn-secondary">
                    <i class="fas fa-refresh"></i> Refresh
                </button>
            </div>
            <div class="exam-attempts-grid">
                ${attemptsHtml}
            </div>
        `;
    }

    viewExamAnalysis(attemptId) {
        window.open(`/exam_analysis.html?attempt_id=${attemptId}`, '_blank');
    }

    renderActiveExams() {
        const container = document.getElementById('active-exams');
        container.innerHTML = '';

        if (this.exams.length === 0) {
            container.innerHTML = '<p class="message info">No active exams</p>';
            return;
        }

        this.exams.forEach(exam => {
            const examElement = this.createExamElement(exam);
            container.appendChild(examElement);
        });
    }

    createExamElement(exam) {
        const div = document.createElement('div');
        div.className = `exam-item ${exam.status}`;
        
        const startDateTime = new Date(exam.start_date + 'T' + exam.start_time);
        const isActive = startDateTime <= new Date() && exam.status === 'active';
        
        div.innerHTML = `
            <h3>${exam.title}</h3>
            <div class="exam-meta">
                <span><i class="fas fa-clock"></i> ${exam.duration} min</span>
                <span><i class="fas fa-question-circle"></i> ${exam.question_count} questions</span>
                <span><i class="fas fa-calendar"></i> ${this.formatDateTime(startDateTime)}</span>
            </div>
            <div class="exam-actions">
                ${isActive ? 
                    `<button class="btn btn-success" onclick="hostDashboard.viewExam('${exam.id}')">
                        <i class="fas fa-eye"></i> View
                    </button>` :
                    `<button class="btn btn-secondary" onclick="hostDashboard.editExam('${exam.id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>`
                }
                <button class="btn btn-danger" onclick="hostDashboard.deleteExam('${exam.id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
                <button class="btn btn-info" onclick="hostDashboard.viewExamAttempts('${exam.id}')">
                    <i class="fas fa-history"></i> View Attempts
                </button>
            </div>
        `;
        
        return div;
    }

    async viewExam(examId) {
        try {
            const response = await fetch(`/api/exam/${examId}`);
            const exam = await response.json();
            
            this.showExamDetails(exam);
        } catch (error) {
            this.showMessage('Error loading exam details', 'error');
        }
    }

    showExamDetails(exam) {
        const modal = document.getElementById('exam-details-modal');
        const content = document.getElementById('exam-details-content');
        
        content.innerHTML = `
            <div class="exam-details">
                <h3>${exam.title}</h3>
                <p><strong>Description:</strong> ${exam.description}</p>
                <p><strong>Duration:</strong> ${exam.duration} minutes</p>
                <p><strong>Questions:</strong> ${exam.question_count}</p>
                <p><strong>Start Time:</strong> ${this.formatDateTime(new Date(exam.start_date + 'T' + exam.start_time))}</p>
                <p><strong>Status:</strong> <span class="status-${exam.status}">${exam.status}</span></p>
                
                <div class="exam-stats">
                    <h4>Statistics</h4>
                    <div class="stats-grid">
                        <div class="stat">
                            <span class="stat-number">${exam.participant_count || 0}</span>
                            <span class="stat-label">Participants</span>
                        </div>
                        <div class="stat">
                            <span class="stat-number">${exam.violation_count || 0}</span>
                            <span class="stat-label">Violations</span>
                        </div>
                        <div class="stat">
                            <span class="stat-number">${exam.completion_rate || 0}%</span>
                            <span class="stat-label">Completion Rate</span>
                        </div>
                    </div>
                </div>
                
                <div class="exam-actions">
                    <button class="btn btn-primary" onclick="hostDashboard.startExam('${exam.id}')">
                        <i class="fas fa-play"></i> Start Exam
                    </button>
                    <button class="btn btn-secondary" onclick="hostDashboard.exportResults('${exam.id}')">
                        <i class="fas fa-download"></i> Export Results
                    </button>
                </div>
            </div>
        `;
        
        modal.style.display = 'block';
    }

    closeModal() {
        document.getElementById('exam-details-modal').style.display = 'none';
    }

    async startExam(examId) {
        try {
            const response = await fetch(`/api/exam/${examId}/start`, {
                method: 'POST'
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showMessage('Exam started successfully!', 'success');
                this.closeModal();
                this.loadActiveExams();
            } else {
                this.showMessage(result.error || 'Failed to start exam', 'error');
            }
        } catch (error) {
            this.showMessage('Error starting exam: ' + error.message, 'error');
        }
    }

    async exportResults(examId) {
        try {
            const response = await fetch(`/api/exam/${examId}/export`);
            const blob = await response.blob();
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `exam_results_${examId}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            this.showMessage('Results exported successfully!', 'success');
        } catch (error) {
            this.showMessage('Error exporting results: ' + error.message, 'error');
        }
    }

    async deleteExam(examId) {
        if (!confirm('Are you sure you want to delete this exam? This action cannot be undone.')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/exam/${examId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                this.showMessage('Exam deleted successfully!', 'success');
                this.loadActiveExams(); // Refresh the exam list
            } else {
                const error = await response.json();
                this.showMessage('Error deleting exam: ' + error.detail, 'error');
            }
        } catch (error) {
            this.showMessage('Error deleting exam: ' + error.message, 'error');
        }
    }

    async viewExamAttempts(examId) {
        try {
            const response = await fetch(`/api/exam/${examId}/attempts`);
            const attempts = await response.json();
            const attemptsContainer = document.getElementById('exam-attempts-container');
            attemptsContainer.innerHTML = '';
            if (!attempts.length) {
                attemptsContainer.innerHTML = '<div>No attempts for this exam yet.</div>';
                return;
            }
            attempts.forEach(attempt => {
                const div = document.createElement('div');
                div.className = 'exam-attempt-card';
                div.innerHTML = `
                    <div class="attempt-header">
                        <span><b>${attempt.username || 'Unknown User'}</b> (${attempt.email || ''})</span>
                        <span>Score: ${attempt.score} / ${attempt.total_questions}</span>
                    </div>
                    <div>Start: ${attempt.start_time ? new Date(attempt.start_time).toLocaleString() : 'N/A'}</div>
                    <div>End: ${attempt.end_time ? new Date(attempt.end_time).toLocaleString() : 'N/A'}</div>
                    <button class="btn btn-sm btn-primary" onclick="window.location.href='/exam_analysis.html?attempt_id=${attempt.id}'">View Details</button>
                `;
                attemptsContainer.appendChild(div);
            });
        } catch (error) {
            const attemptsContainer = document.getElementById('exam-attempts-container');
            attemptsContainer.innerHTML = '<div>Error loading attempts.</div>';
        }
    }

    // Helper to show a modal (simple implementation)
    showModal(html) {
        let modal = document.getElementById('host-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'host-modal';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100vw';
            modal.style.height = '100vh';
            modal.style.background = 'rgba(0,0,0,0.5)';
            modal.style.zIndex = '9999';
            modal.style.display = 'flex';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            modal.innerHTML = `<div id="host-modal-content" style="background:#fff;padding:32px 24px;border-radius:12px;max-width:90vw;max-height:80vh;overflow:auto;position:relative;"></div>`;
            document.body.appendChild(modal);
            modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
        }
        document.getElementById('host-modal-content').innerHTML = html + '<br><button class="btn btn-danger" onclick="document.getElementById(\'host-modal\').remove()">Close</button>';
        modal.style.display = 'flex';
    }

    async viewAttemptDetails(attemptId) {
        try {
            const response = await fetch(`/get_exam_analysis/${attemptId}`);
            const analysis = await response.json();
            
            // Create a modal to display detailed analysis
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'block';
            
            let questionsHtml = '';
            if (analysis.detailed_questions && analysis.detailed_questions.length > 0) {
                questionsHtml = analysis.detailed_questions.map((q, idx) => `
                    <div class="question-analysis">
                        <h4>Question ${idx + 1}</h4>
                        <p><strong>Question:</strong> ${q.question_text}</p>
                        <p><strong>Options:</strong></p>
                        <ul>
                            ${q.options.map((opt, i) => `
                                <li class="${opt === q.correct_answer ? 'correct' : ''} ${opt === q.user_answer ? 'selected' : ''}">
                                    ${String.fromCharCode(65 + i)}. ${opt}
                                    ${opt === q.correct_answer ? ' ✓' : ''}
                                    ${opt === q.user_answer && opt !== q.correct_answer ? ' ✗' : ''}
                                </li>
                            `).join('')}
                        </ul>
                        <p><strong>User Answer:</strong> ${q.user_answer || 'Not answered'}</p>
                        <p><strong>Correct Answer:</strong> ${q.correct_answer}</p>
                        <p><strong>Time Taken:</strong> ${q.time_taken_seconds ? Math.round(q.time_taken_seconds) + ' seconds' : 'N/A'}</p>
                    </div>
                `).join('');
            }
            
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 800px; max-height: 80vh; overflow-y: auto;">
                    <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
                    <h2>Detailed Analysis - ${analysis.username}</h2>
                    <div class="analysis-summary">
                        <p><strong>Score:</strong> ${analysis.score}/${analysis.total_questions} (${Math.round(analysis.score/analysis.total_questions*100)}%)</p>
                        <p><strong>Violations:</strong> ${analysis.violations}</p>
                        <p><strong>Average Time:</strong> ${analysis.average_time_per_question_seconds ? Math.round(analysis.average_time_per_question_seconds) + ' seconds' : 'N/A'}</p>
                        <p><strong>Start Time:</strong> ${new Date(analysis.start_time).toLocaleString()}</p>
                        <p><strong>End Time:</strong> ${new Date(analysis.end_time).toLocaleString()}</p>
                    </div>
                    <div class="questions-analysis">
                        <h3>Question Breakdown</h3>
                        ${questionsHtml}
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
        } catch (error) {
            this.showMessage('Error loading attempt details: ' + error.message, 'error');
        }
    }

    startRealTimeUpdates() {
        // Update stats every 5 seconds
        setInterval(() => {
            this.updateStats();
        }, 5000);

        // Update participants every 10 seconds
        setInterval(() => {
            this.updateParticipants();
        }, 10000);

        // Update violations every 3 seconds
        setInterval(() => {
            this.updateViolations();
        }, 3000);
    }

    async updateStats() {
        try {
            const response = await fetch('/api/stats');
            const stats = await response.json();
            
            this.stats = stats;
            this.renderStats();
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }

    renderStats() {
        document.getElementById('total-participants').textContent = this.stats.totalParticipants;
        document.getElementById('active-participants').textContent = this.stats.activeParticipants;
        document.getElementById('total-violations').textContent = this.stats.totalViolations;
    }

    async updateParticipants() {
        try {
            const response = await fetch('/api/participants');
            const participants = await response.json();
            
            this.participants = participants;
            this.renderParticipants();
        } catch (error) {
            console.error('Error updating participants:', error);
        }
    }

    renderParticipants() {
        const container = document.getElementById('participants-list');
        container.innerHTML = '';

        if (this.participants.length === 0) {
            container.innerHTML = '<p class="message info">No active participants</p>';
            return;
        }

        this.participants.forEach(participant => {
            const div = document.createElement('div');
            div.className = 'participant-item';
            
            div.innerHTML = `
                <div class="participant-info">
                    <div class="participant-status ${participant.status}"></div>
                    <span>${participant.name}</span>
                </div>
                <div class="participant-details">
                    <span class="exam-name">${participant.exam_title}</span>
                    <span class="progress">${participant.progress}%</span>
                </div>
            `;
            
            container.appendChild(div);
        });
    }

    async updateViolations() {
        try {
            const response = await fetch('/api/recent_violations');
            const violations = await response.json();
            
            this.violations = violations;
            this.renderViolations();
        } catch (error) {
            console.error('Error updating violations:', error);
        }
    }

    renderViolations() {
        const container = document.getElementById('violations-list');
        container.innerHTML = '';

        if (this.violations.length === 0) {
            container.innerHTML = '<p class="message info">No recent violations</p>';
            return;
        }

        this.violations.forEach(violation => {
            const div = document.createElement('div');
            div.className = 'violation-item';
            
            div.innerHTML = `
                <div class="violation-time">${this.formatDateTime(new Date(violation.timestamp))}</div>
                <div class="violation-details">
                    <strong>${violation.participant_name}</strong> - ${violation.reason}
                </div>
            `;
            
            container.appendChild(div);
        });
    }

    updateConnectionStatus() {
        const statusElement = document.getElementById('connection-status');
        
        // Simulate connection status (in real app, check actual connection)
        const isConnected = navigator.onLine;
        
        if (isConnected) {
            statusElement.innerHTML = '<i class="fas fa-circle"></i> Connected';
            statusElement.className = 'status-indicator';
        } else {
            statusElement.innerHTML = '<i class="fas fa-circle"></i> Disconnected';
            statusElement.className = 'status-indicator disconnected';
        }
    }

    showMessage(message, type = 'info') {
        // Create message element
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;
        
        // Add to page
        document.body.appendChild(messageDiv);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 5000);
    }

    formatDateTime(date) {
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// Initialize host dashboard
const hostDashboard = new HostDashboard();

// Listen for online/offline events
window.addEventListener('online', () => {
    hostDashboard.updateConnectionStatus();
});

window.addEventListener('offline', () => {
    hostDashboard.updateConnectionStatus();
}); 

// AI Assistant Modal Logic
const aiAssistantBtn = document.getElementById('ai-assistant-btn');
const aiModal = document.getElementById('ai-assistant-modal');
const closeAiModal = document.getElementById('close-ai-modal');
const aiPrompt = document.getElementById('ai-prompt');
const aiNumQuestions = document.getElementById('ai-num-questions');
const aiGenerateBtn = document.getElementById('ai-generate-btn');
const aiLoading = document.getElementById('ai-loading');
const aiError = document.getElementById('ai-error');
const aiQuestionsPreview = document.getElementById('ai-questions-preview');

if (aiAssistantBtn) {
    aiAssistantBtn.onclick = () => {
        aiModal.style.display = 'block';
        aiPrompt.value = '';
        aiNumQuestions.value = 3;
        aiQuestionsPreview.innerHTML = '';
        aiError.textContent = '';
    };
}
if (closeAiModal) {
    closeAiModal.onclick = () => {
        aiModal.style.display = 'none';
    };
}
window.onclick = function(event) {
    if (event.target === aiModal) {
        aiModal.style.display = 'none';
    }
};

// Enhance AI Assistant to use unique endpoint and pass exam context
if (aiGenerateBtn) {
    aiGenerateBtn.onclick = async (e) => {
        e.preventDefault();
        aiLoading.style.display = 'block';
        aiError.textContent = '';
        aiQuestionsPreview.innerHTML = '';
        try {
            const prompt = aiPrompt.value.trim();
            const numQuestions = parseInt(aiNumQuestions.value);
            const examId = document.getElementById('selected-exam').value || null;
            if (!prompt) {
                aiError.textContent = 'Please enter a topic or material.';
                aiLoading.style.display = 'none';
                return;
            }
            const response = await fetch('/api/ai_generate_questions_unique', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, num_questions: numQuestions, exam_id: examId })
            });
            const result = await response.json();
            aiLoading.style.display = 'none';
            if (result.questions && Array.isArray(result.questions)) {
                aiQuestionsPreview.innerHTML = result.questions.map((q, idx) => `
                    <div class="ai-question-preview">
                        <b>Q${idx+1}:</b> ${q.question}<br>
                        <ul>${q.options.map((opt, i) => `<li${opt===q.correct_answer?" style=\"font-weight:bold;color:green;\"":''}>${String.fromCharCode(65+i)}. ${opt}</li>`).join('')}</ul>
                        <button class="btn btn-sm btn-success" onclick="addAiQuestionToForm(${idx})">Add to Form</button>
                    </div>
                `).join('');
                window.aiGeneratedQuestions = result.questions;
            } else {
                aiError.textContent = result.error || 'Failed to generate questions.';
            }
        } catch (err) {
            aiLoading.style.display = 'none';
            aiError.textContent = 'Error: ' + err.message;
        }
    };
}

// Add generated question to form
window.addAiQuestionToForm = function(idx) {
    const q = window.aiGeneratedQuestions[idx];
    if (!q) return;
    document.getElementById('question-text').value = q.question;
    const optionInputs = document.querySelectorAll('.option-text');
    q.options.forEach((opt, i) => {
        if (optionInputs[i]) optionInputs[i].value = opt;
    });
    // Set correct answer radio
    const radios = document.querySelectorAll('input[name="correct-answer"]');
    q.options.forEach((opt, i) => {
        if (opt === q.correct_answer && radios[i]) radios[i].checked = true;
    });
    aiModal.style.display = 'none';
}; 