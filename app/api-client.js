// ============================================================================
// API-CLIENT.JS - Frontend API Client
// ============================================================================

const API_BASE_URL = window.location.origin;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getToken() {
  return localStorage.getItem('fsh_token');
}

function setToken(token) {
  localStorage.setItem('fsh_token', token);
}

function clearToken() {
  localStorage.removeItem('fsh_token');
}

async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const config = {
    ...options,
    headers
  };
  
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }
    
    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// ============================================================================
// AUTHENTICATION API
// ============================================================================

const AuthAPI = {
  async login(email, password) {
    const data = await apiRequest('/api/auth', {
      method: 'POST',
      body: JSON.stringify({
        action: 'login',
        email,
        password
      })
    });
    
    if (data.success && data.token) {
      setToken(data.token);
      localStorage.setItem('fsh_user_email', data.user.email);
      localStorage.setItem('fsh_user_role', data.user.role);
    }
    
    return data;
  },
  
  async signup(email, password, role) {
    const data = await apiRequest('/api/auth', {
      method: 'POST',
      body: JSON.stringify({
        action: 'signup',
        email,
        password,
        role
      })
    });
    
    if (data.success && data.token) {
      setToken(data.token);
      localStorage.setItem('fsh_user_email', data.user.email);
      localStorage.setItem('fsh_user_role', data.user.role);
    }
    
    return data;
  },
  
  async googleSignIn(credential, role) {
    const data = await apiRequest('/api/auth', {
      method: 'POST',
      body: JSON.stringify({
        action: 'google-signin',
        credential,
        role
      })
    });
    
    if (data.success && data.token) {
      setToken(data.token);
      localStorage.setItem('fsh_user_email', data.user.email);
      localStorage.setItem('fsh_user_role', data.user.role);
    }
    
    return data;
  },
  
  async logout() {
    const token = getToken();
    
    try {
      await apiRequest('/api/auth', {
        method: 'POST',
        body: JSON.stringify({
          action: 'logout',
          token
        })
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    clearToken();
    localStorage.removeItem('fsh_user_email');
    localStorage.removeItem('fsh_user_role');
  }
};

// ============================================================================
// RESERVATIONS API
// ============================================================================

const ReservationsAPI = {
  async getReservations(filters = {}) {
    const params = new URLSearchParams();
    
    if (filters.lab) params.append('lab', filters.lab);
    if (filters.date) params.append('date', filters.date);
    if (filters.status) params.append('status', filters.status);
    
    const queryString = params.toString();
    const endpoint = `/api/reservations${queryString ? '?' + queryString : ''}`;
    
    return await apiRequest(endpoint, {
      method: 'GET'
    });
  },
  
  async createReservation(reservationData) {
    return await apiRequest('/api/reservations', {
      method: 'POST',
      body: JSON.stringify(reservationData)
    });
  },
  
  async updateReservation(reservationId, status) {
    return await apiRequest(`/api/reservations/${reservationId}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  },
  
  async deleteReservation(reservationId) {
    return await apiRequest(`/api/reservations/${reservationId}`, {
      method: 'DELETE'
    });
  }
};

// ============================================================================
// NOTIFICATIONS API
// ============================================================================

const NotificationsAPI = {
  async getNotifications(filter = 'all') {
    return await apiRequest(`/api/notifications?filter=${filter}`, {
      method: 'GET'
    });
  },
  
  async markAsRead(notificationId) {
    return await apiRequest(`/api/notifications/${notificationId}/read`, {
      method: 'PUT'
    });
  },
  
  async deleteNotification(notificationId) {
    return await apiRequest(`/api/notifications/${notificationId}`, {
      method: 'DELETE'
    });
  }
};

// ============================================================================
// USERS API
// ============================================================================

const UsersAPI = {
  async getProfile() {
    return await apiRequest('/api/users/me', {
      method: 'GET'
    });
  },
  
  async changePassword(currentPassword, newPassword) {
    return await apiRequest('/api/users/me', {
      method: 'PUT',
      body: JSON.stringify({
        action: 'change-password',
        currentPassword,
        newPassword
      })
    });
  },
  
  async sendPasswordResetOTP(email) {
    return await apiRequest('/api/users/forgot-password', {
      method: 'POST',
      body: JSON.stringify({
        action: 'send-otp',
        email
      })
    });
  }
};

// ============================================================================
// EXPORT API CLIENT
// ============================================================================

window.API = {
  Auth: AuthAPI,
  Reservations: ReservationsAPI,
  Notifications: NotificationsAPI,
  Users: UsersAPI
};

// Export individual APIs for convenience
window.AuthAPI = AuthAPI;
window.ReservationsAPI = ReservationsAPI;
window.NotificationsAPI = NotificationsAPI;
window.UsersAPI = UsersAPI;
