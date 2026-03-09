// ============================================================================
// ANALYTICS.JS — Admin Dashboard Analytics Card
// Only renders for Admin role. Fetches reservations across all labs and
// displays a live summary card above the lab grid.
// ============================================================================

const ANALYTICS_API_BASE = 'https://fsh-scheduler.medranowilljairuz.workers.dev';
const ANALYTICS_LABS = [
    'Computer Laboratory 1',
    'Computer Laboratory 2',
    'Biology Laboratory',
    'General Science Laboratory',
    'Physics Laboratory'
];

let analyticsInterval = null;

// ============================================================================
// FETCH
// ============================================================================

async function fetchAllReservations() {
    const token = localStorage.getItem('fsh_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const results = await Promise.all(
        ANALYTICS_LABS.map(lab =>
            fetch(`${ANALYTICS_API_BASE}/api/reservations?lab=${encodeURIComponent(lab)}`, { headers })
                .then(r => r.json())
                .catch(() => ({ success: false, reservations: [] }))
        )
    );

    return results.flatMap(r => r.success ? r.reservations : []);
}

// ============================================================================
// COMPUTE STATS
// ============================================================================

function computeStats(reservations) {
    const now       = new Date();
    const todayStr  = formatAnalyticsDate(now);

    // Week bounds (Sun–Sat)
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const thisWeek  = reservations.filter(r => {
        const d = new Date(r.date);
        return d >= weekStart && d <= weekEnd;
    });

    const pending   = reservations.filter(r => r.status === 'pending');
    const today     = reservations.filter(r => r.date === todayStr && r.status === 'approved');

    // Lab utilization: approved bookings this week per lab
    const labCounts = {};
    ANALYTICS_LABS.forEach(lab => { labCounts[lab] = 0; });
    thisWeek.filter(r => r.status === 'approved').forEach(r => {
        if (labCounts[r.lab] !== undefined) labCounts[lab] = (labCounts[r.lab] || 0) + 1;
    });

    // Sort labs by booking count descending
    const labsSorted = Object.entries(
        thisWeek.filter(r => r.status === 'approved').reduce((acc, r) => {
            acc[r.lab] = (acc[r.lab] || 0) + 1;
            return acc;
        }, {})
    ).sort((a, b) => b[1] - a[1]);

    // Most active lab this week
    const topLab = labsSorted[0]?.[0] ?? null;
    const topLabShort = topLab
        ? topLab.replace('Computer Laboratory', 'Comp. Lab').replace('Laboratory', 'Lab')
        : '—';

    // Approval rate (all time, non-pending)
    const decided  = reservations.filter(r => r.status !== 'pending');
    const approved = reservations.filter(r => r.status === 'approved');
    const approvalRate = decided.length > 0
        ? Math.round((approved.length / decided.length) * 100)
        : 0;

    return {
        weekTotal:    thisWeek.length,
        pendingCount: pending.length,
        todayCount:   today.length,
        approvalRate,
        topLabShort,
        topLab,
        labsSorted,
        weekStart,
        weekEnd,
    };
}

function formatAnalyticsDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// ============================================================================
// RENDER
// ============================================================================

