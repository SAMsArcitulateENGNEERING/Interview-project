const attemptId = localStorage.getItem('attempt_id');
let questions = [];
let currentQuestionIndex = 0;
let questionStartTime;
let altTabCount = 0;
let lastDetectionTime = 0;
const DETECTION_DEBOUNCE_MS = 2000; // 2 second debounce
let isExamActive = true;
let lastActivityTime = Date.now();
let mousePosition = { x: 0, y: 0 };
let lastMousePosition = { x: 0, y: 0 };
let focusLostCount = 0;
let suspiciousActivityCount = 0;

const timerDisplay = document.getElementById('timer');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const nextButton = document.getElementById('next-question');
const altTabCounter = document.getElementById('alt-tab-counter');

// Multi-layered detection system
class AltTabDetector {
    constructor() {
        this.detectionMethods = [
            this.focusDetection.bind(this),
            this.mouseTracking.bind(this),
            this.keyboardMonitoring.bind(this),
            this.periodicActivityCheck.bind(this),
            this.windowResizeDetection.bind(this)
        ];
        this.init();
    }

    init() {
        // Focus detection
        window.addEventListener('blur', () => this.focusDetection());
        window.addEventListener('focus', () => this.resetActivity());
        document.addEventListener('visibilitychange', () => this.visibilityDetection());
        
        // Mouse tracking
        document.addEventListener('mousemove', (e) => this.trackMouse(e));
        document.addEventListener('mouseleave', () => this.mouseLeaveDetection());
        
        // Keyboard monitoring
        document.addEventListener('keydown', (e) => this.keyboardDetection(e));
        
        // Window events
        window.addEventListener('resize', () => this.windowResizeDetection());
        window.addEventListener('beforeunload', () => this.pageUnloadDetection());
        
        // Periodic activity check
        setInterval(() => this.periodicActivityCheck(), 5000);
        
        // Prevent context menu (right-click)
        document.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Prevent common shortcuts
        document.addEventListener('keydown', (e) => this.preventShortcuts(e));
    }

    async focusDetection() {
        if (!isExamActive) return;
        
        focusLostCount++;
        if (focusLostCount >= 2) {
            await this.triggerDetection('Focus lost multiple times');
            focusLostCount = 0;
        }
    }

    visibilityDetection() {
        if (!isExamActive) return;
        
        if (document.hidden) {
            this.triggerDetection('Page visibility changed');
        } else {
            this.resetActivity();
        }
    }

    trackMouse(e) {
        if (!isExamActive) return;
        
        lastMousePosition = mousePosition;
        mousePosition = { x: e.clientX, y: e.clientY };
        lastActivityTime = Date.now();
    }

    mouseLeaveDetection() {
        if (!isExamActive) return;
        
        setTimeout(() => {
            if (document.hasFocus() && !document.hidden) {
                this.triggerDetection('Mouse left window area');
            }
        }, 1000);
    }

    keyboardDetection(e) {
        if (!isExamActive) return;
        
        // Detect Alt+Tab, Ctrl+Tab, F11, etc.
        const suspiciousKeys = ['Tab', 'F11', 'F12', 'Escape'];
        const suspiciousCombos = ['Alt', 'Control', 'Meta'];
        
        if (suspiciousKeys.includes(e.key) || 
            suspiciousCombos.some(key => e.getModifierState(key))) {
            suspiciousActivityCount++;
            if (suspiciousActivityCount >= 3) {
                this.triggerDetection('Suspicious keyboard activity');
                suspiciousActivityCount = 0;
            }
        }
        
        lastActivityTime = Date.now();
    }

    windowResizeDetection() {
        if (!isExamActive) return;
        
        // Check if window was minimized or resized significantly
        if (window.innerWidth < 100 || window.innerHeight < 100) {
            this.triggerDetection('Window resized to suspicious size');
        }
    }

    pageUnloadDetection() {
        if (!isExamActive) return;
        
        this.triggerDetection('Page unload detected');
    }

    periodicActivityCheck() {
        if (!isExamActive) return;
        
        const timeSinceLastActivity = Date.now() - lastActivityTime;
        if (timeSinceLastActivity > 30000) { // 30 seconds of inactivity
            this.triggerDetection('Extended period of inactivity');
            lastActivityTime = Date.now();
        }
    }

    preventShortcuts(e) {
        // Prevent common shortcuts that could be used for cheating
        const blockedShortcuts = [
            'F11', 'F12', 'Escape',
            'Control+Shift+I', 'Control+Shift+J', 'Control+Shift+C',
            'Control+U', 'Control+S', 'Control+P'
        ];
        
        const keyCombo = [];
        if (e.ctrlKey) keyCombo.push('Control');
        if (e.shiftKey) keyCombo.push('Shift');
        if (e.altKey) keyCombo.push('Alt');
        if (e.metaKey) keyCombo.push('Meta');
        keyCombo.push(e.key);
        
        const comboString = keyCombo.join('+');
        
        if (blockedShortcuts.includes(comboString) || blockedShortcuts.includes(e.key)) {
            e.preventDefault();
            this.triggerDetection('Blocked shortcut attempted');
        }
    }

    resetActivity() {
        lastActivityTime = Date.now();
        focusLostCount = 0;
        suspiciousActivityCount = 0;
    }

