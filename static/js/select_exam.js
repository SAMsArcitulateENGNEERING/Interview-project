document.addEventListener('DOMContentLoaded', () => {
    const examList = document.getElementById('exam-list');

    // Fetch available exams from backend
    fetch('/api/active_exams')
        .then(res => res.json())
        .then(exams => {
            examList.innerHTML = '';
            if (!exams.length) {
                examList.innerHTML = '<li>No exams available. Please check back later.</li>';
                return;
            }
            exams.forEach(exam => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span><b>${exam.title || 'Untitled Exam'}</b><br><small>Start: ${exam.start_time ? new Date(exam.start_time).toLocaleString() : 'N/A'}</small></span>
                    <button class="start-exam-btn" data-exam-id="${exam.id}">Start Exam</button>
                `;
                examList.appendChild(li);
            });
        })
        .catch(() => {
            examList.innerHTML = '<li style="color:red;">Failed to load exams.</li>';
        });

    // Listen for start exam button clicks
    examList.addEventListener('click', e => {
        if (e.target.classList.contains('start-exam-btn')) {
            const examId = e.target.getAttribute('data-exam-id');
            // Redirect to start page with examId as query param
            window.location.href = `/start.html?exam_id=${examId}`;
        }
    });
}); 