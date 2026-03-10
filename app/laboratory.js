// ============================================================================
// LABORATORY.JS - Calendar & Reservation Management
// Uses Cloudflare Worker API for real-time sync across users
// ============================================================================

const API_BASE = 'https://fsh-scheduler.medranowilljairuz.workers.dev';

// Global state
let currentMonth    = new Date().getMonth();
let currentYear     = new Date().getFullYear();
let currentDay      = new Date();
let currentWeekStart = null;
let calendarView    = 'monthly';
let selectedDate    = null;
let selectedTimeSlot = null;
let currentLab      = '';
let reservationsCache = [];
let pollingInterval = null;
let adminSelectedDate = null;

// Multi-schedule state
let multiScheduleMode = false;
let scheduleQueue     = []; // [{ date, timeSlot }]

// Time slots available for reservation
const TIME_SLOTS = [
    '07:00 AM - 08:00 AM',
    '08:00 AM - 09:00 AM',
    '09:00 AM - 10:00 AM',
    '10:00 AM - 11:00 AM',
    '11:00 AM - 12:00 PM',
    '01:00 PM - 02:00 PM',
    '02:00 PM - 03:00 PM',
    '03:00 PM - 04:00 PM',
    '04:00 PM - 05:00 PM',
    '05:00 PM - 06:00 PM'
];

// ============================================================================
// API HELPER
// ============================================================================

function getToken() { return localStorage.getItem('fsh_token'); }

async function apiCall(endpoint, method = 'GET', body = null) {
    const token   = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(`${API_BASE}${endpoint}`, options);
    return res.json();
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentLab = urlParams.get('lab') || 'Laboratory';

    document.title = `${currentLab} - FSH Lab Scheduler`;

    const email = localStorage.getItem('fsh_user_email');
    const role  = localStorage.getItem('fsh_user_role');

    if (!email) { fshNavigate('index.html'); return; }

    // Update user display
    const userDisplay = document.getElementById('user-display');
    if (userDisplay) userDisplay.innerText = `${email.split('@')[0]} (${role})`;

    // Initial load
    await fetchReservations();

    // Initialize UI based on role
    if (role === 'Admin') {
        initializeAdminView();
    } else {
        initializeUserView();
    }

    showCalendarView('monthly');

    // Start polling every 5 seconds for real-time updates
    startPolling();

    // Handle redirect from mail page
    const fromMail    = urlParams.get('fromMail');
    const targetDate  = urlParams.get('date');
    const targetSlot  = urlParams.get('timeSlot');
    if (fromMail === 'true' && targetDate) {
        setTimeout(() => highlightDateFromMail(targetDate, targetSlot), 300);
    }
});

// ============================================================================
// POLLING — fetches reservations every 5s for real-time sync
// ============================================================================

function startPolling() {
    pollingInterval = setInterval(async () => {
        await fetchReservations();
        renderCalendar();

        const role = localStorage.getItem('fsh_user_role');
        if (role === 'Admin') {
            if (adminSelectedDate) {
                const dayReservations = reservationsCache.filter(r => r.date === adminSelectedDate && r.lab === currentLab);
                showAdminDayReservations(adminSelectedDate, dayReservations);
            } else {
                renderReservationsList();
            }
        } else {
            renderTimeSlots();
            renderMyReservations();
        }
    }, 5000);
}

function stopPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
}

// ============================================================================
// DATA — fetch from Worker/D1
// ============================================================================

async function fetchReservations() {
    try {
        const data = await apiCall(`/api/reservations?lab=${encodeURIComponent(currentLab)}`);
        if (data.success) {
            reservationsCache = data.reservations;
        }
    } catch (err) {
        console.error('Failed to fetch reservations:', err);
    }
}

function getAllReservations() {
    return reservationsCache;
}

function hasReservations(date) {
    const role = localStorage.getItem('fsh_user_role');
    if (role === 'Admin') {
        return reservationsCache.some(r => r.date === date && r.lab === currentLab);
    } else {
        return reservationsCache.some(r =>
            r.date === date && r.lab === currentLab && r.status === 'approved'
        );
    }
}

function isSlotReserved(date, timeSlot) {
    return reservationsCache.some(r =>
        r.date === date &&
        r.timeSlot === timeSlot &&
        r.lab === currentLab &&
        (r.status === 'approved' || r.status === 'pending')
    );
}

// ============================================================================
// EDIT MODAL — TIME SLOT HELPERS
// Returns HTML <option> elements for a given date, excluding a reservation ID
// ============================================================================

function buildTimeSlotOptions(selectedSlot, forDate, excludeReservationId) {
    return TIME_SLOTS.map(slot => {
        const isTaken = reservationsCache.some(r =>
            r.id !== excludeReservationId &&
            r.date === forDate &&
            r.timeSlot === slot &&
            r.lab === currentLab &&
            (r.status === 'approved' || r.status === 'pending')
        );
        const isSelected = slot === selectedSlot;
        return `<option value="${slot}" ${isSelected ? 'selected' : ''} ${isTaken ? 'disabled' : ''}>
            ${slot}${isTaken ? ' (Taken)' : ''}
        </option>`;
    }).join('');
}

// Re-renders the time slot <select> inside the edit modal when the date changes
function refreshEditModalTimeSlots(selectEl, dateInputEl, excludeReservationId) {
    const currentVal = selectEl.value;
    selectEl.innerHTML = buildTimeSlotOptions(currentVal, dateInputEl.value, excludeReservationId);
}

// ============================================================================
// USER VIEW (Teachers)
// ============================================================================

function initializeUserView() {
    document.getElementById('user-view')?.classList.remove('hidden');
    document.getElementById('admin-view')?.classList.add('hidden');

    document.getElementById('calendar-title').textContent = 'Select Date';
    document.getElementById('lab-subtitle').style.display = 'block';
    document.getElementById('user-calendar-controls').style.display  = 'flex';
    document.getElementById('admin-calendar-controls').style.display = 'none';

    renderModeBanner();
    renderTimeSlots();
    renderMyReservations();

    document.getElementById('reservation-form')
        ?.addEventListener('submit', handleReservationSubmit);
}

// ============================================================================
// MODE BANNER
// ============================================================================

