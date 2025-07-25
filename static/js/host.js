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

        // Add option button
        document.getElementById('add-option').addEventListener('click', () => {
            this.addOption();
        });

        // Selected exam change
        document.getElementById('selected-exam').addEventListener('change', (e) => {
            this.loadExamQuestions(e.target.value);
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
        const questionText = document.getElementById('question-text').value;
        const points = parseInt(document.getElementById('question-points').value);
        const examId = document.getElementById('selected-exam').value;
        
        // Get options
        const optionInputs = document.querySelectorAll('.option-text');
        const options = Array.from(optionInputs).map(input => input.value).filter(value => value.trim() !== '');
        
        // Get correct answer
        const correctAnswerRadio = document.querySelector('input[name="correct-answer"]:checked');
        if (!correctAnswerRadio) {
            this.showMessage('Please select a correct answer', 'error');
            return;
        }
        
        const correctAnswerIndex = parseInt(correctAnswerRadio.value);
        const correctAnswer = options[correctAnswerIndex];
        
        if (options.length < 2) {
            this.showMessage('Please provide at least 2 options', 'error');
            return;
        }
        
        if (!correctAnswer) {
            this.showMessage('Please provide a correct answer', 'error');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('text', questionText);
            formData.append('options', JSON.stringify(options));
            formData.append('correct_answer', correctAnswer);
            formData.append('points', points);
            if (examId) {
                formData.append('exam_id', examId);
            }

            const response = await fetch('/api/create_question', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                this.showMessage('Question created successfully!', 'success');
                document.getElementById('question-form').reset();
                this.resetOptions();
                if (examId) {
                    this.loadExamQuestions(examId);
                }
            } else {
                this.showMessage(result.detail || 'Failed to create question', 'error');
            }
        } catch (error) {
            this.showMessage('Error creating question: ' + error.message, 'error');
        }
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
        if (!examId) {
            document.getElementById('questions-list').innerHTML = '<p class="message info">Please select an exam to view questions</p>';
            return;
        }

        try {
            const response = await fetch(`/api/exam/${examId}/questions`);
            const questions = await response.json();
            
            this.renderQuestions(questions);
        } catch (error) {
            console.error('Error loading exam questions:', error);
            document.getElementById('questions-list').innerHTML = '<p class="message error">Error loading questions</p>';
        }
    }

    renderQuestions(questions) {
        const container = document.getElementById('questions-list');
        container.innerHTML = '';

        if (questions.length === 0) {
            container.innerHTML = '<p class="message info">No questions in this exam yet</p>';
            return;
        }

        questions.forEach((question, index) => {
            const questionElement = this.createQuestionElement(question, index + 1);
            container.appendChild(questionElement);
        });
    }

    createQuestionElement(question, number) {
        const div = document.createElement('div');
        div.className = 'question-item';
        
        const optionsList = question.options.map((option, index) => {
            const isCorrect = option === question.correct_answer;
            return `
                <div class="option-item ${isCorrect ? 'correct' : ''}">
                    <span class="option-label">${String.fromCharCode(65 + index)}</span>
                    <span class="option-text">${option}</span>
                    ${isCorrect ? '<i class="fas fa-check"></i>' : ''}
                </div>
            `;
        }).join('');

        div.innerHTML = `
            <div class="question-header">
                <span class="question-number">Question ${number}</span>
                <span class="question-points">${question.points} pts</span>
            </div>
            <div class="question-text">${question.text}</div>
            <div class="options-list">
                ${optionsList}
            </div>
            <div class="question-actions">
                <button class="btn btn-sm btn-secondary" onclick="hostDashboard.editQuestion(${question.id})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-sm btn-danger" onclick="hostDashboard.deleteQuestion(${question.id})">
                    <i class="fas fa-trash"></i> Delete
                </button>
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
                const examId = document.getElementById('selected-exam').value;
                if (examId) {
                    this.loadExamQuestions(examId);
                }
            } else {
                const result = await response.json();
                this.showMessage(result.detail || 'Failed to delete question', 'error');
            }
        } catch (error) {
            this.showMessage('Error deleting question: ' + error.message, 'error');
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

if (aiGenerateBtn) {
    aiGenerateBtn.onclick = async (e) => {
        e.preventDefault();
        aiLoading.style.display = 'block';
        aiError.textContent = '';
        aiQuestionsPreview.innerHTML = '';
        try {
            const prompt = aiPrompt.value.trim();
            const numQuestions = parseInt(aiNumQuestions.value);
            if (!prompt) {
                aiError.textContent = 'Please enter a topic or material.';
                aiLoading.style.display = 'none';
                return;
            }
            const response = await fetch('/api/ai_generate_questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, num_questions: numQuestions })
            });
            const result = await response.json();
            aiLoading.style.display = 'none';
            if (result.questions && Array.isArray(result.questions)) {
                aiQuestionsPreview.innerHTML = result.questions.map((q, idx) => `
                    <div class="ai-question-preview">
                        <b>Q${idx+1}:</b> ${q.question}<br>
                        <ul>${q.options.map((opt, i) => `<li${opt===q.correct_answer?" style=\"font-weight:bold;color:green;\"":""}>${String.fromCharCode(65+i)}. ${opt}</li>`).join('')}</ul>
                        <button class="btn btn-sm btn-success" onclick="addAiQuestionToForm(${idx})">Add to Form</button>
                    </div>
                `).join('');
                // Store questions in window for access
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