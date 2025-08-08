document.addEventListener('DOMContentLoaded', () => {
    const examList = document.getElementById('exam-list');

    // Fetch available exams from backend
    fetch('/api/active_exams')
        .then(res => res.json())
        .then(exams => {
            examList.innerHTML = '';
            if (!exams.length) {
                examList.innerHTML = '<li class="empty">No exams available. Please check back later.</li>';
                return;
            }
            exams.forEach(exam => {
                const start = exam.start_time ? new Date(exam.start_time) : null;
                const end = exam.end_time ? new Date(exam.end_time) : null;
                const li = document.createElement('li');
                li.className = 'exam-card';
                li.innerHTML = `
                    <div class="exam-title">${exam.title || 'Untitled Exam'}</div>
                    <div class="exam-meta">
                        ${start ? `<span class="badge">Starts: ${start.toLocaleString()}</span>` : ''}
                        ${end ? `<span class="badge">Ends: ${end.toLocaleString()}</span>` : ''}
                        ${exam.duration_minutes ? `<span class="badge">${exam.duration_minutes} min</span>` : ''}
                        ${exam.question_count ? `<span class="badge">${exam.question_count} Qs</span>` : ''}
                    </div>
                    <div class="actions">
                        <button class="start-exam-btn" data-exam-id="${exam.id}">Start Exam</button>
                    </div>
                `;
                examList.appendChild(li);
            });
        })
        .catch(() => {
            examList.innerHTML = '<li class="empty">Failed to load exams.</li>';
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