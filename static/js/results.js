const attemptId = localStorage.getItem('attempt_id');
const resultsSummary = document.getElementById('results-summary');
const answeredQuestionsContainer = document.getElementById('answered-questions');
const sortingPageButton = document.getElementById('sorting-page');

async function fetchResults() {
    try {
        const response = await fetch(`/get_exam_result/${attemptId}`);
        const results = await response.json();
        displayResults(results);
    } catch (error) {
        console.error('Error fetching results:', error);
        alert('Failed to load results. Please try again.');
    }
}

async function displayResults(results) {
    resultsSummary.innerHTML = `
        <p><strong>Score:</strong> ${results.score}</p>
        <p><strong>Start Time:</strong> ${new Date(results.start_time).toLocaleString()}</p>
        <p><strong>Average Time Per Question:</strong> ${results.average_time_per_question_seconds.toFixed(2)} seconds</p>
        <p><strong>Alt-Tab Count:</strong> ${results.alt_tab_count}</p>
    `;

    answeredQuestionsContainer.innerHTML = '<h2>Answered Questions</h2>';

    const questionPromises = results.answered_questions.map(async (answeredQuestion) => {
        const questionResponse = await fetch(`/get_question/${answeredQuestion.question_id}`);
        return questionResponse.json();
    });

    const questions = await Promise.all(questionPromises);

    results.answered_questions.forEach((answeredQuestion, index) => {
        const question = questions[index];
        const questionDiv = document.createElement('div');
        questionDiv.innerHTML = `
            <p><strong>Question:</strong> ${question.text}</p>
            <p><strong>Your Answer:</strong> ${answeredQuestion.user_answer}</p>
            <p><strong>Correct Answer:</strong> ${question.correct_answer}</p>
            <p><strong>Result:</strong> ${answeredQuestion.is_correct ? 'Correct' : 'Incorrect'}</p>
            <p><strong>Time Taken:</strong> ${answeredQuestion.time_taken_seconds} seconds</p>
        `;
        answeredQuestionsContainer.appendChild(questionDiv);
    });
}

sortingPageButton.addEventListener('click', () => {
    window.location.href = 'sorting.html';
});

window.onload = () => {
    if (!attemptId) {
        window.location.href = 'index.html';
        return;
    }
    fetchResults();
}; 