function renderModeBanner() {
    const banner = document.getElementById('mode-banner');
    if (!banner) return;

    banner.innerHTML = `
        <div class="mode-banner ${multiScheduleMode ? 'multi-active' : ''}" id="mode-banner-card">
            <div class="mode-banner-left">
                <div class="mode-banner-icon">
                    <i class="fas ${multiScheduleMode ? 'fa-layer-group' : 'fa-calendar-check'}"></i>
                </div>
                <div class="mode-banner-text">
                    <div class="mode-banner-title">
                        ${multiScheduleMode ? 'Multi-Schedule Mode' : 'Single Reservation Mode'}
                        <span class="mode-banner-badge">${multiScheduleMode ? 'Multi' : 'Single'}</span>
                    </div>
                    <div class="mode-banner-desc">
                        ${multiScheduleMode
                            ? 'Pick as many dates &amp; time slots as you need, then submit them all at once.'
                            : 'Select one date and time slot to make a single reservation.'}
                    </div>
                </div>
            </div>
            <div class="mode-toggle-wrap">
                <label class="mode-toggle-label-text" for="mode-toggle-input">Multi-Schedule</label>
                <label class="mode-toggle-switch" title="Toggle Multi-Schedule Mode">
                    <input type="checkbox" id="mode-toggle-input"
                        ${multiScheduleMode ? 'checked' : ''}
                        onchange="toggleMultiScheduleMode()">
                    <span class="mode-toggle-track"></span>
                </label>
            </div>
        </div>
    `;
}

function toggleMultiScheduleMode() {
    multiScheduleMode = !multiScheduleMode;

    // Clear any current selection when switching modes
    selectedDate     = null;
    selectedTimeSlot = null;
    scheduleQueue    = [];

    document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('selected'));

    renderModeBanner();
    renderTimeSlots();
    renderQueuePanel();
    updateFormState();
}

// ============================================================================
// QUEUE PANEL
// ============================================================================

function renderQueuePanel() {
    const panel = document.getElementById('schedule-queue-panel');
    if (!panel) return;

    if (!multiScheduleMode) {
        panel.style.display = 'none';
        panel.innerHTML = '';
        return;
    }

    panel.style.display = 'block';
    panel.innerHTML = `
        <div class="queue-panel">
            <div class="queue-panel-header">
                <div class="queue-panel-title">
                    <i class="fas fa-list-check"></i>
                    Queued Slots
                    <span class="queue-count-pill" id="queue-count-pill">${scheduleQueue.length}</span>
                </div>
            </div>
            <div id="queue-list-container">
                ${renderQueueItems()}
            </div>
        </div>
    `;
}

function renderQueueItems() {
    if (scheduleQueue.length === 0) {
        return `
            <div class="queue-hint">
                <i class="fas fa-calendar-plus"></i>
                <span>Select a date, then tap any time slot to add it to the queue.</span>
            </div>`;
    }

    return `<div class="queue-list">
        ${scheduleQueue.map((s, i) => `
            <div class="queue-item">
                <div class="queue-item-num">${i + 1}</div>
                <div class="queue-item-info">
                    <div class="queue-item-date">${formatDate(s.date)}</div>
                    <div class="queue-item-time"><i class="far fa-clock" style="margin-right:4px;"></i>${s.timeSlot}</div>
                </div>
                <button class="queue-remove-btn" onclick="removeFromQueue(${i})" title="Remove">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('')}
    </div>`;
}

function refreshQueuePanel() {
    const pill      = document.getElementById('queue-count-pill');
    const container = document.getElementById('queue-list-container');
    if (pill)      pill.textContent    = scheduleQueue.length;
    if (container) container.innerHTML = renderQueueItems();
}



function removeFromQueue(index) {
    scheduleQueue.splice(index, 1);
    refreshQueuePanel();
    updateFormState();
}

function showInlineToast(msg, type = 'info') {
    const existing = document.getElementById('inline-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'inline-toast';
    const bg = type === 'warn' ? '#f59e0b' : '#081316';
    toast.style.cssText = `
        position:fixed; bottom:28px; left:50%; transform:translateX(-50%);
        background:${bg}; color:white; padding:11px 22px; border-radius:50px;
        font-size:13px; font-weight:500; z-index:9999;
        box-shadow:0 4px 16px rgba(0,0,0,0.2); white-space:nowrap;
        animation:slideUp 0.2s ease; font-family:inherit;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function renderTimeSlots() {
    const container = document.getElementById('time-slots');
    if (!container) return;

    container.innerHTML = '';

    TIME_SLOTS.forEach(slot => {
        const slotEl = document.createElement('div');
        slotEl.className = 'time-slot';

        const isReserved = selectedDate && isSlotReserved(selectedDate, slot);
        const isQueued   = multiScheduleMode && selectedDate &&
                           scheduleQueue.some(s => s.date === selectedDate && s.timeSlot === slot);

        if (isReserved) {
            slotEl.classList.add('reserved');
            slotEl.innerHTML = `${slot} <span style="font-size:11px;color:#ef4444;">(Reserved)</span>`;
            slotEl.style.cursor  = 'not-allowed';
            slotEl.style.opacity = '0.6';
        } else if (isQueued) {
            slotEl.classList.add('queued');
            slotEl.innerHTML = `${slot} <i class="fas fa-check" style="font-size:11px;margin-left:5px;"></i>`;
            slotEl.onclick = () => selectTimeSlot(slot, slotEl);
        } else {
            slotEl.textContent = slot;
            slotEl.onclick = () => selectTimeSlot(slot, slotEl);
        }

        container.appendChild(slotEl);
    });
}

function selectTimeSlot(slot, element) {
    if (!selectedDate) { alert('Please select a date first'); return; }

    if (isSlotReserved(selectedDate, slot)) {
        alert('This time slot is already reserved. Please choose another time slot.');
        return;
    }

    if (multiScheduleMode) {
        // Instant toggle: click to queue, click again to remove
        const existingIdx = scheduleQueue.findIndex(s => s.date === selectedDate && s.timeSlot === slot);
        if (existingIdx >= 0) {
            scheduleQueue.splice(existingIdx, 1);
        } else {
            scheduleQueue.push({ date: selectedDate, timeSlot: slot });
        }
        renderTimeSlots();
        refreshQueuePanel();
        updateFormState();
        return;
    }

    // Single mode — normal behaviour
    document.querySelectorAll('.time-slot').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    selectedTimeSlot = slot;
    updateFormState();
}

