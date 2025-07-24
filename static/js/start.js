document.getElementById('start-exam').addEventListener('click', async () => {
    const name = document.getElementById('name').value;
    if (!name) {
        alert('Please enter your name.');
        return;
    }

    try {
        const userResponse = await fetch('/register_user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name }),
        });
        const user = await userResponse.json();

        const examResponse = await fetch('/start_exam', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ user_id: user.id }),
        });
        const exam = await examResponse.json();

        localStorage.setItem('attempt_id', exam.id);
        localStorage.setItem('user_id', user.id);
        window.location.href = 'exam.html';
    } catch (error) {
        console.error('Error starting exam:', error);
        alert('Failed to start the exam. Please try again.');
    }
}); 