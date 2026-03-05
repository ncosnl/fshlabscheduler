// ============================================================================
// TRANSITIONS.JS — Smooth fade in/out with FSH logo between page navigations
// Add to every page BEFORE </body>: <script src="transitions.js"></script>
// ============================================================================

(function () {
    const MIN_DISPLAY_MS = 700; // overlay stays at least this long after arriving

    // ── Build overlay ─────────────────────────────────────────────────────────
    const overlay = document.createElement('div');
    overlay.id = 'fsh-transition-overlay';

    const img = document.createElement('img');
    img.src = '../public/fsh_logo_colored.png';
    img.alt = '';

    overlay.appendChild(img);

    // Insert as first child of body so it's available immediately
    if (document.body) {
        document.body.insertBefore(overlay, document.body.firstChild);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            document.body.insertBefore(overlay, document.body.firstChild);
        });
    }

    // Match theme instantly so there's no flash of wrong background color
    const theme = localStorage.getItem('fsh_theme') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    overlay.setAttribute('data-theme-overlay', theme);

    // ── Fade IN: hide overlay after page fully loaded + min time elapsed ──────
    const pageArriveTime = Date.now();

    function fadeIn() {
        const elapsed = Date.now() - pageArriveTime;
        const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);

        setTimeout(() => {
            overlay.classList.add('fsh-out');
            overlay.addEventListener('transitionend', () => {
                overlay.style.display = 'none';
            }, { once: true });
        }, remaining);
    }

    if (document.readyState === 'complete') {
        fadeIn();
    } else {
        window.addEventListener('load', fadeIn);
    }

    // ── Fade OUT: show overlay before navigating away ─────────────────────────
    function shouldIntercept(href) {
        if (!href) return false;
        if (/^(https?:|mailto:|tel:|#|javascript:)/.test(href)) return false;
        return true;
    }

    function fadeOutThen(callback) {
        overlay.style.display = '';
        overlay.classList.remove('fsh-out');
        // rAF pair lets the browser register the reset before starting fade-in
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                overlay.classList.add('fsh-visible');
                setTimeout(() => {
                    overlay.classList.remove('fsh-visible');
                    callback();
                }, 320);
            });
        });
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

    // Programmatic navigation helper
    window.fshNavigate = function (url) {
        if (!shouldIntercept(url)) {
            window.location.href = url;
            return;
        }
        fadeOutThen(() => { window.location.href = url; });
    };

    // bfcache restore — fade in again
    window.addEventListener('pageshow', function (e) {
        if (e.persisted) {
            overlay.style.display = '';
            overlay.classList.remove('fsh-out', 'fsh-visible');
            fadeIn();
        }
    });

})();