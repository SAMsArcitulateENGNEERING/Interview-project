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
        displayResults(results);
    } catch (error) {
        console.error('Error fetching results:', error);
        resultsSummary.innerHTML = `<p style="color: red;">Failed to load results: ${error.message}. Please try again or contact support.</p>`;
    }
}

async function displayResults(results) {
    // Calculate score if not already calculated
    let score = results.score;
    if (score === null || score === undefined) {
        score = 0;
        if (results.answered_questions) {
            score = results.answered_questions.filter(q => q.is_correct).length;
        }
    }
    
    // Calculate average time if not already calculated
    let avgTime = results.average_time_per_question_seconds;
    if (avgTime === null || avgTime === undefined) {
        avgTime = 0;
        if (results.answered_questions && results.answered_questions.length > 0) {
            const totalTime = results.answered_questions.reduce((sum, q) => sum + (q.time_taken_seconds || 0), 0);
            avgTime = totalTime / results.answered_questions.length;
        }
    }
    
    resultsSummary.innerHTML = `
        <h2>Exam Results</h2>
        <div class="result-card">
            <p><strong>Score:</strong> ${score} / ${results.answered_questions ? results.answered_questions.length : 0}</p>
            <p><strong>Percentage:</strong> ${results.answered_questions && results.answered_questions.length > 0 ? ((score / results.answered_questions.length) * 100).toFixed(1) : 0}%</p>
            <p><strong>Start Time:</strong> ${new Date(results.start_time).toLocaleString()}</p>
            <p><strong>End Time:</strong> ${results.end_time ? new Date(results.end_time).toLocaleString() : 'Not completed'}</p>
            <p><strong>Average Time Per Question:</strong> ${avgTime.toFixed(2)} seconds</p>
            <p><strong>Violations:</strong> ${results.alt_tab_count || 0}</p>
        </div>
    `;

    if (results.answered_questions && results.answered_questions.length > 0) {
        answeredQuestionsContainer.innerHTML = '<h3>Question Details</h3>';
        
        for (let i = 0; i < results.answered_questions.length; i++) {
            const answeredQuestion = results.answered_questions[i];
            const questionDiv = document.createElement('div');
            questionDiv.className = 'question-result';
            questionDiv.innerHTML = `
                <h4>Question ${i + 1}</h4>
                <p><strong>Your Answer:</strong> ${answeredQuestion.user_answer || 'Not answered'}</p>
                <p><strong>Correct Answer:</strong> ${answeredQuestion.correct_answer || 'Unknown'}</p>
                <p><strong>Result:</strong> <span class="${answeredQuestion.is_correct ? 'correct' : 'incorrect'}">${answeredQuestion.is_correct ? '✓ Correct' : '✗ Incorrect'}</span></p>
                <p><strong>Time Taken:</strong> ${answeredQuestion.time_taken_seconds || 0} seconds</p>
            `;
            answeredQuestionsContainer.appendChild(questionDiv);
        }
    } else {
        answeredQuestionsContainer.innerHTML = '<p>No questions were answered.</p>';
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