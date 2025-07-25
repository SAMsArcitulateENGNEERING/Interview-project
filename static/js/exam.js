// Simple Exam System - Rebuilt from scratch
let currentQuestionIndex = 0;
let questions = [];
let examAttemptId = null;
let isExamActive = true;
let timerInterval = null;

// DOM elements
const timerDisplay = document.getElementById('timer');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const nextButton = document.getElementById('next-question');
const altTabCounter = document.getElementById('alt-tab-counter');

// Simple violation tracking
let violationCount = 0;

// Initialize exam when page loads
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Exam page loaded, starting initialization...');
    await initializeExam();
});

async function initializeExam() {
    try {
        // Get exam attempt ID from URL parameters or localStorage
        const urlParams = new URLSearchParams(window.location.search);
        const attemptId = urlParams.get('attempt_id') || localStorage.getItem('exam_attempt_id');
        
        if (attemptId) {
            examAttemptId = parseInt(attemptId);
            localStorage.setItem('exam_attempt_id', examAttemptId);
            console.log('Using existing exam attempt ID:', examAttemptId);
        } else {
            console.error('No exam attempt ID found');
            alert('No exam attempt found. Please start the exam from the beginning.');
            window.location.href = '/start.html';
            return;
        }

        // Get user ID from localStorage or URL
        const userId = urlParams.get('user_id') || localStorage.getItem('user_id');
        if (userId) {
            localStorage.setItem('user_id', userId);
            console.log('Using user ID:', userId);
        }

        // Fetch questions
        await loadQuestions();
        
        // Display first question
        displayCurrentQuestion();
        
        // Initialize monitoring
        initializeMonitoring();
        
        // Start timer (60 minutes = 3600 seconds)
        startTimer(3600);
        
        console.log('Exam initialized successfully');
    } catch (error) {
        console.error('Error initializing exam:', error);
        alert('There was an error initializing the exam. Please start over.');
        window.location.href = '/start.html';
    }
}

async function loadQuestions() {
    try {
        console.log('Fetching questions from server...');
        
        const response = await fetch('/get_random_questions?count=5');
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error:', errorText);
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }
        
        questions = await response.json();
        console.log('Questions loaded:', questions.length);
        
        if (!questions || questions.length === 0) {
            throw new Error('No questions available in the database');
        }
        
        console.log('Questions loaded successfully');
        
    } catch (error) {
        console.error('Error loading questions:', error);
        throw new Error('Failed to load questions: ' + error.message);
    }
}

function displayCurrentQuestion() {
    if (currentQuestionIndex >= questions.length) {
        console.log('All questions completed, ending exam...');
        endExam();
        return;
    }
    
    const question = questions[currentQuestionIndex];
    console.log('Displaying question:', currentQuestionIndex + 1, 'of', questions.length);
    
    // Display question text
    questionText.textContent = question.text;
    
    // Clear previous options
    optionsContainer.innerHTML = '';
    
    // Create option buttons
    question.options.forEach((option, index) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option';
        
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.id = `option${index}`;
        radio.name = 'answer';
        radio.value = option;
        
        const label = document.createElement('label');
        label.htmlFor = `option${index}`;
        label.textContent = option;
        
        optionDiv.appendChild(radio);
        optionDiv.appendChild(label);
        optionsContainer.appendChild(optionDiv);
    });
}

function startTimer(duration) {
    let timeLeft = duration;
    
    function updateTimer() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            console.log('⏰ Time is up! Automatically ending exam...');
            endExam();
            return;
        }
        timeLeft--;
    }
    
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
}

