// ============================================================================
// TEACHER-CALENDAR.JS — Personal Reservation Calendar for Teachers
// Shows only on dashboard, only for Teacher role.
// Displays a compact monthly calendar with the teacher's own bookings
// highlighted. Clicking a booked date shows a detail popover.
// ============================================================================

const TC_API_BASE = 'https://fsh-scheduler.medranowilljairuz.workers.dev';
const TC_LABS = [
    'Computer Laboratory 1',
    'Computer Laboratory 2',
    'Biology Laboratory',
    'General Science Laboratory',
    'Physics Laboratory'
];

let tcMonth       = new Date().getMonth();
let tcYear        = new Date().getFullYear();
let tcReservations = [];   // teacher's own reservations (all labs)
let tcInterval    = null;

// ============================================================================
// FETCH
// ============================================================================

async function tcFetchMyReservations() {
    const token = localStorage.getItem('fsh_token');
    const email = localStorage.getItem('fsh_user_email');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const results = await Promise.all(
        TC_LABS.map(lab =>
            fetch(`${TC_API_BASE}/api/reservations?lab=${encodeURIComponent(lab)}`, { headers })
                .then(r => r.json())
                .catch(() => ({ success: false, reservations: [] }))
        )
    );

    const all = results.flatMap(r => r.success ? r.reservations : []);
    // Only keep this teacher's reservations
    return all.filter(r => r.requester === email);
}

// ============================================================================
// DATE HELPERS
// ============================================================================

function tcFormatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function tcFormatReadable(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
}

function tcGetReservationsForDate(dateStr) {
    return tcReservations.filter(r => r.date === dateStr);
}

function tcHasBooking(dateStr) {
    return tcReservations.some(r => r.date === dateStr);
}

function tcGetStatusColor(status) {
    return status === 'approved' ? '#22c55e'
         : status === 'declined' ? '#ef4444'
         : '#f59e0b';
}

// ============================================================================
// RENDER CALENDAR
// ============================================================================

const TC_MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
];
const TC_DAY_NAMES = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function tcRenderCalendar() {
    const grid = document.getElementById('tc-calendar-grid');
    const title = document.getElementById('tc-month-title');
    if (!grid || !title) return;

    title.textContent = `${TC_MONTH_NAMES[tcMonth]} ${tcYear}`;

    grid.innerHTML = '';

    // Day headers
    TC_DAY_NAMES.forEach(d => {
        const h = document.createElement('div');
        h.className = 'tc-day-header';
        h.textContent = d;
        grid.appendChild(h);
    });

    const firstDay   = new Date(tcYear, tcMonth, 1).getDay();
    const daysInMonth = new Date(tcYear, tcMonth + 1, 0).getDate();
    const today      = new Date();
    const todayStr   = tcFormatDate(today);

    // Empty cells
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'tc-day tc-day--empty';
        grid.appendChild(empty);
    }

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr  = tcFormatDate(new Date(tcYear, tcMonth, day));
        const bookings = tcGetReservationsForDate(dateStr);
        const isToday  = dateStr === todayStr;
        const hasBook  = bookings.length > 0;

        const cell = document.createElement('div');
        cell.className = 'tc-day' +
            (isToday  ? ' tc-day--today'   : '') +
            (hasBook  ? ' tc-day--booked'  : '');

        cell.innerHTML = `
            <span class="tc-day-num">${day}</span>
            ${hasBook ? `<div class="tc-dots">
                ${bookings.slice(0, 3).map(r =>
                    `<span class="tc-dot" style="background:${tcGetStatusColor(r.status)}"></span>`
                ).join('')}
            </div>` : ''}
        `;

        if (hasBook) {
            cell.onclick = () => tcShowPopover(dateStr, bookings, cell);
        }

        grid.appendChild(cell);
    }
}

// ============================================================================
// UPCOMING LIST
// ============================================================================

