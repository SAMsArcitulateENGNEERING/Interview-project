// Simple Exam System - Rebuilt from scratch
let currentQuestionIndex = 0;
let questions = [];
let examAttemptId = null;
let isExamActive = true;
let timerInterval = null;
let examId = null;
let examDurationSeconds = 3600;

// DOM elements
const timerDisplay = document.getElementById('timer');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const nextButton = document.getElementById('next-question');
const prevButton = document.getElementById('prev-question');
const altTabCounter = document.getElementById('alt-tab-counter');
const questionCounterEl = document.getElementById('question-counter');
const progressFillEl = document.getElementById('progress-fill');
const progressPctEl = document.getElementById('progress-percentage');

// Simple violation tracking
let violationCount = 0;

// Initialize exam when page loads
document.addEventListener('DOMContentLoaded', async () => {
    await initializeExam();
});

async function initializeExam() {
    try {
        // Get exam attempt ID from URL parameters or localStorage
        const urlParams = new URLSearchParams(window.location.search);
        const attemptId = urlParams.get('attempt_id') || localStorage.getItem('exam_attempt_id');
        const urlExamId = urlParams.get('exam_id');
        
        if (attemptId) {
            examAttemptId = parseInt(attemptId);
            localStorage.setItem('exam_attempt_id', examAttemptId);
        } else {
            alert('No exam attempt found. Please start the exam from the beginning.');
            window.location.href = '/start.html';
            return;
        }

        // Fetch exam_id either from URL or by looking up the attempt
        if (urlExamId) {
            examId = parseInt(urlExamId);
        } else {
            const attemptRes = await fetch(`/get_exam_result/${examAttemptId}`);
            if (!attemptRes.ok) throw new Error('Failed to get attempt');
            const attempt = await attemptRes.json();
            examId = attempt.exam_session_id;
        }
        if (!examId) {
            alert('No exam selected. Please start the exam again.');
            window.location.href = '/start.html';
            return;
        }

        // Get exam details (duration)
        try {
            const examRes = await fetch(`/api/exam/${examId}`);
            if (examRes.ok) {
                const exam = await examRes.json();
                if (exam && exam.duration) {
                    examDurationSeconds = parseInt(exam.duration) * 60;
                }
            }
        } catch {}

        // Fetch questions for this exam
        await loadQuestions(examId);
        if (!questions || questions.length === 0) {
            alert('This exam has no questions yet. Please contact the host.');
            window.location.href = '/start.html';
            return;
        }
        
        // Display first question
        displayCurrentQuestion();
        updateNavigation();
        updateProgressUI();
        
        // Initialize monitoring
        initializeMonitoring();
        
        // Start timer
        startTimer(examDurationSeconds);
    } catch (error) {
        alert('There was an error initializing the exam. Please start over.');
        window.location.href = '/start.html';
    }
}

async function loadQuestions(examId) {
    const response = await fetch(`/api/exam/${examId}/questions`);
    if (!response.ok) throw new Error('Failed to load questions');
    questions = await response.json();
    if (!Array.isArray(questions)) questions = [];
}

function displayCurrentQuestion() {
    if (currentQuestionIndex >= questions.length) {
        endExam();
        return;
    }
    const question = questions[currentQuestionIndex];
    questionText.textContent = question.text;

    optionsContainer.innerHTML = '';
    const letters = ['A','B','C','D','E','F','G','H'];

    const selectedValue = getSelectedAnswerValue();

    const opts = Array.isArray(question.options) ? question.options : [];
    opts.forEach((option, index) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option';

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.id = `option${index}`;
        radio.name = 'answer';
        radio.value = option;
        radio.style.display = 'none';

        if (selectedValue && selectedValue === option) {
            radio.checked = true;
            optionDiv.classList.add('selected');
        }

        const letter = document.createElement('span');
        letter.className = 'option-letter';
        letter.textContent = letters[index] || String(index + 1);

        const label = document.createElement('label');
        label.htmlFor = `option${index}`;
        label.textContent = option;

        optionDiv.appendChild(radio);
        optionDiv.appendChild(letter);
        optionDiv.appendChild(label);
        optionsContainer.appendChild(optionDiv);

        // Click entire card to select
        optionDiv.addEventListener('click', () => {
            document.querySelectorAll('.option').forEach(el => el.classList.remove('selected'));
            radio.checked = true;
            optionDiv.classList.add('selected');
        });
    });

    updateNavigation();
    updateProgressUI();
}