function initializeMonitoring() {
    console.log('Initializing enhanced monitoring...');
    
    // Enhanced focus detection
    window.addEventListener('blur', () => {
        if (isExamActive) {
            console.log('Window focus lost detected');
            violationCount++;
            updateViolationCounter();
            showWarning(`⚠️ Focus lost! Violation ${violationCount}/3`);
            
            if (violationCount >= 3) {
                endExam();
            }
        }
    });
    
    // Visibility change detection (Alt+Tab, switching apps)
    document.addEventListener('visibilitychange', () => {
        if (isExamActive && document.hidden) {
            console.log('Page visibility changed - possible Alt+Tab detected');
            violationCount++;
            updateViolationCounter();
            showWarning(`⚠️ Page hidden! Possible Alt+Tab detected. Violation ${violationCount}/3`);
            
            if (violationCount >= 3) {
                endExam();
            }
        }
    });
    
    // Prevent right-click
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        console.log('Right-click blocked');
    });
    
    // Enhanced keyboard monitoring
    document.addEventListener('keydown', (e) => {
        if (!isExamActive) return;
        
        const blockedKeys = ['F12', 'F11', 'F10', 'F9', 'F8', 'F7', 'F6', 'F5', 'F4', 'F3', 'F2', 'F1'];
        const blockedCombos = [
            { ctrl: true, shift: true, key: 'I' },  // Developer tools
            { ctrl: true, shift: true, key: 'J' },  // Console
            { ctrl: true, shift: true, key: 'C' },  // Elements
            { ctrl: true, key: 'U' },               // View source
            { ctrl: true, key: 'S' },               // Save
            { ctrl: true, key: 'P' },               // Print
            { ctrl: true, key: 'N' },               // New window
            { ctrl: true, key: 'T' },               // New tab
            { ctrl: true, key: 'W' },               // Close tab
            { ctrl: true, key: 'R' },               // Refresh
            { ctrl: true, key: 'F5' },              // Hard refresh
            { alt: true, key: 'F4' },               // Close window
            { alt: true, key: 'Tab' },              // Alt+Tab (browser tabs)
            { ctrl: true, alt: true, key: 'Delete' }, // Task manager
            { ctrl: true, alt: true, key: 'Tab' },  // Alt+Tab
            { ctrl: true, shift: true, key: 'Esc' }, // Task manager
        ];
        
        // Check for blocked keys
        if (blockedKeys.includes(e.key)) {
            e.preventDefault();
            console.log(`Blocked key: ${e.key}`);
            violationCount++;
            updateViolationCounter();
            showWarning(`⚠️ Blocked key: ${e.key}! Violation ${violationCount}/3`);
            
            if (violationCount >= 3) {
                endExam();
            }
            return;
        }
        
        // Check for blocked combinations
        for (const combo of blockedCombos) {
            if (e.ctrlKey === combo.ctrl && 
                e.shiftKey === combo.shift && 
                e.altKey === combo.alt && 
                e.key === combo.key) {
                e.preventDefault();
                console.log(`Blocked combo: ${JSON.stringify(combo)}`);
                violationCount++;
                updateViolationCounter();
                showWarning(`⚠️ Blocked shortcut! Violation ${violationCount}/3`);
                
                if (violationCount >= 3) {
                    endExam();
                }
                return;
            }
        }
    });
    
    // Mouse leave detection - More intelligent
    let mouseLeaveTimeout = null;
    let mouseLeaveCount = 0;
    
    document.addEventListener('mouseleave', () => {
        if (isExamActive) {
            console.log('Mouse left window area');
            mouseLeaveCount++;
            
            // Clear existing timeout
            if (mouseLeaveTimeout) {
                clearTimeout(mouseLeaveTimeout);
            }
            
            // Only count as violation if mouse is out for more than 3 seconds AND we've had multiple leave events
            mouseLeaveTimeout = setTimeout(() => {
                if (document.hasFocus() && !document.hidden && mouseLeaveCount > 2) {
                    console.log(`Mouse left window for extended period (${mouseLeaveCount} times)`);
                    violationCount++;
                    updateViolationCounter();
                    showWarning(`⚠️ Extended mouse leave detected! Violation ${violationCount}/3`);
                    
                    if (violationCount >= 3) {
                        endExam();
                    }
                }
            }, 3000); // 3 seconds delay
        }
    });
    
    // Reset mouse leave count when mouse returns
    document.addEventListener('mouseenter', () => {
        if (mouseLeaveTimeout) {
            clearTimeout(mouseLeaveTimeout);
            mouseLeaveTimeout = null;
        }
        mouseLeaveCount = 0;
    });
    
    // Window resize detection - More intelligent
    let resizeTimeout = null;
    let resizeCount = 0;
    
    window.addEventListener('resize', () => {
        if (isExamActive) {
            console.log('Window resized');
            resizeCount++;
            
            // Clear existing timeout
            if (resizeTimeout) {
                clearTimeout(resizeTimeout);
            }
            
            // Only count as violation if window is very small for more than 2 seconds
            resizeTimeout = setTimeout(() => {
                if (window.innerWidth < 200 || window.innerHeight < 200) {
                    console.log(`Window significantly resized (${resizeCount} times): ${window.innerWidth}x${window.innerHeight}`);
                    violationCount++;
                    updateViolationCounter();
                    showWarning(`⚠️ Window minimized/resized! Violation ${violationCount}/3`);
                    
                    if (violationCount >= 3) {
                        endExam();
                    }
                }
            }, 2000); // 2 seconds delay
        }
    });
    
    // Periodic activity check - More intelligent
    let hiddenStartTime = null;
    
    setInterval(() => {
        if (isExamActive) {
            if (document.hidden) {
                if (!hiddenStartTime) {
                    hiddenStartTime = Date.now();
                    console.log('Page became hidden, starting timer');
                } else {
                    const hiddenDuration = Date.now() - hiddenStartTime;
                    // Only count as violation if page has been hidden for more than 30 seconds
                    if (hiddenDuration > 30000) {
                        console.log(`Page hidden for ${hiddenDuration}ms - counting as violation`);
                        violationCount++;
                        updateViolationCounter();
                        showWarning(`⚠️ Extended inactivity detected! Violation ${violationCount}/3`);
                        
                        if (violationCount >= 3) {
                            endExam();
                        }
                        hiddenStartTime = null; // Reset timer
                    }
                }
            } else {
                // Page is visible again, reset timer
                if (hiddenStartTime) {
                    console.log('Page became visible again, resetting timer');
                    hiddenStartTime = null;
                }
            }
        }
    }, 5000); // Check every 5 seconds
    
    console.log('Enhanced monitoring initialized');
}

