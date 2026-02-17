// ============================================================================
// GOOGLE-AUTH.JS - Google Sign-In Integration
// ============================================================================

// ============================================================================
// GOOGLE SIGN-IN HANDLER
// ============================================================================

function handleCredentialResponse(response) {
    const responsePayload = decodeJwtResponse(response.credential);

    console.log("ID: " + responsePayload.sub);
    console.log("Email: " + responsePayload.email);

    // Validate domain
    if (responsePayload.hd !== 'firstasia.edu.ph') {
        alert("Access Denied: Please sign in with your school email (@firstasia.edu.ph).");
        return;
    }

    // Use selected role or default to Teacher
    if (!selectedRole) {
        selectedRole = "Teacher";
    }

    // Save to localStorage and redirect
    localStorage.setItem('fsh_user_email', responsePayload.email);
    localStorage.setItem('fsh_user_role', selectedRole);
    window.location.href = "dashboard.html";
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

    const buttonConfig = {
        theme: theme,
        size: "large",
        shape: "pill",
        width: "320"
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
        callback: handleCredentialResponse
    });

    renderGoogleButtons();
    google.accounts.id.prompt();

    // Re-render buttons whenever the theme toggle is clicked
    document.addEventListener('click', function (e) {
        if (e.target.closest('.theme-toggle')) {
            // Small delay to let the theme attribute update first
            setTimeout(renderGoogleButtons, 50);
        }
    });
};