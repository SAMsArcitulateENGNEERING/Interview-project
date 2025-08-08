document.getElementById('start-exam-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const examId = window.selectedExamId;

    if (!name || !email || !phone || !examId) {
        document.getElementById('start-error').textContent = 'Please enter your name, email, phone number, and select an exam.';
        return;
    }

    try {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('email', email);
        formData.append('phone', phone);
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
            localStorage.setItem('user_phone', phone);
            window.location.href = `/exam.html?attempt_id=${result.exam_attempt_id}&exam_id=${examId}`;
        } else {
            document.getElementById('start-error').textContent = result.detail || 'Failed to start exam.';
        }
    } catch (error) {
        document.getElementById('start-error').textContent = error.message || 'Failed to start the exam. Please try again.';
    }
}); 