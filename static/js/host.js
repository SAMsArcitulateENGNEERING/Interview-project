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
        this.startRealTimeUpdates();
        this.updateConnectionStatus();
    }

    setupEventListeners() {
        // Exam form submission
        document.getElementById('exam-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createExam();
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
            } else {
                this.showMessage(result.error || 'Failed to create exam', 'error');
            }
        } catch (error) {
            this.showMessage('Error creating exam: ' + error.message, 'error');
        }
    }

    async loadActiveExams() {
        try {
            const response = await fetch('/api/active_exams');
            const exams = await response.json();
            
            this.exams = exams;
            this.renderActiveExams();
        } catch (error) {
            console.error('Error loading active exams:', error);
        }
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