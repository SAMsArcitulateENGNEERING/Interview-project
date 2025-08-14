// Email validation function
function validateEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
}

// Phone validation function
function validatePhone(phone) {
    // Allow international format with +, digits, spaces, parentheses, and hyphens
    const phoneRegex = /^[\+]?[0-9\s\(\)\-]{7,}$/;
    return phoneRegex.test(phone);
}

// Check if email already exists
async function checkEmailExists(email) {
    try {
        const response = await fetch(`/api/check_email/${encodeURIComponent(email)}`);
        if (response.ok) {
            const result = await response.json();
            return result;
        }
    } catch (error) {
        console.error('Error checking email:', error);
    }
    return { exists: false };
}

document.getElementById('start-exam-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const examId = window.selectedExamId;
    const errorDiv = document.getElementById('start-error');

    // Clear previous errors
    errorDiv.textContent = '';

    // Validate inputs
    if (!name || !email || !phone || !examId) {
        errorDiv.textContent = 'Please fill in all required fields.';
        return;
    }

    // Validate email format
    if (!validateEmail(email)) {
        errorDiv.textContent = 'Please enter a valid email address.';
        return;
    }

    // Validate phone format
    if (!validatePhone(phone)) {
        errorDiv.textContent = 'Please enter a valid phone number (e.g., +1 555 123 4567 or 555-123-4567).';
        return;
    }

    // Check if email already exists
    const emailCheck = await checkEmailExists(email);
    if (emailCheck.exists) {
        // Email exists, show confirmation
        const confirmMessage = `Welcome back, ${emailCheck.user_name || 'User'}! Your email is already registered. Do you want to continue with this exam?`;
        if (!confirm(confirmMessage)) {
            return;
        }
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
            localStorage.setItem('user_email', email);
            localStorage.setItem('user_name', name);
            
            // Show success message if resuming
            if (result.message) {
                alert(result.message);
            }
            
            window.location.href = `/exam.html?attempt_id=${result.exam_attempt_id}&exam_id=${examId}`;
        } else {
            errorDiv.textContent = result.detail || 'Failed to start exam.';
        }
    } catch (error) {
        console.error('Error starting exam:', error);
        errorDiv.textContent = error.message || 'Failed to start the exam. Please try again.';
    }
});

// Real-time email validation
document.getElementById('email').addEventListener('blur', async function() {
    const email = this.value.trim();
    const errorDiv = document.getElementById('start-error');
    
    if (email && !validateEmail(email)) {
        errorDiv.textContent = 'Please enter a valid email address.';
        return;
    }
    
    if (email && validateEmail(email)) {
        try {
            const emailCheck = await checkEmailExists(email);
            if (emailCheck.exists) {
                errorDiv.textContent = `Welcome back, ${emailCheck.user_name || 'User'}! Your email is already registered.`;
                errorDiv.style.color = '#28a745'; // Green for welcome message
            } else {
                errorDiv.textContent = '';
            }
        } catch (error) {
            console.error('Error checking email:', error);
        }
    }
});

// Real-time phone validation
document.getElementById('phone').addEventListener('blur', function() {
    const phone = this.value.trim();
    const errorDiv = document.getElementById('start-error');
    
    if (phone && !validatePhone(phone)) {
        errorDiv.textContent = 'Please enter a valid phone number (e.g., +1 555 123 4567 or 555-123-4567).';
        errorDiv.style.color = '#dc3545'; // Red for error
    } else if (phone && validatePhone(phone)) {
        errorDiv.textContent = '';
    }
});

// Clear error when user starts typing
document.getElementById('name').addEventListener('input', function() {
    document.getElementById('start-error').textContent = '';
});

document.getElementById('email').addEventListener('input', function() {
    const errorDiv = document.getElementById('start-error');
    if (errorDiv.style.color === 'rgb(40, 167, 69)') {
        errorDiv.textContent = ''; // Clear welcome message
    }
}); 