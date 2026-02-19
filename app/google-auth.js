// ============================================================================
// GOOGLE-AUTH.JS - Google Sign-In Integration
// ============================================================================

async function handleCredentialResponse(response) {
    const responsePayload = decodeJwtResponse(response.credential);

    if (responsePayload.hd !== 'firstasia.edu.ph') {
        alert("Access Denied: Please sign in with your school email (@firstasia.edu.ph).");
        return;
    }

    if (!selectedRole) selectedRole = "Teacher";

    const API_BASE = 'https://fsh-scheduler.medranowilljairuz.workers.dev';

    try {
        let res = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: responsePayload.email,
                password: responsePayload.sub
            })
        });
        let data = await res.json();

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

        localStorage.setItem('fsh_token',      data.token);
        localStorage.setItem('fsh_user_email', data.user.email);
        localStorage.setItem('fsh_user_role',  data.user.role);
        window.location.href = "dashboard.html";

    } catch (err) {
        alert("Could not reach the server. Please try again.");
        console.error(err);
    }
}

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

function getGoogleButtonTheme() {
    const savedTheme = localStorage.getItem('fsh_theme') || 'light';
    return savedTheme === 'dark' ? 'outline' : 'filled_black';
}

let buttonsRendered = false;

function getButtonWidth(el) {
    if (!el) return 300;
    document.body.offsetHeight; // force reflow
    const measured = Math.floor(el.getBoundingClientRect().width);
    const fallback = Math.min(window.innerWidth - 80, 400);
    return Math.min(measured > 20 ? measured : fallback, 400);
}

function renderGoogleButtons(force = false) {
    if (typeof google === 'undefined') return;
    if (buttonsRendered && !force) return;

    const buttonDivLogin  = document.getElementById("buttonDiv-login");
    const buttonDivSignup = document.getElementById("buttonDiv-signup");
    const theme = getGoogleButtonTheme();

    const baseConfig = {
        theme: theme,
        size: "large",
        shape: "pill",
        type: "standard",
        text: "signin_with",
        logo_alignment: "left",
    };

    // Render each button using its own container's width
    if (buttonDivLogin) {
        buttonDivLogin.innerHTML = '';
        google.accounts.id.renderButton(buttonDivLogin, { ...baseConfig, width: getButtonWidth(buttonDivLogin) });
    }

    if (buttonDivSignup) {
        buttonDivSignup.innerHTML = '';
        google.accounts.id.renderButton(buttonDivSignup, { ...baseConfig, width: getButtonWidth(buttonDivSignup) });
    }

    buttonsRendered = true;
}

// Exposed so ui.js can trigger a fresh render when switching to signup view
window.rerenderGoogleButtons = function() {
    buttonsRendered = false;
    // Render immediately with best guess, then correct after paint
    renderGoogleButtons(true);
    buttonsRendered = false;
    setTimeout(() => renderGoogleButtons(true), 150);
};

window.onload = function () {
    if (typeof google === 'undefined') return;

    google.accounts.id.initialize({
        client_id: "238536479920-v18ac5qcfh6t0vmp8evjk381g4b6ssl4.apps.googleusercontent.com",
        callback: handleCredentialResponse,
        hosted_domain: "firstasia.edu.ph"
    });

    // Render once layout is painted
    requestAnimationFrame(() => setTimeout(renderGoogleButtons, 100));

    // Re-render if container size changes
    const refEl = document.getElementById('buttonDiv-login') || document.getElementById('buttonDiv-signup');
    if (refEl && window.ResizeObserver) {
        const ro = new ResizeObserver(() => {
            buttonsRendered = false;
            renderGoogleButtons(true);
        });
        ro.observe(refEl.parentElement || document.body);
    }

    // Re-render when theme is toggled
    document.addEventListener('click', function (e) {
        if (e.target.closest('.theme-toggle')) {
            buttonsRendered = false;
            setTimeout(() => renderGoogleButtons(true), 50);
        }
    });
};