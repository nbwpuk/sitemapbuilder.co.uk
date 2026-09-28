// Optional analytics: Google Analytics 4 and Matomo.
// The page carries the settings as data attributes on <html> (src/analytics.php reads them from .env).
// Without the attributes, this module loads nothing and `track` does nothing.
// Both trackers are cookieless unless SMB_ANALYTICS_COOKIES=1.

const cfg = document.documentElement.dataset;
const gaId = cfg.gaId || '';
const matomoUrl = cfg.matomoUrl || '';
const matomoSite = cfg.matomoSite || '';
const cookies = cfg.analyticsCookies === '1';
const ga = gaId !== '';
const matomo = matomoUrl !== '' && matomoSite !== '';

function loadScript(src) {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    document.head.append(script);
}

if (ga) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    if (!cookies) {
        window.gtag('consent', 'default', {
            analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
        });
    }
    window.gtag('js', new Date());
    window.gtag('config', gaId);
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`);
}

if (matomo) {
    const queue = (window._paq = window._paq || []);
    if (!cookies) queue.push(['disableCookies']);
    queue.push(['setTrackerUrl', matomoUrl + 'matomo.php']);
    queue.push(['setSiteId', matomoSite]);
    queue.push(['trackPageView']);
    queue.push(['enableLinkTracking']);
    loadScript(matomoUrl + 'matomo.js');
}

/**
 * Record one event. `params` holds short strings or numbers.
 * Google Analytics gets the event name and all params.
 * Matomo gets category "sitemap", the event name as the action, `params.label` as the name, and `params.value` as the value.
 */
export function track(name, params = {}) {
    try {
        if (ga) window.gtag('event', name, params);
        if (matomo) {
            const value = typeof params.value === 'number' ? params.value : undefined;
            window._paq.push(['trackEvent', 'sitemap', name, String(params.label ?? ''), value]);
        }
    } catch {
        // Analytics must never stop the tool.
    }
}