function updateViolationCounter() {
    if (altTabCounter) {
        altTabCounter.textContent = `Violations: ${violationCount}/3`;
        if (violationCount >= 2) {
            altTabCounter.style.color = '#ff4444';
            altTabCounter.style.fontWeight = 'bold';
        } else if (violationCount >= 1) {
            altTabCounter.style.color = '#ff8800';
        }
    }
}

function showWarning(message) {
    const warning = document.createElement('div');
    warning.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #ffcc00;
        color: #000;
        padding: 1rem 2rem;
        border-radius: 8px;
        z-index: 9999;
        font-weight: bold;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        max-width: 80%;
        text-align: center;
    `;
    warning.textContent = `⚠️ ${message}`;
    document.body.appendChild(warning);
    
    setTimeout(() => { 
        if (warning.parentNode) {
            warning.remove(); 
        }
    }, 3000);
}

function showError(message) {
    alert(message);
    window.location.href = '/';
}

async function endExam() {
    console.log('🛑 Ending exam...');
    console.log('Current exam attempt ID:', examAttemptId);
    isExamActive = false;
    
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    try {
        // This will automatically stop the native monitor
        const response = await fetch(`/end_exam?attempt_id=${examAttemptId}`, { 
            method: 'POST' 
        });
        
        if (response.ok) {
            console.log('✅ Exam ended successfully, native monitor stopped');
        } else {
            console.error('❌ Failed to end exam properly');
        }
    } catch (error) {
        console.error('Error ending exam:', error);
    }
    
    // Redirect to results page with attempt_id
    console.log('Redirecting to results page with attempt_id:', examAttemptId);
    window.location.href = `/results.html?attempt_id=${examAttemptId}`;
}

// Handle next button click
nextButton.addEventListener('click', async () => {
    const selectedAnswer = document.querySelector('input[name="answer"]:checked');
    
    if (!selectedAnswer) {
        alert('Please select an answer before continuing.');
        return;
    }
    
    try {
        // Submit answer
        const question = questions[currentQuestionIndex];
        const formData = new FormData();
        formData.append('attempt_id', examAttemptId);
        formData.append('question_id', question.id);
        formData.append('user_answer', selectedAnswer.value);
        formData.append('time_taken_seconds', 30); // Default time
        
        const response = await fetch('/submit_answer', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            console.error('Failed to submit answer');
        }
        
    } catch (error) {
        console.error('Error submitting answer:', error);
    }

    // Move to next question
    currentQuestionIndex++;
    displayCurrentQuestion();
});