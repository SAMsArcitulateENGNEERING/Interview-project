const tableBody = document.querySelector('#results-table tbody');
const headers = document.querySelectorAll('#results-table th');
let allResults = [];
let sortDirection = {};

async function fetchAllResults() {
    const userId = localStorage.getItem('user_id'); 
    if (!userId) {
        // Show a message instead of redirecting
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">No user ID found. Please start an exam first.</td></tr>';
        return;
    }

    try {
        const response = await fetch(`/get_user_results/${userId}`);
        if (!response.ok) {
            if (response.status === 404) {
                tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No exam results found for this user.</td></tr>';
                return;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        allResults = await response.json();
        
        if (allResults.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No exam results found.</td></tr>';
            return;
        }
        
        renderTable(allResults);
    } catch (error) {
        console.error('Error fetching all results:', error);
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">Failed to load results. Please try again.</td></tr>';
    }
}

function renderTable(data) {
    tableBody.innerHTML = '';
    data.forEach((result, index) => {
        const row = document.createElement('tr');
        
        // Calculate score if not already calculated
        let score = result.score;
        if (score === null || score === undefined) {
            score = 0;
            if (result.answered_questions) {
                score = result.answered_questions.filter(q => q.is_correct).length;
            }
        }
        
        // Calculate average time if not already calculated
        let avgTime = result.average_time_per_question_seconds;
        if (avgTime === null || avgTime === undefined) {
            avgTime = 0;
            if (result.answered_questions && result.answered_questions.length > 0) {
                const totalTime = result.answered_questions.reduce((sum, q) => sum + (q.time_taken_seconds || 0), 0);
                avgTime = totalTime / result.answered_questions.length;
            }
        }
        
        row.innerHTML = `
            <td>${score} / ${result.answered_questions ? result.answered_questions.length : 0}</td>
            <td>${new Date(result.start_time).toLocaleString()}</td>
            <td>${avgTime.toFixed(2)}s</td>
            <td>${result.alt_tab_count || 0}</td>
        `;
        tableBody.appendChild(row);
    });
}

function sortTable(key) {
    const direction = sortDirection[key] === 'asc' ? 'desc' : 'asc';
    sortDirection = { [key]: direction };

    allResults.sort((a, b) => {
        let aVal = a[key];
        let bVal = b[key];
        
        // Handle null/undefined values
        if (aVal === null || aVal === undefined) aVal = 0;
        if (bVal === null || bVal === undefined) bVal = 0;
        
        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    renderTable(allResults);
}

headers.forEach(header => {
    header.addEventListener('click', () => {
        const key = header.getAttribute('data-sort');
        if (key) {
            sortTable(key);
        }
    });
});

document.getElementById('host-view').addEventListener('click', () => {
    window.location.href = 'host.html';
});

window.onload = fetchAllResults; 