function tcRenderUpcoming() {
    const list = document.getElementById('tc-upcoming-list');
    if (!list) return;

    const today = tcFormatDate(new Date());
    const upcoming = tcReservations
        .filter(r => r.date >= today && r.status !== 'declined')
        .sort((a, b) => a.date.localeCompare(b.date) || a.timeSlot.localeCompare(b.timeSlot))
        .slice(0, 4);

    if (upcoming.length === 0) {
        list.innerHTML = `
            <div class="tc-empty">
                <i class="fas fa-calendar-check"></i>
                <span>No upcoming reservations</span>
            </div>`;
        return;
    }

    list.innerHTML = upcoming.map(r => {
        const statusColor = tcGetStatusColor(r.status);
        const labShort    = r.lab.replace('Computer Laboratory', 'CL').replace(' Laboratory', ' Lab');
        const dateObj     = new Date(r.date);
        const dayName     = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
        const dayNum      = dateObj.getDate();
        const monthName   = dateObj.toLocaleDateString('en-US', { month: 'short' });

        return `
            <div class="tc-upcoming-item" onclick="fshNavigate('laboratory.html?lab=${encodeURIComponent(r.lab)}&date=${r.date}&fromMail=false')">
                <div class="tc-upcoming-date">
                    <span class="tc-upcoming-day-name">${dayName}</span>
                    <span class="tc-upcoming-day-num">${dayNum}</span>
                    <span class="tc-upcoming-month">${monthName}</span>
                </div>
                <div class="tc-upcoming-info">
                    <div class="tc-upcoming-lab">${labShort}</div>
                    <div class="tc-upcoming-time">${r.timeSlot}</div>
                    <div class="tc-upcoming-subject">${r.subject} · Grade ${r.grade}</div>
                </div>
                <span class="tc-upcoming-status" style="background:${statusColor}20; color:${statusColor}; border:1px solid ${statusColor}40;">
                    ${r.status}
                </span>
            </div>
        `;
    }).join('');
}

// ============================================================================
// POPOVER
// ============================================================================

function tcShowPopover(dateStr, bookings, anchorEl) {
    // Remove any existing popover
    document.getElementById('tc-popover')?.remove();

    const popover = document.createElement('div');
    popover.id = 'tc-popover';
    popover.className = 'tc-popover';

    popover.innerHTML = `
        <div class="tc-popover-header">
            <span>${tcFormatReadable(dateStr)}</span>
            <button class="tc-popover-close" onclick="document.getElementById('tc-popover')?.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="tc-popover-body">
            ${bookings.map(r => {
                const statusColor = tcGetStatusColor(r.status);
                const labShort    = r.lab.replace('Computer Laboratory', 'CL').replace(' Laboratory', ' Lab');
                return `
                    <div class="tc-popover-item" style="border-left: 3px solid ${statusColor}">
                        <div class="tc-popover-item-top">
                            <strong>${labShort}</strong>
                            <span class="tc-popover-badge" style="background:${statusColor}20;color:${statusColor};border:1px solid ${statusColor}40;">
                                ${r.status}
                            </span>
                        </div>
                        <div class="tc-popover-item-time">
                            <i class="far fa-clock"></i> ${r.timeSlot}
                        </div>
                        <div class="tc-popover-item-detail">
                            <i class="fas fa-book"></i> ${r.subject} · Grade ${r.grade} · ${r.students} students
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    // Position relative to anchor
    document.body.appendChild(popover);
    const rect = anchorEl.getBoundingClientRect();
    const pw   = popover.offsetWidth;
    const ph   = popover.offsetHeight;

    let top  = rect.bottom + window.scrollY + 8;
    let left = rect.left + window.scrollX - pw / 2 + rect.width / 2;

    // Keep within viewport
    left = Math.max(12, Math.min(left, window.innerWidth - pw - 12));
    if (top + ph > window.scrollY + window.innerHeight - 12) {
        top = rect.top + window.scrollY - ph - 8;
    }

    popover.style.top  = `${top}px`;
    popover.style.left = `${left}px`;

    // Close on outside click
    setTimeout(() => {
        document.addEventListener('click', function handler(e) {
            if (!popover.contains(e.target)) {
                popover.remove();
                document.removeEventListener('click', handler);
            }
        });
    }, 0);
}

// ============================================================================
// NAVIGATION
// ============================================================================

