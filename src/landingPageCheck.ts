// Utility function to check if the app is running as PWA (iOS) or APK (Android)
export function isPWA() {
    return window.matchMedia('(display-mode: standalone)').matches;
}

export function isBrowser() {
    return !isPWA() && !window.navigator.userAgent.includes('Android');
}

// Function to check if the app was previously added to home screen (PWA) or installed (APK)
export function checkLandingPage() {
    if (isPWA() || isAPK()) {
        // For PWA (iOS) or APK (Android), check if the landing page was already shown
        if (!localStorage.getItem('landing_page_shown')) {
            // First-time open from home screen (PWA or APK), show landing page
            window.location.href = '/landing';  // URL for your landing page
            localStorage.setItem('landing_page_shown', 'true');
        } else {
            // Skip landing page, go directly to the auth page
            window.location.href = '/auth';  // URL for your auth page
        }
    } else if (isBrowser()) {
        // For regular browser visits, always show the landing page
        if (!localStorage.getItem('landing_page_shown')) {
            // Show landing page for first-time browser visits
            window.location.href = '/landing';  // URL for your landing page
            localStorage.setItem('landing_page_shown', 'true');
        } else {
            // Skip landing page and go to auth page directly for browser visits
            window.location.href = '/auth';  // URL for your auth page
        }
    }
}