function getSelectedAnswerValue() {
    const checked = document.querySelector('input[name="answer"]:checked');
    return checked ? checked.value : null;
}

function updateNavigation() {
    if (prevButton) {
        prevButton.disabled = currentQuestionIndex === 0;
    }
    if (nextButton) {
        nextButton.textContent = currentQuestionIndex === questions.length - 1 ? 'Finish' : 'Next';
    }
}

function updateProgressUI() {
    if (!questions || questions.length === 0) return;
    const current = currentQuestionIndex + 1;
    const total = questions.length;
    if (questionCounterEl) questionCounterEl.textContent = `Question ${current} of ${total}`;
    const pct = Math.round((current / total) * 100);
    if (progressPctEl) progressPctEl.textContent = `${pct}%`;
    if (progressFillEl) progressFillEl.style.width = `${pct}%`;
}

function startTimer(duration) {
    let timeLeft = duration;
    function updateTimer() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        if (timerDisplay) {
            timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            endExam();
            return;
        }
        timeLeft--;
    }
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
}

function initializeMonitoring() {
    // Focus/visibility/keyboard handlers are unchanged
    window.addEventListener('blur', () => {
        if (isExamActive) {
            violationCount++;
            updateViolationCounter();
            showWarning(`⚠️ Focus lost! Violation ${violationCount}/3`);
            if (violationCount >= 3) endExam();
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (isExamActive && document.hidden) {
            violationCount++;
            updateViolationCounter();
            showWarning(`⚠️ Page hidden! Possible Alt+Tab detected. Violation ${violationCount}/3`);
            if (violationCount >= 3) endExam();
        }
    });

    document.addEventListener('contextmenu', (e) => e.preventDefault());
}

function updateViolationCounter() {
    if (altTabCounter) {
        altTabCounter.textContent = `Violations: ${violationCount}/3`;
    }
}

function showWarning(message) {
    const warning = document.createElement('div');
    warning.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        background: #fffbeb; color: #9a3412; padding: 0.9rem 1.25rem; border-radius: 10px;
        border:1px solid #fde68a; z-index: 9999; font-weight: 800; box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    `;
    warning.textContent = message;
    document.body.appendChild(warning);
    setTimeout(() => { if (warning.parentNode) warning.remove(); }, 2500);
}

async function endExam() {
    isExamActive = false;
    if (timerInterval) clearInterval(timerInterval);
    try {
        await fetch(`/end_exam?attempt_id=${examAttemptId}`, { method: 'POST' });
    } catch {}
    window.location.href = `/results.html?attempt_id=${examAttemptId}`;
}

// Navigation events
if (prevButton) {
    prevButton.addEventListener('click', () => {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            displayCurrentQuestion();
        }
    });
}

nextButton.addEventListener('click', async () => {
    const selectedAnswer = document.querySelector('input[name="answer"]:checked');
    if (!selectedAnswer) {
        alert('Please select an answer before continuing.');
        return;
    }
    try {
        const question = questions[currentQuestionIndex];
        const formData = new FormData();
        formData.append('attempt_id', examAttemptId);
        formData.append('question_id', question.id);
        formData.append('user_answer', selectedAnswer.value);
        formData.append('time_taken_seconds', 30);
        await fetch('/submit_answer', { method: 'POST', body: formData });
    } catch {}

    currentQuestionIndex++;
    if (currentQuestionIndex >= questions.length) {
        endExam();
        return;
    }
    displayCurrentQuestion();
});