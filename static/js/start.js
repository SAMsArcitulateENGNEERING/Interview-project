document.getElementById('start-exam-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const examId = window.selectedExamId;
    
    if (!name || !email || !examId) {
        document.getElementById('start-error').textContent = 'Please enter your name, email, and select an exam.';
        return;
    }

    try {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('email', email);
        formData.append('exam_id', examId);

        const response = await fetch('/start_exam_simple', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        if (result.success !== false) {
            localStorage.setItem('user_id', result.user_id);
            localStorage.setItem('exam_attempt_id', result.exam_attempt_id);
            window.location.href = `/exam.html?attempt_id=${result.exam_attempt_id}&user_id=${result.user_id}`;
        } else {
            document.getElementById('start-error').textContent = result.detail || 'Failed to start exam.';
        }
    } catch (error) {
        document.getElementById('start-error').textContent = error.message || 'Failed to start the exam. Please try again.';
    }
}); 