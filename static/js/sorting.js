const tableBody = document.querySelector('#results-table tbody');
const headers = document.querySelectorAll('#results-table th');
let allResults = [];
let sortDirection = {};

async function fetchAllResults() {
    const userId = localStorage.getItem('user_id'); 
    if (!userId) {
        //This should be handled more gracefully
        //For now, just redirect to start
        window.location.href = 'index.html';
        return;
    }

    try {
        const response = await fetch(`/get_user_results/${userId}`);
        allResults = await response.json();
        renderTable(allResults);
    } catch (error) {
        console.error('Error fetching all results:', error);
        alert('Failed to load results. Please try again.');
    }
}

function renderTable(data) {
    tableBody.innerHTML = '';
    data.forEach(result => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${result.score}</td>
            <td>${new Date(result.start_time).toLocaleString()}</td>
            <td>${result.average_time_per_question_seconds.toFixed(2)}</td>
            <td>${result.alt_tab_count}</td>
        `;
        tableBody.appendChild(row);
    });
}

function sortTable(key) {
    const direction = sortDirection[key] === 'asc' ? 'desc' : 'asc';
    sortDirection = { [key]: direction };

    allResults.sort((a, b) => {
        if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
        if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
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