async function handleReservationSubmit(e) {
    e.preventDefault();

    if (multiScheduleMode) {
        await handleBatchSubmit();
        return;
    }

    if (!selectedDate || !selectedTimeSlot) {
        alert('Please select both date and time slot');
        return;
    }

    // Re-check conflict with latest data before submitting
    await fetchReservations();
    if (isSlotReserved(selectedDate, selectedTimeSlot)) {
        alert('This time slot was just reserved by someone else. Please select a different time slot.');
        renderTimeSlots();
        selectedTimeSlot = null;
        updateFormState();
        return;
    }

    const submitBtn = document.getElementById('submit-reservation');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting...'; }

    try {
        const data = await apiCall('/api/reservations', 'POST', {
            lab:         currentLab,
            date:        selectedDate,
            timeSlot:    selectedTimeSlot,
            teacherName: document.getElementById('teacher-name').value,
            subject:     document.getElementById('subject').value,
            grade:       document.getElementById('grade').value,
            students:    document.getElementById('students').value,
            purpose:     document.getElementById('purpose').value
        });

        if (!data.success) {
            alert(data.message);
            return;
        }

        alert('✅ Reservation submitted successfully!\n\nYour request has been sent to the administrator for approval.');
        resetReservationForm();
        await fetchReservations();
        renderCalendar();

    } catch (err) {
        alert('Error: ' + (err.message || 'Could not reach the server.'));
        console.error(err);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = !selectedDate || !selectedTimeSlot;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Reservation';
        }
    }
}

// ============================================================================
// BATCH SUBMIT
// ============================================================================

async function handleBatchSubmit() {
    if (scheduleQueue.length === 0) {
        showInlineToast('Add at least one slot to the queue before submitting.', 'warn');
        return;
    }

    const teacherName = document.getElementById('teacher-name').value.trim();
    const subject     = document.getElementById('subject').value;
    const grade       = document.getElementById('grade').value;
    const students    = document.getElementById('students').value;
    const purpose     = document.getElementById('purpose').value.trim();

    if (!teacherName || !subject || !grade || !students || !purpose) {
        alert('Please fill in all reservation details before submitting.');
        return;
    }

    const submitBtn = document.getElementById('submit-reservation');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    }

    try {
        const data = await apiCall('/api/reservations/batch', 'POST', {
            lab:         currentLab,
            slots:       scheduleQueue.map(s => ({ date: s.date, timeSlot: s.timeSlot })),
            teacherName, subject, grade, students, purpose
        });

        showBatchResultModal(data.results || []);

        scheduleQueue    = [];
        selectedDate     = null;
        selectedTimeSlot = null;
        document.getElementById('reservation-form')?.reset();
        document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('selected'));
        renderTimeSlots();
        renderQueuePanel();
        updateFormState();
        await fetchReservations();
        renderCalendar();

    } catch (err) {
        alert('Error: ' + (err.message || 'Could not reach the server.'));
        console.error(err);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = scheduleQueue.length === 0;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Reservations';
        }
    }
}

function showBatchResultModal(results) {
    const succeeded = results.filter(r => r.success);
    const failed    = results.filter(r => !r.success);

    const successRows = succeeded.map(r => `
        <div class="batch-result-item success">
            <div class="batch-result-item-date">${formatDate(r.date)}</div>
            <div class="batch-result-item-time"><i class="far fa-clock" style="margin-right:4px;"></i>${r.timeSlot}</div>
        </div>`).join('');

    const failRows = failed.map(r => `
        <div class="batch-result-item fail">
            <div class="batch-result-item-date">${formatDate(r.date)}</div>
            <div class="batch-result-item-time"><i class="far fa-clock" style="margin-right:4px;"></i>${r.timeSlot}</div>
            <div class="batch-result-item-reason">${r.message || 'Conflict or error'}</div>
        </div>`).join('');

    document.body.insertAdjacentHTML('beforeend', `
        <div class="batch-modal-overlay" id="batch-modal-overlay">
            <div class="batch-modal">
                <div class="batch-modal-header">
                    <h3><i class="fas fa-layer-group" style="margin-right:8px;"></i>Batch Submission Results</h3>
                    <button class="batch-modal-close" onclick="closeBatchResultModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="batch-modal-body">
                    <div class="batch-summary-grid">
                        <div class="batch-summary-stat success">
                            <div class="batch-summary-num">${succeeded.length}</div>
                            <div class="batch-summary-lbl">Submitted</div>
                        </div>
                        <div class="batch-summary-stat fail">
                            <div class="batch-summary-num">${failed.length}</div>
                            <div class="batch-summary-lbl">Failed</div>
                        </div>
                    </div>
                    ${succeeded.length > 0 ? `
                        <div class="batch-result-section-title">
                            <i class="fas fa-check-circle" style="color:#22c55e;"></i> Submitted
                        </div>
                        <div class="batch-result-list">${successRows}</div>` : ''}
                    ${failed.length > 0 ? `
                        <div class="batch-result-section-title">
                            <i class="fas fa-times-circle" style="color:#ef4444;"></i> Failed
                        </div>
                        <div class="batch-result-list">${failRows}</div>` : ''}
                </div>
                <div class="batch-modal-footer">
                    <button class="batch-done-btn" onclick="closeBatchResultModal()">Done</button>
                </div>
            </div>
        </div>
    `);
}

function closeBatchResultModal() {
    document.getElementById('batch-modal-overlay')?.remove();
}

function resetReservationForm() {
    document.getElementById('reservation-form')?.reset();
    selectedDate     = null;
    selectedTimeSlot = null;
    document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.time-slot').forEach(el => el.classList.remove('selected'));
    updateFormState();
}

// ============================================================================
// MY RESERVATIONS — teacher can view and edit their own reservations
// ============================================================================

