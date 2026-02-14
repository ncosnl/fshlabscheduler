// ============================================================================
// AUTH.JS - Authentication Logic (API Version)
// ============================================================================

// Global variables
let selectedRole = "";
let confirmedEmail = "";
let otpData = null;

// ============================================================================
// ROLE SELECTION
// ============================================================================

function handleSelection(clickedBtn) {
    selectedRole = clickedBtn.innerText;
    
    const emailInput = document.querySelector('#login-email');
    if (emailInput) {
        emailInput.placeholder = "usernameid@firstasia.edu.ph";
    }
    
    clearPasswordField('login-password');
    showView('login-view');
}

// ============================================================================
// LOGIN LOGIC
// ============================================================================

async function handleLogin() {
    const email = getInputValue('login-email').toLowerCase();
    const password = getInputValue('login-password');

    clearError('login-email');
    clearError('login-password');

    if (!validateEmailDomain(email)) {
        showError('login-email', "Access Denied: Use school email");
        return;
    }

    try {
        // Call API instead of localStorage
        const result = await window.AuthAPI.login(email, password);
        
        if (result.success) {
            // Redirect to dashboard
            window.location.href = "dashboard.html";
        }
    } catch (error) {
        if (error.message.includes('not found')) {
            showError('login-email');
            alert('No account found. Please sign up first.');
        } else if (error.message.includes('password')) {
            showError('login-password');
            alert('Incorrect password');
        } else {
            alert('Login failed: ' + error.message);
        }
    }
}

// ============================================================================
// SIGNUP LOGIC
// ============================================================================

function confirmEmail() {
    const email = getInputValue('signup-email').toLowerCase();
    
    clearError('signup-email');
    
    if (!validateEmailDomain(email)) {
        showError('signup-email', "Access Denied: Use school email");
        return;
    }
    
    confirmedEmail = email;
    
    const emailDisplay = document.getElementById('signup-email-display');
    if (emailDisplay) {
        emailDisplay.textContent = confirmedEmail;
    }
    
    clearPasswordField('signup-password');
    clearPasswordField('signup-confirm-password');
    showView('signup-password-view');
}

async function handleSignup() {
    const password = getInputValue('signup-password');
    const confirmPassword = getInputValue('signup-confirm-password');
    
    clearError('signup-password');
    clearError('signup-confirm-password');
    
    if (password.length < 6) {
        showError('signup-password');
        alert('Password must be at least 6 characters long');
        return;
    }
    
    if (password !== confirmPassword) {
        showError('signup-confirm-password');
        alert('Passwords do not match');
        return;
    }
    
    try {
        // Call API instead of localStorage
        const result = await window.AuthAPI.signup(confirmedEmail, password, selectedRole);
        
        if (result.success) {
            // Redirect to dashboard
            window.location.href = "dashboard.html";
        }
    } catch (error) {
        if (error.message.includes('already exists')) {
            showError('signup-email');
            alert('An account with this email already exists. Please sign in.');
        } else {
            alert('Signup failed: ' + error.message);
        }
    }
}

// ============================================================================
// FORGOT PASSWORD LOGIC
// ============================================================================

async function sendOTP() {
    const email = getInputValue('forgot-email').toLowerCase();
    
    clearError('forgot-email');
    
    if (!validateEmailDomain(email)) {
        showError('forgot-email', "Access Denied: Use school email");
        return;
    }
    
    try {
        // Call API to send OTP
        const result = await window.UsersAPI.sendPasswordResetOTP(email);
        
        if (result.success) {
            const otp = result.otp; // In production, this would be sent via email
            otpData = {
                email: email,
                code: otp,
                timestamp: Date.now(),
                expiresIn: 5 * 60 * 1000
            };
            
            console.log(`OTP for ${email}: ${otp}`);
            alert(`Your verification code is: ${otp}\n\n(In production, this would be sent to your email)`);
            
            const otpEmailDisplay = document.getElementById('otp-email-display');
            if (otpEmailDisplay) {
                otpEmailDisplay.textContent = email;
            }
            
            clearInput('otp-code');
            showView('otp-view');
        }
    } catch (error) {
        showError('forgot-email');
        alert('Error: ' + error.message);
    }
}

function verifyOTP() {
    const enteredOTP = getInputValue('otp-code');
    
    clearError('otp-code');
    
    if (!otpData) {
        alert('No OTP request found. Please request a new code.');
        showView('forgot-password-view');
        return;
    }
    
    if (Date.now() - otpData.timestamp > otpData.expiresIn) {
        alert('OTP has expired. Please request a new code.');
        otpData = null;
        showView('forgot-password-view');
        return;
    }
    
    if (enteredOTP !== otpData.code) {
        showError('otp-code');
        alert('Invalid verification code. Please try again.');
        return;
    }
    
    const resetEmailDisplay = document.getElementById('reset-email-display');
    if (resetEmailDisplay) {
        resetEmailDisplay.textContent = otpData.email;
    }
    
    clearPasswordField('reset-password');
    clearPasswordField('reset-confirm-password');
    showView('reset-password-view');
}

