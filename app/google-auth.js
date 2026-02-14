// ============================================================================
// GOOGLE-AUTH.JS - Google Sign-In Integration (API Version)
// ============================================================================

// ============================================================================
// GOOGLE SIGN-IN HANDLER
// ============================================================================

async function handleCredentialResponse(response) {
    try {
        // Use selected role or default to Teacher
        if (!selectedRole) {
            selectedRole = "Teacher";
        }

        // Call API to verify and create/login user
        const result = await window.AuthAPI.googleSignIn(response.credential, selectedRole);
        
        if (result.success) {
            // Redirect to dashboard
            window.location.href = "dashboard.html";
        }
    } catch (error) {
        console.error('Google Sign-In error:', error);
        
        if (error.message.includes('domain') || error.message.includes('school email')) {
            alert("Access Denied: Please sign in with your school email (@firstasia.edu.ph).");
        } else {
            alert("Google Sign-In failed: " + error.message);
        }
    }
}

// ============================================================================
// GOOGLE BUTTON INITIALIZATION
// ============================================================================

window.onload = function () {
    if (typeof google === 'undefined') return;

    const buttonDivLogin = document.getElementById("buttonDiv-login");
    const buttonDivSignup = document.getElementById("buttonDiv-signup");
    
    google.accounts.id.initialize({
        client_id: "238536479920-v18ac5qcfh6t0vmp8evjk381g4b6ssl4.apps.googleusercontent.com",
        callback: handleCredentialResponse
    });
    
    // Render button in login view
    if (buttonDivLogin) {
        google.accounts.id.renderButton(
            buttonDivLogin,
            { 
                theme: "filled_black",
                size: "large", 
                shape: "pill",
                width: "320"
            } 
        );
    }
    
    // Render button in signup view
    if (buttonDivSignup) {
        google.accounts.id.renderButton(
            buttonDivSignup,
            { 
                theme: "filled_black",
                size: "large", 
                shape: "pill",
                width: "320"
            } 
        );
    }
    
    google.accounts.id.prompt();
};
