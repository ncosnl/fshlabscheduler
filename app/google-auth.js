// ============================================================================
// GOOGLE-AUTH.JS - Google Sign-In Integration
// ============================================================================

// ============================================================================
// GOOGLE SIGN-IN HANDLER
// ============================================================================

async function handleCredentialResponse(response) {
    const responsePayload = decodeJwtResponse(response.credential);

    if (responsePayload.hd !== 'firstasia.edu.ph') {
        alert("Access Denied: Please sign in with your school email (@firstasia.edu.ph).");
        return;
    }

    if (!selectedRole) selectedRole = "Teacher";

    // ── Auto-signup or login via your Worker backend ──
    const API_BASE = 'https://fsh-scheduler.medranowilljairuz.workers.dev'; // ← same URL as auth.js

    try {
        // First try login
        let res = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: responsePayload.email,
                password: responsePayload.sub   // use Google's unique user ID as the password
            })
        });
        let data = await res.json();

        // If no account exists yet, create one automatically
        if (!data.success && data.message.includes('No account')) {
            res = await fetch(`${API_BASE}/api/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email:    responsePayload.email,
                    password: responsePayload.sub,
                    role:     selectedRole
                })
            });
            data = await res.json();
        }

        if (!data.success) {
            alert("Sign-in failed: " + data.message);
            return;
        }

        // Save the real JWT token so protected pages work
        localStorage.setItem('fsh_token',      data.token);
        localStorage.setItem('fsh_user_email', data.user.email);
        localStorage.setItem('fsh_user_role',  data.user.role);
        window.location.href = "dashboard.html";

    } catch (err) {
        alert("Could not reach the server. Please try again.");
        console.error(err);
    }
}

// ============================================================================
// JWT DECODER
// ============================================================================

function decodeJwtResponse(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
        window.atob(base64)
            .split('')
            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
    );

    return JSON.parse(jsonPayload);
}

// ============================================================================
// GOOGLE BUTTON INITIALIZATION
// ============================================================================

function getGoogleButtonTheme() {
    const savedTheme = localStorage.getItem('fsh_theme') || 'light';
    // Dark mode → outline (white) button; Light mode → filled black button
    return savedTheme === 'dark' ? 'outline' : 'filled_black';
}

function renderGoogleButtons() {
    if (typeof google === 'undefined') return;

    const buttonDivLogin = document.getElementById("buttonDiv-login");
    const buttonDivSignup = document.getElementById("buttonDiv-signup");
    const theme = getGoogleButtonTheme();

    // Responsive width: 320px on desktop, fit container on mobile
    const isMobile = window.innerWidth <= 768;
    const buttonConfig = {
        theme: theme,
        size: isMobile ? "large" : "large",
        shape: "pill",
        width: isMobile ? window.innerWidth - 80 : 320  // Account for padding
    };

    if (buttonDivLogin) {
        buttonDivLogin.innerHTML = '';
        google.accounts.id.renderButton(buttonDivLogin, buttonConfig);
    }

    if (buttonDivSignup) {
        buttonDivSignup.innerHTML = '';
        google.accounts.id.renderButton(buttonDivSignup, buttonConfig);
    }
}

window.onload = function () {
    if (typeof google === 'undefined') return;

    google.accounts.id.initialize({
        client_id: "238536479920-v18ac5qcfh6t0vmp8evjk381g4b6ssl4.apps.googleusercontent.com",
        callback: handleCredentialResponse,
        hosted_domain: "firstasia.edu.ph"
    });

    renderGoogleButtons();
    google.accounts.id.prompt();

    // Re-render on window resize for responsiveness
    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(renderGoogleButtons, 250);
    });

    // Re-render buttons whenever the theme toggle is clicked
    document.addEventListener('click', function (e) {
        if (e.target.closest('.theme-toggle')) {
            setTimeout(renderGoogleButtons, 50);
        }
    });
};;