    async triggerDetection(reason) {
        const now = Date.now();
        if (now - lastDetectionTime < DETECTION_DEBOUNCE_MS) return;
        lastDetectionTime = now;

        console.log(`Alt-tab detection triggered: ${reason}`);
        
        try {
            const body = new URLSearchParams();
            body.append('attempt_id', attemptId);

            const response = await fetch('/increment_alt_tab', {
                method: 'POST',
                body: body,
            });

            if (!response.ok) {
                throw new Error('Failed to increment alt-tab count on the server.');
            }

            const data = await response.json();
            altTabCount = data.alt_tab_count;
            updateAltTabCounter();

            if (data.exam_ended) {
                isExamActive = false;
                alert('Exam terminated due to multiple violations!');
                window.location.href = 'results.html';
            } else {
                showAltTabWarning(3 - altTabCount, reason);
            }
        } catch (error) {
            console.error('Error handling detection:', error);
        }
    }
}

async function initializeExam() {
    if (!attemptId) {
        window.location.href = 'index.html';
        return;
    }

    try {
        const examDataResponse = await fetch(`/get_exam_result/${attemptId}`);
        if (!examDataResponse.ok) {
            throw new Error('Failed to fetch exam data');
        }
        const examData = await examDataResponse.json();
        altTabCount = examData.alt_tab_count;
        updateAltTabCounter();

        await fetchQuestions();
        startTimer(3600); // 60 minutes
        
        // Initialize the detection system
        new AltTabDetector();
    } catch (error) {
        console.error('Initialization error:', error);
        alert('There was an error initializing the exam. Please start over.');
        window.location.href = 'index.html';
    }
}

async function fetchQuestions() {
    try {
        const response = await fetch('/get_random_questions?count=5');
        questions = await response.json();
        displayQuestion();
    } catch (error) {
        console.error('Error fetching questions:', error);
        alert('Failed to load questions. Please try again.');
    }
}

function displayQuestion() {
    if (currentQuestionIndex >= questions.length) {
        endExam();
        return;
    }
    questionStartTime = Date.now();
    const question = questions[currentQuestionIndex];
    questionText.textContent = question.text;
    optionsContainer.innerHTML = '';
    question.options.forEach((option, index) => {
        const optionId = `option${index}`;
        const optionDiv = document.createElement('div');
        optionDiv.classList.add('option');
        
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.id = optionId;
        radio.name = 'option';
        radio.value = option;
        
        const label = document.createElement('label');
        label.htmlFor = optionId;
        label.textContent = option;
        
        optionDiv.appendChild(radio);
        optionDiv.appendChild(label);
        optionsContainer.appendChild(optionDiv);
    });
}

async function endExam() {
    isExamActive = false;
    await fetch(`/end_exam?attempt_id=${attemptId}`, { method: 'POST' });
    window.location.href = 'results.html';
}

function startTimer(duration) {
    let timer = duration, minutes, seconds;
    const interval = setInterval(() => {
        minutes = parseInt(timer / 60, 10);
        seconds = parseInt(timer % 60, 10);

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        timerDisplay.textContent = minutes + ":" + seconds;

        if (--timer < 0) {
            clearInterval(interval);
            endExam();
        }
    }, 1000);
}

function updateAltTabCounter() {
    if (altTabCounter) {
        altTabCounter.textContent = `Violations: ${altTabCount}/3`;
        if (altTabCount >= 2) {
            altTabCounter.style.color = '#ff4444';
            altTabCounter.style.fontWeight = 'bold';
        } else if (altTabCount >= 1) {
            altTabCounter.style.color = '#ff8800';
        }
    }
}

function showAltTabWarning(remaining, reason) {
    let warning = document.getElementById('alt-tab-warning');
    if (!warning) {
        warning = document.createElement('div');
        warning.id = 'alt-tab-warning';
        warning.style.position = 'fixed';
        warning.style.top = '20px';
        warning.style.left = '50%';
        warning.style.transform = 'translateX(-50%)';
        warning.style.background = '#ffcc00';
        warning.style.color = '#000';
        warning.style.padding = '1rem 2rem';
        warning.style.borderRadius = '8px';
        warning.style.zIndex = '9999';
        warning.style.fontWeight = 'bold';
        warning.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
        warning.style.maxWidth = '80%';
        warning.style.textAlign = 'center';
        document.body.appendChild(warning);
    }
    warning.innerHTML = `
        <div>⚠️ <strong>Warning: Suspicious activity detected!</strong></div>
        <div style="font-size: 0.9rem; margin-top: 0.5rem;">${reason}</div>
        <div style="font-size: 0.8rem; margin-top: 0.5rem;">Remaining warnings: ${remaining}</div>
    `;
    setTimeout(() => { 
        if (warning && warning.parentNode) {
            warning.remove(); 
        }
    }, 4000);
}

nextButton.addEventListener('click', async () => {
    const selectedRadio = optionsContainer.querySelector('input[name="option"]:checked');
    if (!selectedRadio) {
        alert("Please select an answer.");
        return;
    }

    const selectedAnswer = selectedRadio.value;
    const timeTaken = Math.round((Date.now() - questionStartTime) / 1000);
    const question = questions[currentQuestionIndex];

    const body = new URLSearchParams();
    body.append('attempt_id', attemptId);
    body.append('question_id', question.id);
    body.append('user_answer', selectedAnswer);
    body.append('time_taken_seconds', timeTaken);

    try {
        const response = await fetch('/submit_answer', {
            method: 'POST',
            body: body,
        });

        if (!response.ok) {
            console.error('Failed to submit answer:', response.status, await response.text());
            alert('There was an error submitting your answer.');
            return;
        }
    } catch (error) {
        console.error('Error submitting answer:', error);
        alert('There was a network error submitting your answer.');
        return;
    }

    currentQuestionIndex++;
    displayQuestion();
});

window.onload = initializeExam; 