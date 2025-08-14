// Get attempt_id from URL parameters first, then localStorage
const urlParams = new URLSearchParams(window.location.search);
const attemptId = urlParams.get('attempt_id') || localStorage.getItem('exam_attempt_id');
const userId = localStorage.getItem('user_id');
const resultsSummary = document.getElementById('results-summary');
const answeredQuestionsContainer = document.getElementById('answered-questions');
const sortingPageButton = document.getElementById('sorting-page');

async function fetchResults() {
    try {
        console.log('Fetching results for attempt ID:', attemptId);
        if (!attemptId) {
            throw new Error('No exam attempt ID found');
        }
        
        const response = await fetch(`/get_exam_result/${attemptId}`);
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error:', errorText);
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
        
        const results = await response.json();
        console.log('Results received:', results);
        await displayResults(results);
    } catch (error) {
        console.error('Error fetching results:', error);
        resultsSummary.innerHTML = `<p style="color: red;">Failed to load results: ${error.message}. Please try again or contact support.</p>`;
    }
}

async function displayResults(results) {
    // Parse answered_questions if it's a string
    let answeredQuestions = results.answered_questions;
    if (typeof answeredQuestions === 'string') {
        try {
            answeredQuestions = JSON.parse(answeredQuestions);
        } catch (e) {
            console.error('Error parsing answered_questions:', e);
            answeredQuestions = [];
        }
    }
    
    // Ensure answeredQuestions is an array
    if (!Array.isArray(answeredQuestions)) {
        answeredQuestions = [];
    }
    
    console.log('Parsed answered questions:', answeredQuestions);
    
    // Calculate score if not already calculated
    let score = results.score;
    if (score === null || score === undefined) {
        score = 0;
        if (answeredQuestions.length > 0) {
            score = answeredQuestions.filter(q => q.is_correct).length;
        }
    }
    
    // Calculate average time if not already calculated
    let avgTime = results.average_time_per_question_seconds;
    if (avgTime === null || avgTime === undefined) {
        avgTime = 0;
        if (answeredQuestions.length > 0) {
            const totalTime = answeredQuestions.reduce((sum, q) => sum + (q.time_taken_seconds || 0), 0);
            avgTime = totalTime / answeredQuestions.length;
        }
    }
    
    // Display summary
    resultsSummary.innerHTML = `
        <h2>📊 Exam Results</h2>
        <div class="result-card" style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #007bff;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div style="text-align: center;">
                    <h3 style="margin: 0; color: #007bff; font-size: 2rem;">${score}</h3>
                    <p style="margin: 5px 0; color: #666;">Score</p>
                </div>
                <div style="text-align: center;">
                    <h3 style="margin: 0; color: #28a745; font-size: 2rem;">${answeredQuestions.length}</h3>
                    <p style="margin: 5px 0; color: #666;">Total Questions</p>
                </div>
                <div style="text-align: center;">
                    <h3 style="margin: 0; color: #ffc107; font-size: 2rem;">${answeredQuestions.length > 0 ? ((score / answeredQuestions.length) * 100).toFixed(1) : 0}%</h3>
                    <p style="margin: 5px 0; color: #666;">Percentage</p>
                </div>
                <div style="text-align: center;">
                    <h3 style="margin: 0; color: #dc3545; font-size: 2rem;">${results.alt_tab_count || 0}</h3>
                    <p style="margin: 5px 0; color: #666;">Violations</p>
                </div>
            </div>
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                <p><strong>⏰ Start Time:</strong> ${new Date(results.start_time).toLocaleString()}</p>
                <p><strong>⏰ End Time:</strong> ${results.end_time ? new Date(results.end_time).toLocaleString() : 'Not completed'}</p>
                <p><strong>⏱️ Average Time Per Question:</strong> ${avgTime.toFixed(2)} seconds</p>
                <p><strong>⏱️ Total Duration:</strong> ${results.duration_seconds ? Math.floor(results.duration_seconds / 60) : 0} minutes ${results.duration_seconds ? results.duration_seconds % 60 : 0} seconds</p>
            </div>
        </div>
    `;

    // Display detailed questions
    if (answeredQuestions.length > 0) {
        answeredQuestionsContainer.innerHTML = '<h3>📝 Question Details</h3>';
        
        // Fetch question details for each answered question
        for (let i = 0; i < answeredQuestions.length; i++) {
            const answeredQuestion = answeredQuestions[i];
            const questionDiv = document.createElement('div');
            questionDiv.className = 'question-result';
            questionDiv.style.cssText = `
                background: white;
                border-radius: 12px;
                padding: 20px;
                margin: 15px 0;
                border: 1px solid #dee2e6;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            `;
            
            // Try to fetch the actual question details
            let questionText = "Question details not available";
            let questionOptions = [];
            
            try {
                if (answeredQuestion.question_id) {
                    const questionResponse = await fetch(`/get_question/${answeredQuestion.question_id}`);
                    if (questionResponse.ok) {
                        const questionData = await questionResponse.json();
                        questionText = questionData.text;
                        
                        // Parse options if they're stored as JSON string
                        if (typeof questionData.options === 'string') {
                            try {
                                questionOptions = JSON.parse(questionData.options);
                            } catch (e) {
                                questionOptions = [questionData.options];
                            }
                        } else {
                            questionOptions = questionData.options || [];
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching question details:', error);
            }
            
            // Create options display
            let optionsHtml = '';
            if (questionOptions.length > 0) {
                optionsHtml = '<div style="margin: 10px 0;"><strong>Options:</strong><ul style="margin: 5px 0; padding-left: 20px;">';
                questionOptions.forEach((option, index) => {
                    const isCorrect = option === answeredQuestion.correct_answer;
                    const isSelected = option === answeredQuestion.user_answer;
                    let optionStyle = '';
                    
                    if (isCorrect && isSelected) {
                        optionStyle = 'color: #28a745; font-weight: bold;';
                    } else if (isCorrect) {
                        optionStyle = 'color: #28a745; font-weight: bold;';
                    } else if (isSelected && !isCorrect) {
                        optionStyle = 'color: #dc3545; font-weight: bold;';
                    }
                    
                    optionsHtml += `<li style="${optionStyle}">${option}${isCorrect ? ' ✓' : ''}${isSelected && !isCorrect ? ' ✗' : ''}</li>`;
                });
                optionsHtml += '</ul></div>';
            }
            
            // Determine result status
            const isCorrect = answeredQuestion.is_correct;
            const resultStatus = isCorrect ? 
                '<span style="color: #28a745; font-weight: bold;">✓ Correct</span>' : 
                '<span style="color: #dc3545; font-weight: bold;">✗ Incorrect</span>';
            
            questionDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h4 style="margin: 0; color: #333;">Question ${i + 1}</h4>
                    <div style="display: flex; gap: 15px; align-items: center;">
                        <span style="background: ${isCorrect ? '#d4edda' : '#f8d7da'}; color: ${isCorrect ? '#155724' : '#721c24'}; padding: 4px 8px; border-radius: 4px; font-size: 0.9em;">
                            ${resultStatus}
                        </span>
                        <span style="background: #e9ecef; color: #495057; padding: 4px 8px; border-radius: 4px; font-size: 0.9em;">
                            ⏱️ ${answeredQuestion.time_taken_seconds || 0}s
                        </span>
                    </div>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 10px;">
                    <p style="margin: 0; font-weight: 500;">${questionText}</p>
                </div>
                ${optionsHtml}
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
                    <div style="background: ${isCorrect ? '#d4edda' : '#f8d7da'}; padding: 10px; border-radius: 6px;">
                        <strong>Your Answer:</strong><br>
                        <span style="color: ${isCorrect ? '#155724' : '#721c24'};">
                            ${answeredQuestion.user_answer || 'Not answered'}
                        </span>
                    </div>
                    <div style="background: #d4edda; padding: 10px; border-radius: 6px;">
                        <strong>Correct Answer:</strong><br>
                        <span style="color: #155724;">
                            ${answeredQuestion.correct_answer || 'Unknown'}
                        </span>
                    </div>
                </div>
            `;
            
            answeredQuestionsContainer.appendChild(questionDiv);
        }
    } else {
        answeredQuestionsContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <h3>📝 No Questions Answered</h3>
                <p>No questions were answered in this exam attempt.</p>
            </div>
        `;
    }
}

sortingPageButton.addEventListener('click', () => {
    window.location.href = 'sorting.html';
});

window.onload = () => {
    if (!attemptId) {
        resultsSummary.innerHTML = '<p style="color: red;">No exam attempt found. Please start an exam first.</p>';
        return;
    }
    fetchResults();
}; 