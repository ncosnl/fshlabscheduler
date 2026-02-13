// ============================================================================
// API.JS - Frontend API Client
// This file handles all communication with the backend
// ============================================================================

const API_BASE_URL = '/api';

// ============================================================================
// AUTHENTICATION API
// ============================================================================

async function apiSignup(email, password, role) {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Signup failed');
    }

    return await response.json();
}

async function apiLogin(email, password) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
    }

    return await response.json();
}

async function apiChangePassword(email, currentPassword, newPassword) {
    const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, currentPassword, newPassword })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Password change failed');
    }

    return await response.json();
}

// ============================================================================
// RESERVATION API
// ============================================================================

async function apiGetReservations(filters = {}) {
    const params = new URLSearchParams();
    
    if (filters.lab) params.append('lab', filters.lab);
    if (filters.date) params.append('date', filters.date);
    if (filters.teacher) params.append('teacher', filters.teacher);
    if (filters.status) params.append('status', filters.status);

    const response = await fetch(`${API_BASE_URL}/reservations?${params}`);
    
    if (!response.ok) {
        throw new Error('Failed to fetch reservations');
    }

    return await response.json();
}

async function apiCreateReservation(reservationData) {
    const response = await fetch(`${API_BASE_URL}/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reservationData)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create reservation');
    }

    return await response.json();
}

async function apiUpdateReservation(id, status, adminEmail) {
    const response = await fetch(`${API_BASE_URL}/reservations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_email: adminEmail })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update reservation');
    }

    return await response.json();
}

async function apiDeleteReservation(id) {
    const response = await fetch(`${API_BASE_URL}/reservations/${id}`, {
        method: 'DELETE'
    });

    if (!response.ok) {
        throw new Error('Failed to delete reservation');
    }

    return await response.json();
}

// ============================================================================
// NOTIFICATION API
// ============================================================================

async function apiGetNotifications(userEmail) {
    const response = await fetch(`${API_BASE_URL}/notifications?user=${encodeURIComponent(userEmail)}`);
    
    if (!response.ok) {
        throw new Error('Failed to fetch notifications');
    }

    return await response.json();
}

async function apiMarkNotificationRead(id) {
    const response = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
        method: 'PUT'
    });

    if (!response.ok) {
        throw new Error('Failed to mark notification as read');
    }

    return await response.json();
}

async function apiGetUnreadCount(userEmail) {
    const response = await fetch(`${API_BASE_URL}/notifications/unread-count?user=${encodeURIComponent(userEmail)}`);
    
    if (!response.ok) {
        throw new Error('Failed to get unread count');
    }

    return await response.json();
}

// ============================================================================
// MAKE FUNCTIONS GLOBALLY AVAILABLE
// ============================================================================

window.api = {
    // Auth
    signup: apiSignup,
    login: apiLogin,
    changePassword: apiChangePassword,
    
    // Reservations
    getReservations: apiGetReservations,
    createReservation: apiCreateReservation,
    updateReservation: apiUpdateReservation,
    deleteReservation: apiDeleteReservation,
    
    // Notifications
    getNotifications: apiGetNotifications,
    markNotificationRead: apiMarkNotificationRead,
    getUnreadCount: apiGetUnreadCount
};
