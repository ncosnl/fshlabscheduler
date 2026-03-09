// ============================================================================
// HISTORY.JS — Reservation History Page (Teacher only)
// Fetches the teacher's own reservations across all labs and displays them
// with search, date filter, and status tabs.
// ============================================================================

const HISTORY_API_BASE = 'https://fsh-scheduler.medranowilljairuz.workers.dev';
const HISTORY_LABS = [
    'Computer Laboratory 1',
    'Computer Laboratory 2',
    'Biology Laboratory',
    'General Science Laboratory',
    'Physics Laboratory'
];

let allReservations   = [];
let historyFilter     = 'all';
let historySearchText = '';
let historySearchDate = '';

// ============================================================================
// FETCH
// ============================================================================

async function fetchAllMyReservations() {
    const token = localStorage.getItem('fsh_token');
    const email = localStorage.getItem('fsh_user_email');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const results = await Promise.all(
        HISTORY_LABS.map(lab =>
            fetch(`${HISTORY_API_BASE}/api/reservations?lab=${encodeURIComponent(lab)}`, { headers })
                .then(r => r.json())
                .catch(() => ({ success: false, reservations: [] }))
        )
    );

    const all = results.flatMap(r => r.success ? r.reservations : []);

    // Only this teacher's reservations, newest first
    return all
        .filter(r => r.requester === email)
        .sort((a, b) => b.date.localeCompare(a.date) || a.timeSlot.localeCompare(b.timeSlot));
}

// ============================================================================
// FILTER & SEARCH
// ============================================================================

function applyFilters(reservations) {
    let result = reservations;

    // Status tab filter
    if (historyFilter !== 'all') {
        result = result.filter(r => r.status === historyFilter);
    }

    // Text search: lab, subject, purpose
    if (historySearchText) {
        const q = historySearchText.toLowerCase();
        result = result.filter(r =>
            (r.lab     || '').toLowerCase().includes(q) ||
            (r.subject || '').toLowerCase().includes(q) ||
            (r.purpose || '').toLowerCase().includes(q)
        );
    }

    // Date filter
    if (historySearchDate) {
        result = result.filter(r => r.date === historySearchDate);
    }

    return result;
}

function setHistoryFilter(filter) {
    historyFilter = filter;
    document.querySelectorAll('.history-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.filter === filter);
    });
    refreshList();
}

function clearHistorySearch() {
    historySearchText = '';
    historySearchDate = '';

    const textInput = document.getElementById('history-search-text');
    const dateInput = document.getElementById('history-search-date');
    const clearBtn  = document.getElementById('history-clear-btn');

    if (textInput) textInput.value = '';
    if (dateInput) dateInput.value = '';
    if (clearBtn)  clearBtn.style.display = 'none';

    refreshList();
}

function refreshList() {
    const filtered = applyFilters(allReservations);
    renderHistory(filtered);
}

// ============================================================================
// RENDER — STATS
// ============================================================================

function renderStats(reservations) {
    const total    = reservations.length;
    const approved = reservations.filter(r => r.status === 'approved').length;
    const pending  = reservations.filter(r => r.status === 'pending').length;
    const declined = reservations.filter(r => r.status === 'declined').length;

    const container = document.getElementById('history-stats');
    if (!container) return;

    container.innerHTML = `
        <div class="history-stat-card">
            <div class="history-stat-value">${total}</div>
            <div class="history-stat-label">Total</div>
        </div>
        <div class="history-stat-card history-stat-approved">
            <div class="history-stat-value">${approved}</div>
            <div class="history-stat-label">Approved</div>
        </div>
        <div class="history-stat-card history-stat-pending">
            <div class="history-stat-value">${pending}</div>
            <div class="history-stat-label">Pending</div>
        </div>
        <div class="history-stat-card history-stat-declined">
            <div class="history-stat-value">${declined}</div>
            <div class="history-stat-label">Declined</div>
        </div>
    `;
}

function updateTabCounts(reservations) {
    document.getElementById('h-count-all').textContent      = reservations.length;
    document.getElementById('h-count-approved').textContent = reservations.filter(r => r.status === 'approved').length;
    document.getElementById('h-count-pending').textContent  = reservations.filter(r => r.status === 'pending').length;
    document.getElementById('h-count-declined').textContent = reservations.filter(r => r.status === 'declined').length;
}

// ============================================================================
// RENDER — HISTORY LIST
// ============================================================================

