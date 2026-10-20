const API_BASE = '/api';

// Poll for task status
async function pollStatus() {
    try {
        const response = await fetch(`${API_BASE}/status`);
        const data = await response.json();
        renderTasks(data.tasks);
    } catch (error) {
        console.error('Polling failed:', error);
    }
}

function renderTasks(tasks) {
    const list = document.getElementById('task-list');
    if (!tasks || tasks.length === 0) {
        list.innerHTML = '<div class="empty-state">No tasks in queue</div>';
        return;
    }

    list.innerHTML = tasks.reverse().map(task => `
        <div class="task-item">
            <div class="task-info">
                <h4>${task.prompt.substring(0, 40)}${task.prompt.length > 40 ? '...' : ''}</h4>
                <p>${task.type} • ${task.modelName} • ${task.aspectRatio}</p>
            </div>
            <div class="badge ${task.status}">${task.status}</div>
        </div>
    `).join('');
}

// Handle Form Submission
document.getElementById('gen-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const request = {
        type: document.getElementById('type').value,
        prompt: document.getElementById('prompt').value,
        modelName: document.getElementById('model').value,
        aspectRatio: document.getElementById('ratio').value,
        resultCount: 1 // Default to 1 for demo
    };

    try {
        const response = await fetch(`${API_BASE}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
        });
        
        if (response.ok) {
            document.getElementById('prompt').value = '';
            pollStatus();
        }
    } catch (error) {
        alert('Failed to add task to queue');
    }
});

// Handle Cookie Update
document.getElementById('update-cookies').addEventListener('click', async () => {
    const raw = document.getElementById('cookies').value;
    try {
        const cookies = JSON.parse(raw);
        const response = await fetch(`${API_BASE}/auth/cookies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cookies })
        });
        
        if (response.ok) {
            alert('Cookies updated successfully');
            document.getElementById('cookies').value = '';
        }
    } catch (error) {
        alert('Invalid JSON or update failed');
    }
});

// Start polling
setInterval(pollStatus, 3000);
pollStatus();

// Settings Sync
async function loadSettings() {
    try {
        const response = await fetch(`${API_BASE}/settings`);
        const settings = await response.json();
        document.getElementById('headless-toggle').checked = settings.headless;
        document.getElementById('delay-speed').value = settings.delay;
    } catch (e) {}
}

async function updateSettings() {
    const settings = {
        headless: document.getElementById('headless-toggle').checked,
        delay: parseInt(document.getElementById('delay-speed').value)
    };
    await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
    });
}

document.getElementById('headless-toggle').addEventListener('change', updateSettings);
document.getElementById('delay-speed').addEventListener('change', updateSettings);

loadSettings();