async function resetPassword() {
    const newPassword = getInputValue('reset-password');
    const confirmPassword = getInputValue('reset-confirm-password');
    
    clearError('reset-password');
    clearError('reset-confirm-password');
    
    if (newPassword.length < 6) {
        showError('reset-password');
        alert('Password must be at least 6 characters long');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showError('reset-confirm-password');
        alert('Passwords do not match');
        return;
    }
    
    if (!otpData) {
        alert('Session expired. Please start over.');
        showView('login-view');
        return;
    }
    
    try {
        // In a full implementation, you'd call an API here
        // For now, we'll use the existing localStorage method
        // TODO: Implement password reset API endpoint
        
        alert('Password reset functionality requires additional API endpoint');
        showView('login-view');
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function resendOTP() {
    if (otpData && otpData.email) {
        const email = otpData.email;
        clearInput('forgot-email');
        document.getElementById('forgot-email').value = email;
        sendOTP();
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function validateEmailDomain(email) {
    return email.endsWith('@firstasia.edu.ph');
}

function getInputValue(id) {
    const element = document.getElementById(id);
    return element ? element.value.trim() : '';
}

function clearInput(id) {
    const element = document.getElementById(id);
    if (element) {
        element.value = '';
        clearError(id);
    }
}

function clearPasswordField(id) {
    clearInput(id);
    updatePasswordIconVisibility(id);
}

function showError(inputId, placeholderText = null) {
    const input = document.getElementById(inputId);
    if (input) {
        input.classList.add('input-error');
        if (placeholderText) {
            input.value = "";
            input.placeholder = placeholderText;
        }
    }
}

function clearError(inputId) {
    const input = document.getElementById(inputId);
    if (input) {
        input.classList.remove('input-error');
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Hide all password toggle icons on page load
    const allPasswordToggles = document.querySelectorAll('.password-toggle');
    allPasswordToggles.forEach(icon => {
        icon.style.display = 'none';
    });
    
    // Setup input listeners
    setupInputListeners();
});

function setupInputListeners() {
    // Login email
    const loginEmail = document.getElementById('login-email');
    if (loginEmail) {
        loginEmail.addEventListener('input', () => clearError('login-email'));
        loginEmail.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    }
    
    // Login password
    const loginPassword = document.getElementById('login-password');
    if (loginPassword) {
        loginPassword.addEventListener('input', () => {
            clearError('login-password');
            updatePasswordIconVisibility('login-password');
        });
        loginPassword.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    }
    
    // Signup email
    const signupEmail = document.getElementById('signup-email');
    if (signupEmail) {
        signupEmail.addEventListener('input', () => clearError('signup-email'));
        signupEmail.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') confirmEmail();
        });
    }
    
    // Signup passwords
    const signupPassword = document.getElementById('signup-password');
    const signupConfirmPassword = document.getElementById('signup-confirm-password');
    
    if (signupPassword) {
        signupPassword.addEventListener('input', () => {
            clearError('signup-password');
            updatePasswordIconVisibility('signup-password');
        });
    }
    
    if (signupConfirmPassword) {
        signupConfirmPassword.addEventListener('input', () => {
            clearError('signup-confirm-password');
            updatePasswordIconVisibility('signup-confirm-password');
        });
        signupConfirmPassword.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleSignup();
        });
    }
    
    // Forgot password email
    const forgotEmail = document.getElementById('forgot-email');
    if (forgotEmail) {
        forgotEmail.addEventListener('input', () => clearError('forgot-email'));
        forgotEmail.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendOTP();
        });
    }
    
    // OTP code
    const otpCode = document.getElementById('otp-code');
    if (otpCode) {
        otpCode.addEventListener('input', () => clearError('otp-code'));
        otpCode.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') verifyOTP();
        });
    }
    
    // Reset password fields
    const resetPassword = document.getElementById('reset-password');
    const resetConfirmPassword = document.getElementById('reset-confirm-password');
    
    if (resetPassword) {
        resetPassword.addEventListener('input', () => {
            clearError('reset-password');
            updatePasswordIconVisibility('reset-password');
        });
    }
    
    if (resetConfirmPassword) {
        resetConfirmPassword.addEventListener('input', () => {
            clearError('reset-confirm-password');
            updatePasswordIconVisibility('reset-confirm-password');
        });
        resetConfirmPassword.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') resetPassword();
        });
    }
}