function tcPrevMonth() {
    tcMonth--;
    if (tcMonth < 0) { tcMonth = 11; tcYear--; }
    tcRenderCalendar();
}

function tcNextMonth() {
    tcMonth++;
    if (tcMonth > 11) { tcMonth = 0; tcYear++; }
    tcRenderCalendar();
}

// ============================================================================
// SKELETON
// ============================================================================

function tcRenderSkeleton() {
    const section = document.getElementById('tc-section');
    if (!section) return;
    section.innerHTML = `
        <div class="tc-card tc-card--loading">
            <div class="tc-skeleton tc-skeleton--title"></div>
            <div class="tc-body">
                <div class="tc-skeleton tc-skeleton--calendar"></div>
                <div class="tc-skeleton tc-skeleton--upcoming"></div>
            </div>
        </div>
    `;
}

// ============================================================================
// FULL RENDER
// ============================================================================

function tcRenderFull() {
    const section = document.getElementById('tc-section');
    if (!section) return;

    section.innerHTML = `
        <div class="tc-card">
            <div class="tc-card-header">
                <div class="tc-card-title-group">
                    <span class="tc-eyebrow">My Schedule</span>
                    <h2 class="tc-title">Personal Calendar</h2>
                </div>
                <a href="mail.html" class="tc-view-all">
                    View all <i class="fas fa-arrow-right"></i>
                </a>
            </div>

            <div class="tc-body">
                <!-- Left: Mini calendar -->
                <div class="tc-calendar-wrap">
                    <div class="tc-cal-nav">
                        <button class="tc-nav-btn" onclick="tcPrevMonth()">
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <span id="tc-month-title" class="tc-month-title"></span>
                        <button class="tc-nav-btn" onclick="tcNextMonth()">
                            <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                    <div id="tc-calendar-grid" class="tc-calendar-grid"></div>
                    <div class="tc-legend">
                        <span class="tc-legend-item"><span class="tc-dot" style="background:#22c55e"></span> Approved</span>
                        <span class="tc-legend-item"><span class="tc-dot" style="background:#f59e0b"></span> Pending</span>
                        <span class="tc-legend-item"><span class="tc-dot" style="background:#ef4444"></span> Declined</span>
                    </div>
                </div>

                <!-- Right: Upcoming list -->
                <div class="tc-upcoming-wrap">
                    <div class="tc-upcoming-header">
                        <i class="fas fa-clock"></i> Upcoming Reservations
                    </div>
                    <div id="tc-upcoming-list"></div>
                </div>
            </div>
        </div>
    `;

    tcRenderCalendar();
    tcRenderUpcoming();
}

// ============================================================================
// INIT
// ============================================================================

async function initTeacherCalendar() {
    const role = localStorage.getItem('fsh_user_role');
    if (role !== 'Teacher') return;

    // Inject section between the h1 header and the lab grid
    const mainContent = document.querySelector('.main-content');
    const labGrid     = document.querySelector('.lab-grid');
    if (!mainContent || !labGrid) return;

    const section = document.createElement('div');
    section.id = 'tc-section';
    // Insert before analytics section if present, otherwise before lab grid
    const analyticsSec = document.getElementById('analytics-section');
    mainContent.insertBefore(section, analyticsSec || labGrid);

    tcRenderSkeleton();

    try {
        tcReservations = await tcFetchMyReservations();
        tcRenderFull();
    } catch (err) {
        console.error('Teacher calendar load failed:', err);
        section.innerHTML = '';
    }

    // Refresh every 30 seconds
    tcInterval = setInterval(async () => {
        try {
            tcReservations = await tcFetchMyReservations();
            tcRenderCalendar();
            tcRenderUpcoming();
        } catch { /* silent */ }
    }, 30000);

    window.addEventListener('beforeunload', () => {
        if (tcInterval) clearInterval(tcInterval);
    });
}

document.addEventListener('DOMContentLoaded', initTeacherCalendar);

// Expose nav for inline onclick
window.tcPrevMonth = tcPrevMonth;
window.tcNextMonth = tcNextMonth;