function renderAnalyticsCard(stats) {
    const container = document.getElementById('analytics-section');
    if (!container) return;

    const weekLabel = `${stats.weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${stats.weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

    container.innerHTML = `
        <div class="analytics-card">
            <div class="analytics-header">
                <div class="analytics-title-group">
                    <span class="analytics-eyebrow">Admin Overview</span>
                    <h2 class="analytics-title">This Week <span class="analytics-week-label">${weekLabel}</span></h2>
                </div>
                <div class="analytics-live-dot" title="Live data"></div>
            </div>

            <div class="analytics-stats-grid">
                <div class="analytics-stat">
                    <div class="analytics-stat-value">${stats.weekTotal}</div>
                    <div class="analytics-stat-label">Total Bookings</div>
                </div>
                <div class="analytics-stat analytics-stat--warning ${stats.pendingCount > 0 ? 'analytics-stat--active' : ''}">
                    <div class="analytics-stat-value">
                        ${stats.pendingCount}
                        ${stats.pendingCount > 0 ? '<span class="analytics-ping"></span>' : ''}
                    </div>
                    <div class="analytics-stat-label">Pending Review</div>
                </div>
                <div class="analytics-stat">
                    <div class="analytics-stat-value">${stats.todayCount}</div>
                    <div class="analytics-stat-label">Approved Today</div>
                </div>
                <div class="analytics-stat">
                    <div class="analytics-stat-value">${stats.approvalRate}<span class="analytics-stat-unit">%</span></div>
                    <div class="analytics-stat-label">Approval Rate</div>
                </div>
            </div>

            ${stats.labsSorted.length > 0 ? `
            <div class="analytics-utilization">
                <div class="analytics-util-header">
                    <span>Lab Utilization This Week</span>
                    <span class="analytics-top-lab">
                        <i class="fas fa-trophy" style="color:#f59e0b; font-size:11px;"></i>
                        ${stats.topLabShort}
                    </span>
                </div>
                <div class="analytics-bars">
                    ${ANALYTICS_LABS.map(lab => {
                        const count = stats.labsSorted.find(([l]) => l === lab)?.[1] ?? 0;
                        const max   = stats.labsSorted[0]?.[1] ?? 1;
                        const pct   = max > 0 ? Math.round((count / max) * 100) : 0;
                        const short = lab.replace('Computer Laboratory', 'CL').replace(' Laboratory', '');
                        const isTop = lab === stats.topLab;
                        return `
                            <div class="analytics-bar-row">
                                <span class="analytics-bar-label ${isTop ? 'analytics-bar-label--top' : ''}">${short}</span>
                                <div class="analytics-bar-track">
                                    <div class="analytics-bar-fill ${isTop ? 'analytics-bar-fill--top' : ''}"
                                         style="width: ${pct}%"></div>
                                </div>
                                <span class="analytics-bar-count">${count}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            ` : `
            <div class="analytics-empty">
                <i class="fas fa-chart-bar"></i>
                <span>No bookings this week yet</span>
            </div>
            `}

            ${stats.pendingCount > 0 ? `
            <div class="analytics-cta">
                <span><i class="fas fa-clock"></i> ${stats.pendingCount} reservation${stats.pendingCount !== 1 ? 's' : ''} waiting for your review</span>
                <button onclick="fshNavigate('mail.html')" class="analytics-cta-btn">Review Now</button>
            </div>
            ` : ''}
        </div>
    `;

    // Animate bars in after render
    requestAnimationFrame(() => {
        document.querySelectorAll('.analytics-bar-fill').forEach(bar => {
            bar.style.transition = 'width 0.7s cubic-bezier(0.4, 0, 0.2, 1)';
        });
    });
}

function renderAnalyticsSkeleton() {
    const container = document.getElementById('analytics-section');
    if (!container) return;
    container.innerHTML = `
        <div class="analytics-card analytics-card--loading">
            <div class="analytics-skeleton analytics-skeleton--title"></div>
            <div class="analytics-stats-grid">
                ${[1,2,3,4].map(() => `
                    <div class="analytics-stat">
                        <div class="analytics-skeleton analytics-skeleton--value"></div>
                        <div class="analytics-skeleton analytics-skeleton--label"></div>
                    </div>
                `).join('')}
            </div>
            <div class="analytics-skeleton analytics-skeleton--bars"></div>
        </div>
    `;
}

// ============================================================================
// INIT
// ============================================================================

async function initAnalytics() {
    const role = localStorage.getItem('fsh_user_role');
    if (role !== 'Admin') return;

    // Section already exists in dashboard.html — just use it
    const section = document.getElementById('analytics-section');
    if (!section) return;

    renderAnalyticsSkeleton();

    // First load
    try {
        const reservations = await fetchAllReservations();
        const stats = computeStats(reservations);
        renderAnalyticsCard(stats);
    } catch (err) {
        console.error('Analytics load failed:', err);
        section.innerHTML = '';
    }

    // Refresh every 30 seconds
    analyticsInterval = setInterval(async () => {
        try {
            const reservations = await fetchAllReservations();
            const stats = computeStats(reservations);
            renderAnalyticsCard(stats);
        } catch { /* silent fail */ }
    }, 30000);

    window.addEventListener('beforeunload', () => {
        if (analyticsInterval) clearInterval(analyticsInterval);
    });
}

document.addEventListener('DOMContentLoaded', initAnalytics);