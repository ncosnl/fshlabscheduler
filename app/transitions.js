// ============================================================================
// TRANSITIONS.JS — Smooth fade in/out with FSH logo between page navigations
// Add to every page BEFORE </body>: <script src="transitions.js"></script>
// ============================================================================

(function () {
    // ── Build overlay ─────────────────────────────────────────────────────────
    const overlay = document.createElement('div');
    overlay.id = 'fsh-transition-overlay';

    const img = document.createElement('img');
    // Adjust path if your pages are in subdirectories
    img.src = '../public/fsh_logo_colored.png';
    img.alt = '';

    overlay.appendChild(img);
    document.body.appendChild(overlay);

    // Match theme instantly so there's no flash of wrong background color
    const theme = localStorage.getItem('fsh_theme') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    if (theme === 'dark') {
        overlay.style.background = '#1a1a1a';
    }

    // ── Fade IN: hide overlay after page has loaded ───────────────────────────
    function fadeIn() {
        // Small delay after load so the browser fully paints the page first,
        // ensuring the CSS opacity transition actually plays instead of skipping.
        setTimeout(() => {
            overlay.classList.add('fsh-hidden');
        }, 150);
    }

    if (document.readyState === 'complete') {
        fadeIn();
    } else {
        window.addEventListener('load', fadeIn);
    }

    // ── Fade OUT: show overlay before navigating away ─────────────────────────
    function shouldIntercept(href) {
        if (!href) return false;
        // Let external links, anchors, mailto, tel, javascript: pass through
        if (/^(https?:|mailto:|tel:|#|javascript:)/.test(href)) return false;
        return true;
    }

    function fadeOutThen(callback) {
        overlay.style.background = theme === 'dark' ? '#1a1a1a' : '#ffffff';
        overlay.classList.remove('fsh-hidden'); // show overlay
        // Wait for transition to finish then navigate
        setTimeout(callback, 370);
    }

    // Intercept <a> clicks
    document.addEventListener('click', function (e) {
        const anchor = e.target.closest('a[href]');
        if (!anchor) return;
        const href = anchor.getAttribute('href');
        if (!shouldIntercept(href)) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (anchor.target === '_blank') return;

        e.preventDefault();
        fadeOutThen(() => { window.location.href = href; });
    });

    // Intercept programmatic navigation via window.location.href = '...'
    // Your codebase uses this pattern heavily (e.g. window.location.href = 'dashboard.html')
    // We expose a helper: use fshNavigate('page.html') instead of window.location.href = '...'
    window.fshNavigate = function (url) {
        if (!shouldIntercept(url)) {
            window.location.href = url;
            return;
        }
        fadeOutThen(() => { window.location.href = url; });
    };

    // Also catch beforeunload for browser back/forward/refresh
    // (gives a brief flash of the overlay — best effort on refresh)
    window.addEventListener('pageshow', function (e) {
        // If page is restored from bfcache, fade it in again
        if (e.persisted) {
            overlay.classList.remove('fsh-hidden');
            fadeIn();
        }
    });

})();