function renderMyReservations() {
    const userEmail = localStorage.getItem('fsh_user_email');
    const myReservations = reservationsCache
        .filter(r => r.lab === currentLab && r.requester === userEmail)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    // Create or find the my-reservations section
    let section = document.getElementById('my-reservations-section');
    if (!section) {
        section = document.createElement('div');
        section.id = 'my-reservations-section';
        section.className = 'reservation-form';
        section.style.marginTop = '20px';
        document.getElementById('user-view')?.appendChild(section);
    }

    if (myReservations.length === 0) {
        section.innerHTML = '';
        return;
    }

    section.innerHTML = `
        <h3 style="margin-bottom: 16px;"><i class="fas fa-history"></i> My Reservations</h3>
        <div id="my-reservations-list"></div>
    `;

    const list = document.getElementById('my-reservations-list');
    myReservations.forEach(r => {
        const canEdit = r.status === 'pending' || r.status === 'approved';
        const statusColor = r.status === 'approved' ? '#22c55e' : r.status === 'declined' ? '#ef4444' : '#f59e0b';

        const item = document.createElement('div');
        item.style.cssText = `
            background: var(--hover-bg); border-radius: 12px; padding: 16px;
            margin-bottom: 12px; border-left: 4px solid ${statusColor}; overflow: hidden;
        `;
        item.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:10px;">
                <div>
                    <p style="font-weight:600; margin-bottom:4px; color:var(--text-color);">
                        <i class="far fa-calendar" style="margin-right:6px;"></i>${formatDate(r.date)}
                    </p>
                    <p style="font-size:13px; color:var(--secondary-text); margin-bottom:2px;">
                        <i class="far fa-clock" style="margin-right:6px;"></i>${r.timeSlot}
                    </p>
                    <p style="font-size:13px; color:var(--secondary-text); margin-bottom:2px;">
                        <i class="fas fa-book" style="margin-right:6px;"></i>${r.subject} — Grade ${r.grade}
                    </p>
                    <p style="font-size:13px; color:var(--secondary-text);">
                        <i class="fas fa-users" style="margin-right:6px;"></i>${r.students} students
                    </p>
                </div>
                <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; min-width:0;">
                    <span style="padding:4px 12px; border-radius:20px; font-size:11px; font-weight:600;
                        background:${statusColor}; color:white; text-transform:uppercase; flex-shrink:0;">${r.status}</span>
                    ${canEdit ? `
                        <div style="display:flex; align-items:center; gap:8px; min-width:0;">
                            ${r.status === 'approved' ? `
                            <span style="font-size:11px; color:var(--secondary-text); line-height:1.3; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Will require re-approval</span>` : ''}
                            <button onclick="openEditModal('${r.id}')" style="
                                background:#081316; color:white; border:none; border-radius:20px;
                                padding:6px 14px; font-size:12px; cursor:pointer; display:flex;
                                align-items:center; gap:6px; transition:all 0.2s; flex-shrink:0;">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        list.appendChild(item);
    });
}

function openEditModal(reservationId) {
    const r = reservationsCache.find(r => r.id === reservationId);
    if (!r) return;

    document.getElementById('edit-reservation-modal')?.remove();
    document.body.style.overflow = 'hidden';

    // Build time slot options for the reservation's current date
    const timeSlotOptionsHtml = buildTimeSlotOptions(r.timeSlot, r.date, reservationId);

    const modal = document.createElement('div');
    modal.id = 'edit-reservation-modal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); z-index: 2000;
        display: flex; align-items: center; justify-content: center;
        padding: 20px; box-sizing: border-box; overflow-y: auto;
    `;

    modal.innerHTML = `
        <div style="
            background: var(--card-bg); border-radius: 20px; width: 100%;
            max-width: 700px; box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            overflow-y: auto; max-height: 90vh; margin: auto;
        ">
            <div style="
                background: linear-gradient(135deg, #081316 0%, #2a3a3f 100%);
                padding: 20px 25px;
                display: flex; justify-content: space-between; align-items: center;
            ">
                <h2 style="color:white; margin:0; font-size:1.1rem; font-weight:600;">
                    <i class="fas fa-edit" style="margin-right:8px;"></i>Edit Reservation
                </h2>
                <button onclick="closeEditModal()" style="
                    background: rgba(255,255,255,0.2); border: none; color: white;
                    width: 28px; height: 28px; border-radius: 50%; cursor: pointer;
                    font-size: 14px; display: flex; align-items: center; justify-content: center;
                "><i class="fas fa-times"></i></button>
            </div>
            <form id="edit-reservation-form" style="padding: 20px; display:flex; flex-direction:column; gap:14px;">
                <div>
                    <label style="font-size:13px; font-weight:500; color:var(--secondary-text); display:block; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.5px;">Date</label>
                    <input type="date" id="edit-date" class="login-input" value="${r.date}" required
                        min="${new Date().toISOString().split('T')[0]}" style="margin:0;">
                </div>
                <div>
                    <label style="font-size:13px; font-weight:500; color:var(--secondary-text); display:block; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.5px;">
                        Time Slot
                        <span style="font-weight:400; text-transform:none; font-size:11px; color:#f59e0b; margin-left:6px;">
                            <i class="fas fa-circle-info"></i> Taken slots are disabled
                        </span>
                    </label>
                    <select id="edit-timeslot" class="login-input" required style="margin:0;">
                        ${timeSlotOptionsHtml}
                    </select>
                </div>
                <div>
                    <label style="font-size:13px; font-weight:500; color:var(--secondary-text); display:block; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.5px;">Teacher's Name</label>
                    <input type="text" id="edit-teacher-name" class="login-input" value="${r.teacherName || ''}" required style="margin:0;">
                </div>
                <div>
                    <label style="font-size:13px; font-weight:500; color:var(--secondary-text); display:block; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.5px;">Subject</label>
                    <select id="edit-subject" class="login-input" required style="margin:0;">
                        <option value="">Select subject</option>
                        ${['General Biology','Physics','Chemistry','ETECH'].map(s =>
                            `<option value="${s}" ${s === r.subject ? 'selected' : ''}>${s}</option>`
                        ).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:13px; font-weight:500; color:var(--secondary-text); display:block; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.5px;">Grade Level</label>
                    <select id="edit-grade" class="login-input" required style="margin:0;">
                        <option value="">Select grade level</option>
                        <option value="11" ${r.grade == '11' ? 'selected' : ''}>Grade 11</option>
                        <option value="12" ${r.grade == '12' ? 'selected' : ''}>Grade 12</option>
                    </select>
                </div>
                <div>
                    <label style="font-size:13px; font-weight:500; color:var(--secondary-text); display:block; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.5px;">Number of Students</label>
                    <input type="number" id="edit-students" class="login-input" value="${r.students}" required min="1" max="50" style="margin:0;">
                </div>
                <div>
                    <label style="font-size:13px; font-weight:500; color:var(--secondary-text); display:block; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.5px;">Purpose / Activity</label>
                    <textarea id="edit-purpose" class="login-input" required style="margin:0; min-height:80px; resize:vertical; font-family:inherit;">${r.purpose}</textarea>
                </div>
                ${r.status === 'approved' ? `
                <div style="background:rgba(245,158,11,0.1); border:1px solid #f59e0b; border-radius:10px;
                    padding:10px 14px; font-size:13px; color:#b45309; display:flex; gap:8px; align-items:flex-start;">
                    <i class="fas fa-exclamation-triangle" style="flex-shrink:0; margin-top:2px;"></i>
                    <span>Saving will reset this reservation to <strong>pending</strong> status and require admin re-approval.</span>
                </div>` : ''}
                <div style="display:flex; gap:10px; padding-top:4px;">
                    <button type="button" onclick="closeEditModal()" style="
                        flex:1; padding:11px; border-radius:50px; cursor:pointer;
                        background:transparent; color:var(--secondary-text);
                        border:1px solid var(--secondary-text); font-size:14px; font-weight:500;
                    ">Cancel</button>
                    <button type="submit" id="edit-submit-btn" style="
                        flex:1; padding:11px; border-radius:50px; cursor:pointer;
                        background:#081316; color:white; border:none;
                        font-size:14px; font-weight:500; display:flex;
                        align-items:center; justify-content:center; gap:8px;
                    "><i class="fas fa-save"></i> Save Changes</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeEditModal(); });

    // Re-render time slot options whenever the date changes
    const dateInput     = document.getElementById('edit-date');
    const timeslotSelect = document.getElementById('edit-timeslot');
    dateInput.addEventListener('change', () => {
        refreshEditModalTimeSlots(timeslotSelect, dateInput, reservationId);
    });

    document.getElementById('edit-reservation-form').addEventListener('submit', e => {
        handleEditSubmit(e, reservationId);
    });
}

function closeEditModal() {
    document.getElementById('edit-reservation-modal')?.remove();
    document.body.style.overflow = '';
}

async function handleEditSubmit(e, reservationId) {
    e.preventDefault();

    const newDate     = document.getElementById('edit-date').value;
    const newTimeSlot = document.getElementById('edit-timeslot').value;

    // Check for conflicts (excluding this reservation itself)
    const conflict = reservationsCache.some(r =>
        r.id !== reservationId &&
        r.date === newDate &&
        r.timeSlot === newTimeSlot &&
        r.lab === currentLab &&
        (r.status === 'approved' || r.status === 'pending')
    );

    if (conflict) {
        alert('That date and time slot is already taken. Please choose a different one.');
        return;
    }

    const submitBtn = document.getElementById('edit-submit-btn');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving...'; }

    try {
        const data = await apiCall(`/api/reservations/${reservationId}`, 'PATCH', {
            date:        newDate,
            timeSlot:    newTimeSlot,
            teacherName: document.getElementById('edit-teacher-name').value,
            subject:     document.getElementById('edit-subject').value,
            grade:       document.getElementById('edit-grade').value,
            students:    document.getElementById('edit-students').value,
            purpose:     document.getElementById('edit-purpose').value,
            status:      'pending',  // always reset to pending so admin must re-approve
        });

        if (!data.success) {
            alert(data.message || 'Failed to update reservation.');
            return;
        }

        closeEditModal();
        await fetchReservations();
        renderCalendar();
        renderMyReservations();
        renderTimeSlots();
        alert('✅ Reservation updated successfully!\n\nYour reservation has been resubmitted for admin approval.');

    } catch (err) {
        alert('Error: ' + (err.message || 'Could not reach the server.'));
        console.error(err);
    } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes'; }
    }
}

function updateFormState() {
    const submitBtn = document.getElementById('submit-reservation');

    if (multiScheduleMode) {
        // In multi mode: submit button enabled when queue has items + a slot is selected
        if (submitBtn) {
            submitBtn.disabled = scheduleQueue.length === 0;
            submitBtn.innerHTML = scheduleQueue.length > 0
                ? `<i class="fas fa-paper-plane"></i> Submit ${scheduleQueue.length} Reservation${scheduleQueue.length > 1 ? "s" : ""}`
                : "<i class='fas fa-paper-plane'></i> Submit Reservations";
        }
        const selectedInfo = document.getElementById('selected-info');
        if (selectedInfo) {
            if (selectedDate) {
                selectedInfo.innerHTML = `<p><strong>Date:</strong> ${formatDate(selectedDate)} — tap time slots to queue them</p>`;
            } else {
                selectedInfo.innerHTML = "<p style='color:#707475;'>Select a date, then tap time slots to add to queue</p>";
            }
        }
    } else {
        // Single mode: normal behaviour
        if (submitBtn) submitBtn.disabled = !selectedDate || !selectedTimeSlot;
        const selectedInfo = document.getElementById('selected-info');
        if (selectedInfo) {
            if (selectedDate && selectedTimeSlot) {
                selectedInfo.innerHTML = `
                    <p><strong>Selected Date:</strong> ${formatDate(selectedDate)}</p>
                    <p><strong>Selected Time:</strong> ${selectedTimeSlot}</p>
                `;
            } else {
                selectedInfo.innerHTML = "<p style='color:#707475;'>Please select a date and time slot</p>";
            }
        }
    }
}

// ============================================================================
// ADMIN VIEW
// ============================================================================

function initializeAdminView() {
    document.getElementById('user-view')?.classList.add('hidden');
    document.getElementById('admin-view')?.classList.remove('hidden');

    document.getElementById('calendar-title').textContent = 'Calendar Overview';
    document.getElementById('lab-subtitle').style.display = 'none';
    document.getElementById('user-calendar-controls').style.display  = 'none';
    document.getElementById('admin-calendar-controls').style.display = 'flex';

    // Add instruction banner
    const calendarContainer = document.querySelector('.calendar-container');
    if (calendarContainer && !document.getElementById('admin-calendar-instruction')) {
        const banner = document.createElement('div');
        banner.id = 'admin-calendar-instruction';
        banner.style.cssText = `
            background: linear-gradient(135deg, #081316 0%, #2a3a3f 100%);
            color: white; padding: 12px 20px; border-radius: 10px;
            margin-bottom: 15px; font-size: 14px;
            display: flex; align-items: center; gap: 10px;
        `;
        banner.innerHTML = `<i class="fas fa-info-circle" style="font-size:18px;"></i>
            <span>Click on any date to view reservations for that day</span>`;
        calendarContainer.insertBefore(banner, calendarContainer.querySelector('.calendar-header').nextSibling);
    }

    renderReservationsList();
}

function renderReservationsList() {
    const container = document.getElementById('reservations-list');
    if (!container) return;

    const reservations = reservationsCache
        .filter(r => r.lab === currentLab)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (reservations.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-times"></i>
                <p>No reservations yet</p>
            </div>`;
        return;
    }

    const pendingCount  = reservations.filter(r => r.status === 'pending').length;
    const approvedCount = reservations.filter(r => r.status === 'approved').length;
    const declinedCount = reservations.filter(r => r.status === 'declined').length;

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                ${pendingCount  > 0 ? `<div style="padding:8px 16px;background:#f59e0b;color:white;border-radius:20px;font-size:13px;font-weight:600;"><i class="fas fa-clock"></i> ${pendingCount} Pending</div>` : ''}
                ${approvedCount > 0 ? `<div style="padding:8px 16px;background:#22c55e;color:white;border-radius:20px;font-size:13px;font-weight:600;"><i class="fas fa-check"></i> ${approvedCount} Approved</div>` : ''}
                ${declinedCount > 0 ? `<div style="padding:8px 16px;background:#ef4444;color:white;border-radius:20px;font-size:13px;font-weight:600;"><i class="fas fa-times"></i> ${declinedCount} Declined</div>` : ''}
            </div>
            <button onclick="exportReservationsCSV()" style="
                display:flex; align-items:center; gap:8px;
                background:var(--button-bg); color:var(--button-text);
                border:none; border-radius:50px; padding:8px 18px;
                font-size:13px; font-weight:600; cursor:pointer;
                transition:opacity 0.2s; white-space:nowrap;">
                <i class="fas fa-download"></i> Export CSV
            </button>
        </div>
    `;

    reservations.forEach(r => container.appendChild(createReservationItem(r)));
}

function createReservationItem(reservation) {
    const div = document.createElement('div');
    div.className = `reservation-item ${reservation.status}`;

    const teacherName  = reservation.teacherName || reservation.requester.split('@')[0];
    const statusBadge  = `<span class="reservation-status ${reservation.status}">${reservation.status}</span>`;
    const commentHtml  = reservation.adminComment ? `
        <div style="margin-top:10px; padding:10px 14px; border-radius:8px;
            background:${reservation.status === 'declined' ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)'};
            border-left:3px solid ${reservation.status === 'declined' ? '#ef4444' : '#22c55e'};
            font-size:13px; color:var(--text-color);">
            <i class="fas fa-comment-dots" style="margin-right:6px; opacity:0.6;"></i>
            <strong>Admin note:</strong> ${reservation.adminComment}
        </div>` : '';

    div.innerHTML = `
        <div class="reservation-header">
            <div class="reservation-info">
                <h4>${teacherName}</h4>
                <p><i class="far fa-calendar"></i> ${formatDate(reservation.date)}</p>
                <p><i class="far fa-clock"></i> ${reservation.timeSlot}</p>
                <p><i class="fas fa-book"></i> ${reservation.subject} - Grade ${reservation.grade}</p>
                <p><i class="fas fa-users"></i> ${reservation.students} students</p>
                <p><i class="fas fa-info-circle"></i> ${reservation.purpose}</p>
                ${commentHtml}
            </div>
            ${statusBadge}
        </div>
        ${reservation.status === 'pending' ? `
            <div class="reservation-actions">
                <button class="approve-btn" onclick="openApproveModal('${reservation.id}')">
                    <i class="fas fa-check"></i> Approve
                </button>
                <button class="decline-btn" onclick="openDeclineModal('${reservation.id}')">
                    <i class="fas fa-times"></i> Decline
                </button>
            </div>
        ` : ''}
    `;

    return div;
}

// ── Comment Modal ─────────────────────────────────────────────────────────────

function openCommentModal({ id, action }) {
    document.getElementById('admin-comment-modal')?.remove();
    document.body.style.overflow = 'hidden';

    const isApprove  = action === 'approved';
    const accentColor = isApprove ? '#22c55e' : '#ef4444';
    const icon        = isApprove ? 'fa-check' : 'fa-times';
    const label       = isApprove ? 'Approve' : 'Decline';

    const modal = document.createElement('div');
    modal.id = 'admin-comment-modal';
    modal.style.cssText = `
        position:fixed; top:0; left:0; width:100%; height:100%;
        background:rgba(0,0,0,0.5); z-index:3000;
        display:flex; align-items:center; justify-content:center;
        padding:20px; box-sizing:border-box;
    `;
    modal.innerHTML = `
        <div style="background:var(--card-bg); border-radius:20px; width:100%; max-width:480px;
            box-shadow:0 10px 40px rgba(0,0,0,0.3); overflow:hidden;">
            <div style="background:linear-gradient(135deg,#081316 0%,#2a3a3f 100%);
                padding:18px 24px; display:flex; justify-content:space-between; align-items:center;">
                <h3 style="color:white; margin:0; font-size:1rem; font-weight:600;">
                    <i class="fas ${icon}" style="margin-right:8px; color:${accentColor};"></i>${label} Reservation
                </h3>
                <button onclick="closeCommentModal()" style="
                    background:rgba(255,255,255,0.15); border:none; color:white;
                    width:26px; height:26px; border-radius:50%; cursor:pointer;
                    font-size:13px; display:flex; align-items:center; justify-content:center;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div style="padding:22px 24px; display:flex; flex-direction:column; gap:14px;">
                <div>
                    <label style="font-size:12px; font-weight:600; text-transform:uppercase;
                        letter-spacing:0.5px; color:var(--secondary-text); display:block; margin-bottom:6px;">
                        Note for teacher <span style="font-weight:400; text-transform:none;">(optional)</span>
                    </label>
                    <textarea id="admin-comment-input" placeholder="${isApprove
                        ? 'e.g. Please arrive 10 minutes early to set up.'
                        : 'e.g. Lab is under maintenance on this date.'}"
                        style="width:100%; padding:12px 14px; border:1px solid var(--border-color);
                            border-radius:10px; font-size:14px; font-family:inherit;
                            background:var(--input-bg); color:var(--text-color);
                            resize:vertical; min-height:90px; outline:none;
                            transition:border-color 0.2s;"></textarea>
                </div>
                <div style="display:flex; gap:10px;">
                    <button onclick="closeCommentModal()" style="
                        flex:1; padding:11px; border-radius:50px; cursor:pointer;
                        background:transparent; color:var(--secondary-text);
                        border:1px solid var(--secondary-text); font-size:14px; font-weight:500;">
                        Cancel
                    </button>
                    <button id="admin-comment-submit" onclick="submitCommentModal('${id}','${action}')" style="
                        flex:1; padding:11px; border-radius:50px; cursor:pointer;
                        background:${accentColor}; color:white; border:none;
                        font-size:14px; font-weight:600; display:flex;
                        align-items:center; justify-content:center; gap:8px;
                        transition:opacity 0.2s;">
                        <i class="fas ${icon}"></i> ${label}
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeCommentModal(); });
    document.getElementById('admin-comment-input').focus();
}

function closeCommentModal() {
    document.getElementById('admin-comment-modal')?.remove();
    document.body.style.overflow = '';
}

function openApproveModal(id) { openCommentModal({ id, action: 'approved' }); }
function openDeclineModal(id)  { openCommentModal({ id, action: 'declined' }); }

async function submitCommentModal(id, action) {
    const comment   = document.getElementById('admin-comment-input')?.value.trim() || '';
    const submitBtn = document.getElementById('admin-comment-submit');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving...'; }

    try {
        const body = { status: action };
        if (comment) body.adminComment = comment;

        const data = await apiCall(`/api/reservations/${id}`, 'PATCH', body);
        if (!data.success) { alert(data.message); return; }

        closeCommentModal();
        await fetchReservations();
        renderReservationsList();
        renderCalendar();

        if (action === 'approved') {
            alert('✅ Reservation approved! The teacher has been notified.');
        } else {
            alert('❌ Reservation declined. The teacher has been notified.');
        }
    } catch (err) {
        alert('Error: ' + (err.message || 'Could not reach the server.'));
        console.error(err);
    } finally {
        if (submitBtn) { submitBtn.disabled = false; }
    }
}

// Keep old names as aliases in case called from showAdminDayReservations
async function approveReservation(id) { openApproveModal(id); }
async function declineReservation(id)  { openDeclineModal(id); }

// ============================================================================
// EXPORT TO CSV
// ============================================================================

function exportReservationsCSV() {
    const reservations = reservationsCache
        .filter(r => r.lab === currentLab)
        .sort((a, b) => a.date.localeCompare(b.date));

    if (reservations.length === 0) {
        alert('No reservations to export for this lab.');
        return;
    }

    const headers = ['Date','Time Slot','Teacher','Subject','Grade','Students','Purpose','Status','Admin Note','Submitted'];
    const rows    = reservations.map(r => [
        r.date,
        r.timeSlot,
        r.teacherName || r.requester.split('@')[0],
        r.subject,
        `Grade ${r.grade}`,
        r.students,
        `"${(r.purpose || '').replace(/"/g, '""')}"`,
        r.status,
        `"${(r.adminComment || '').replace(/"/g, '""')}"`,
        r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-US') : ''
    ]);

    const csv      = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob     = new Blob([csv], { type: 'text/csv' });
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement('a');
    const safeName = currentLab.replace(/\s+/g, '_');
    a.href         = url;
    a.download     = `${safeName}_Reservations_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================================================
// CALENDAR RENDERING
// ============================================================================

function renderCalendar() {
    if      (calendarView === 'daily')   renderDailyView();
    else if (calendarView === 'weekly')  renderWeeklyView();
    else                                 renderMonthlyView();
}

function renderMonthlyView() {
    const calendarGrid  = document.getElementById('calendar-grid');
    const monthYear     = document.getElementById('current-month-year');
    const adminMonthYear = document.getElementById('admin-month-year');
    if (!calendarGrid) return;

    const monthNames = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];
    const displayText = `${monthNames[currentMonth]} ${currentYear}`;
    if (monthYear)      monthYear.textContent      = displayText;
    if (adminMonthYear) adminMonthYear.textContent = displayText;

    calendarGrid.innerHTML = '';
    calendarGrid.style.gridTemplateColumns = 'repeat(7, 1fr)';

    ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(day => {
        const h = document.createElement('div');
        h.className   = 'calendar-day-header';
        h.textContent = day;
        calendarGrid.appendChild(h);
    });

    const firstDay  = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const today     = new Date();
    const role      = localStorage.getItem('fsh_user_role');

    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-day empty';
        calendarGrid.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dayEl   = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.textContent = day;

        const dateStr = formatDateForStorage(new Date(currentYear, currentMonth, day));
        const isToday = today.getDate() === day && today.getMonth() === currentMonth && today.getFullYear() === currentYear;
        const isPast  = new Date(currentYear, currentMonth, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());

        if (isToday) dayEl.classList.add('today');
        if (dateStr === selectedDate) dayEl.classList.add('selected');
        if (hasReservations(dateStr)) dayEl.classList.add('has-reservations');

        if (role === 'Admin') {
            dayEl.onclick = () => handleAdminDateClick(dateStr, dayEl);
        } else {
            if (isPast) {
                dayEl.classList.add('past');
                dayEl.style.opacity = '0.4';
                dayEl.style.cursor  = 'not-allowed';
            } else {
                dayEl.onclick = () => handleDateSelect(dateStr, dayEl);
            }
        }

        calendarGrid.appendChild(dayEl);
    }
}

function renderWeeklyView() {
    const calendarGrid = document.getElementById('calendar-grid');
    if (!calendarGrid) return;

    if (!currentWeekStart) currentWeekStart = getWeekStart(new Date());

    const monthYear      = document.getElementById('current-month-year');
    const adminMonthYear = document.getElementById('admin-month-year');
    const weekEnd        = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const label = `${currentWeekStart.toLocaleDateString('en-US',{month:'short',day:'numeric'})} - ${weekEnd.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`;
    if (monthYear)      monthYear.textContent      = label;
    if (adminMonthYear) adminMonthYear.textContent = label;

    calendarGrid.innerHTML = '';
    calendarGrid.style.gridTemplateColumns = 'repeat(7, 1fr)';

    const today = new Date();
    const role  = localStorage.getItem('fsh_user_role');

    ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach((day, i) => {
        const h    = document.createElement('div');
        h.className = 'calendar-day-header';
        const d    = new Date(currentWeekStart);
        d.setDate(d.getDate() + i);
        h.textContent = `${day} ${d.getDate()}`;
        calendarGrid.appendChild(h);
    });

    for (let i = 0; i < 7; i++) {
        const d      = new Date(currentWeekStart);
        d.setDate(d.getDate() + i);
        const dayEl  = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.textContent = d.getDate();

        const dateStr = formatDateForStorage(d);
        const isToday = d.toDateString() === today.toDateString();
        const isPast  = d < new Date(today.getFullYear(), today.getMonth(), today.getDate());

        if (isToday) dayEl.classList.add('today');
        if (dateStr === selectedDate) dayEl.classList.add('selected');
        if (hasReservations(dateStr)) dayEl.classList.add('has-reservations');

        if (role === 'Admin') {
            dayEl.onclick = () => handleAdminDateClick(dateStr, dayEl);
        } else if (!isPast) {
            dayEl.onclick = () => handleDateSelect(dateStr, dayEl);
        } else {
            dayEl.classList.add('past');
            dayEl.style.opacity = '0.4';
            dayEl.style.cursor  = 'not-allowed';
        }

        calendarGrid.appendChild(dayEl);
    }
}

function renderDailyView() {
    const calendarGrid   = document.getElementById('calendar-grid');
    if (!calendarGrid) return;

    const monthYear      = document.getElementById('current-month-year');
    const adminMonthYear = document.getElementById('admin-month-year');
    const label = currentDay.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (monthYear)      monthYear.textContent      = label;
    if (adminMonthYear) adminMonthYear.textContent = label;

    calendarGrid.innerHTML = '';
    calendarGrid.style.gridTemplateColumns = '1fr';

    const dateStr = formatDateForStorage(currentDay);
    const today   = new Date();
    const isPast  = currentDay < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const role    = localStorage.getItem('fsh_user_role');

    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day daily-view';

    if (currentDay.toDateString() === today.toDateString()) dayEl.classList.add('today');
    if (dateStr === selectedDate) dayEl.classList.add('selected');
    if (hasReservations(dateStr)) dayEl.classList.add('has-reservations');

    // Full date on top, large number below
    dayEl.innerHTML = `
        <span class="daily-full-date">${currentDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', year: 'numeric' })}</span>
        <span class="daily-day-number">${currentDay.getDate()}</span>
    `;

    if (role === 'Admin') {
        dayEl.onclick = () => handleAdminDateClick(dateStr, dayEl);
    } else if (!isPast) {
        dayEl.onclick = () => handleDateSelect(dateStr, dayEl);
    } else {
        dayEl.style.opacity = '0.4';
        dayEl.style.cursor  = 'not-allowed';
    }

    calendarGrid.appendChild(dayEl);
}

function handleDateSelect(dateStr, dayEl) {
    document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('selected'));
    dayEl.classList.add('selected');
    selectedDate     = dateStr;
    selectedTimeSlot = null;
    renderTimeSlots();
    updateFormState();

    // In multi-mode, keep queue panel in sync
    if (multiScheduleMode) renderQueuePanel();
}

function handleAdminDateClick(dateStr, dayEl) {
    document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('selected'));
    dayEl.classList.add('selected');
    adminSelectedDate = dateStr;

    const dayReservations = reservationsCache.filter(r => r.date === dateStr && r.lab === currentLab);
    showAdminDayReservations(dateStr, dayReservations);
}

function showAdminDayReservations(dateStr, reservations) {
    const container = document.getElementById('reservations-list');
    if (!container) return;

    container.innerHTML = `
        <div style="margin-bottom:20px; padding-bottom:15px; border-bottom:2px solid var(--hover-bg); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <h4 style="color:var(--text-color); margin:0;">
                <i class="far fa-calendar"></i> ${formatDate(dateStr)}
                <span style="font-size:13px; color:var(--secondary-text); margin-left:10px; font-weight:400;">
                    ${reservations.length} reservation${reservations.length !== 1 ? 's' : ''}
                </span>
            </h4>
            <button onclick="viewAllReservations()" style="
                background:#081316; color:white; border:none; border-radius:50px;
                padding:8px 18px; font-size:13px; font-weight:500; cursor:pointer;
                display:flex; align-items:center; gap:6px; transition:all 0.2s;
            ">
                <i class="fas fa-list"></i> View All Reservations
            </button>
        </div>
    `;

    if (reservations.length === 0) {
        container.innerHTML += `<div class="empty-state"><i class="fas fa-calendar-check"></i><p>No reservations for this date</p></div>`;
        return;
    }

    reservations
        .sort((a, b) => a.timeSlot.localeCompare(b.timeSlot))
        .forEach(r => container.appendChild(createReservationItem(r)));
}

// ============================================================================
// CALENDAR NAVIGATION
// ============================================================================

function showCalendarView(view) {
    calendarView = view;
    if (view === 'weekly' && !currentWeekStart) currentWeekStart = getWeekStart(new Date());
    if (view === 'daily') currentDay = new Date();

    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    renderCalendar();
}

function previousMonth() {
    if      (calendarView === 'daily')  currentDay.setDate(currentDay.getDate() - 1);
    else if (calendarView === 'weekly') { if (!currentWeekStart) currentWeekStart = getWeekStart(new Date()); currentWeekStart.setDate(currentWeekStart.getDate() - 7); }
    else { currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; } }
    renderCalendar();
}

function nextMonth() {
    if      (calendarView === 'daily')  currentDay.setDate(currentDay.getDate() + 1);
    else if (calendarView === 'weekly') { if (!currentWeekStart) currentWeekStart = getWeekStart(new Date()); currentWeekStart.setDate(currentWeekStart.getDate() + 7); }
    else { currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; } }
    renderCalendar();
}

function getWeekStart(date) {
    const d   = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return d;
}

// ============================================================================
// UTILITY
// ============================================================================

function formatDate(dateString) {
    const date    = new Date(dateString);
    const options = { weekday:'long', year:'numeric', month:'long', day:'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function formatDateForStorage(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function goBackToDashboard() { fshNavigate('dashboard.html'); }

function highlightDateFromMail(dateString, timeSlot) {
    const targetDate = new Date(dateString);
    currentMonth     = targetDate.getMonth();
    currentYear      = targetDate.getFullYear();
    renderCalendar();

    setTimeout(() => {
        document.querySelectorAll('.calendar-day').forEach(day => {
            if (parseInt(day.textContent) === targetDate.getDate() && !day.classList.contains('empty')) {
                day.click();
                day.scrollIntoView({ behavior:'smooth', block:'center' });
                day.style.boxShadow = '0 0 0 3px #081316, 0 0 20px rgba(8,19,22,0.5)';
                setTimeout(() => { day.style.boxShadow = ''; }, 3000);
            }
        });

        if (timeSlot) {
            setTimeout(() => {
                document.querySelectorAll('.time-slot').forEach(slot => {
                    if (slot.textContent.includes(timeSlot)) {
                        slot.scrollIntoView({ behavior:'smooth', block:'center' });
                        slot.style.boxShadow = '0 0 0 3px #081316, 0 0 20px rgba(8,19,22,0.5)';
                        setTimeout(() => { slot.style.boxShadow = ''; }, 3000);
                    }
                });
            }, 500);
        }
    }, 100);
}

function viewAllReservations() {
    adminSelectedDate = null;
    document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('selected'));
    renderReservationsList();
}

// Stop polling when leaving the page
window.addEventListener('beforeunload', stopPolling);

// ── Expose globals ────────────────────────────────────────────────────────────
window.previousMonth          = previousMonth;
window.nextMonth              = nextMonth;
window.showCalendarView       = showCalendarView;
window.approveReservation     = approveReservation;
window.declineReservation     = declineReservation;
window.openApproveModal       = openApproveModal;
window.openDeclineModal       = openDeclineModal;
window.closeCommentModal      = closeCommentModal;
window.submitCommentModal     = submitCommentModal;
window.exportReservationsCSV  = exportReservationsCSV;
window.goBackToDashboard      = goBackToDashboard;
window.highlightDateFromMail  = highlightDateFromMail;
window.renderReservationsList = renderReservationsList;
window.openEditModal          = openEditModal;
window.closeEditModal         = closeEditModal;
window.viewAllReservations    = viewAllReservations;