function renderHistory(reservations) {
    const container = document.getElementById('history-list');
    if (!container) return;

    if (reservations.length === 0) {
        const hasSearch = historySearchText || historySearchDate || historyFilter !== 'all';
        container.innerHTML = `
            <div class="history-empty">
                <i class="fas fa-${hasSearch ? 'search' : 'history'}"></i>
                <p>${hasSearch ? 'No reservations match your search.' : 'No reservations yet.'}</p>
            </div>`;
        return;
    }

    container.innerHTML = '';
    reservations.forEach(r => container.appendChild(createHistoryCard(r)));
}

function createHistoryCard(r) {
    const div = document.createElement('div');
    div.className = `history-item history-item--${r.status}`;

    const statusColors = { approved: '#22c55e', pending: '#f59e0b', declined: '#ef4444' };
    const color = statusColors[r.status] || '#707475';

    const dateObj       = new Date(r.date + 'T00:00:00');
    const formattedDate = dateObj.toLocaleDateString('en-US', {
        weekday: 'short', month: 'long', day: 'numeric', year: 'numeric'
    });

    div.innerHTML = `
        <div class="history-item-header">
            <div class="history-item-title">
                <i class="fas fa-flask history-lab-icon"></i>
                <h3>${r.lab}</h3>
            </div>
            <span class="history-status-badge"
                style="background:${color}20; color:${color}; border:1px solid ${color}40;">
                ${r.status}
            </span>
        </div>
        <div class="history-item-meta">
            <div class="history-meta-item">
                <i class="far fa-calendar"></i>
                <span>${formattedDate}</span>
            </div>
            <div class="history-meta-item">
                <i class="far fa-clock"></i>
                <span>${r.timeSlot}</span>
            </div>
            <div class="history-meta-item">
                <i class="fas fa-book"></i>
                <span>${r.subject}</span>
            </div>
            <div class="history-meta-item">
                <i class="fas fa-graduation-cap"></i>
                <span>Grade ${r.grade} &middot; ${r.students} students</span>
            </div>
        </div>
        ${r.purpose ? `<p class="history-item-purpose">${r.purpose}</p>` : ''}
        <div class="history-item-footer">
            <button class="history-view-btn"
                onclick="viewInLab('${encodeURIComponent(r.lab)}', '${r.date}')">
                <i class="fas fa-external-link-alt"></i> View in Lab
            </button>
        </div>
    `;

    return div;
}

// ============================================================================
// NAVIGATION
// ============================================================================

function viewInLab(labEncoded, date) {
    fshNavigate(`laboratory.html?lab=${labEncoded}&date=${date}&fromMail=true`);
}

function goBackToDashboard() {
    fshNavigate('dashboard.html');
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    const email = localStorage.getItem('fsh_user_email');
    const role  = localStorage.getItem('fsh_user_role');

    if (!email) { fshNavigate('index.html'); return; }
    if (role === 'Admin') { fshNavigate('dashboard.html'); return; }

    const userDisplay = document.getElementById('user-display');
    if (userDisplay) userDisplay.innerText = `${email.split('@')[0]} (${role})`;

    try {
        allReservations = await fetchAllMyReservations();
        renderStats(allReservations);
        updateTabCounts(allReservations);
        refreshList();
    } catch (err) {
        console.error('History load failed:', err);
        const list = document.getElementById('history-list');
        if (list) list.innerHTML = `
            <div class="history-empty">
                <i class="fas fa-exclamation-circle"></i>
                <p>Failed to load reservations. Please try again.</p>
            </div>`;
    }

    // ── Search event listeners ────────────────────────────────────────────────
    const searchText = document.getElementById('history-search-text');
    const searchDate = document.getElementById('history-search-date');
    const clearBtn   = document.getElementById('history-clear-btn');

    const updateClearBtn = () => {
        if (clearBtn) {
            clearBtn.style.display = (historySearchText || historySearchDate) ? 'flex' : 'none';
        }
    };

    let debounceTimer;
    searchText?.addEventListener('input', () => {
        historySearchText = searchText.value.trim();
        updateClearBtn();
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(refreshList, 200);
    });

    searchDate?.addEventListener('change', () => {
        historySearchDate = searchDate.value;
        updateClearBtn();
        refreshList();
    });
});

// ── Expose globals ────────────────────────────────────────────────────────────
window.setHistoryFilter   = setHistoryFilter;
window.clearHistorySearch = clearHistorySearch;
window.goBackToDashboard  = goBackToDashboard;
window.viewInLab          = viewInLab;
