// ============================================================================
// DASHBOARD-HEADER-SCROLL.JS
// Adds/removes .nav-scrolled on .dash-nav based on scroll position.
// Transparent at top → solid frosted bar on scroll.
// Only runs on the dashboard page (checks for .lab-grid).
// ============================================================================

(function () {
    // Only apply on dashboard
    if (!document.querySelector('.lab-grid') && !document.getElementById('welcome-title')) return;

    const SCROLL_THRESHOLD = 10; // px before nav solidifies

    function updateNav() {
        const nav = document.querySelector('.dash-nav');
        if (!nav) return;

        if (window.scrollY > SCROLL_THRESHOLD) {
            nav.classList.add('nav-scrolled');
        } else {
            nav.classList.remove('nav-scrolled');
        }
    }

    // Throttle scroll handler for performance
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                updateNav();
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });

    // Run once on load in case page is already scrolled (e.g. bfcache restore)
    document.addEventListener('DOMContentLoaded', updateNav);
    window.addEventListener('pageshow', updateNav);
})();
