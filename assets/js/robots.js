// robots.txt rules (RFC 9309). This module has no DOM or network code.
// src/Robots.php has the same match logic. The proxy applies it again, thus this copy is for the user's information.
import { safeHttpUrl } from './safe.js';

const NO_DATA = Object.freeze({ found: false, sitemaps: [], rules: [] });

/** `*` is zero or more characters. `$` at the end is the end of the path. */
export function robotsMatches(pattern, target) {
    const anchored = pattern.endsWith('$');
    if (anchored) pattern = pattern.slice(0, -1);
    const parts = pattern.split('*');
    const last = parts.length - 1;
    if (!target.startsWith(parts[0])) return false;
    if (last === 0) return !anchored || target === parts[0];
    let pos = parts[0].length;
    for (let i = 1; i < last; i++) {
        if (parts[i] === '') continue;
        const found = target.indexOf(parts[i], pos);
        if (found === -1) return false;
        pos = found + parts[i].length;
    }
    if (anchored) return target.length - parts[last].length >= pos && target.endsWith(parts[last]);
    return parts[last] === '' || target.indexOf(parts[last], pos) !== -1;
}

/** The longest rule that matches is the result. With equal lengths, allow is the result. No match permits the URL. */
export function robotsAllows(rules, url) {
    let target;
    try {
        const u = new URL(url);
        target = u.pathname + u.search;
    } catch {
        return true;
    }
    let allowed = true;
    let best = -1;
    for (const rule of rules) {
        const length = rule.path.length;
        if (length < best || (length === best && !rule.allow)) continue;
        if (robotsMatches(rule.path, target)) {
            best = length;
            allowed = rule.allow;
        }
    }
    return allowed;
}

/** Keep only data of the correct type from the proxy response. */
export function cleanRobotsData(data) {
    if (typeof data !== 'object' || data === null) return NO_DATA;
    const sitemaps = Array.isArray(data.sitemaps) ? [...new Set(data.sitemaps.map(safeHttpUrl).filter((u) => u !== null))] : [];
    const rules = Array.isArray(data.rules)
        ? data.rules.filter((r) => r && typeof r.path === 'string' && typeof r.allow === 'boolean').map((r) => ({ allow: r.allow, path: r.path }))
        : [];
    return { found: data.found === true, sitemaps, rules };
}

/**
 * Make a lookup that asks `fetchData` one time for each origin.
 * If the data is not available, the lookup permits all paths. The proxy makes its own check.
 * @param {(origin: string, o: {signal?: AbortSignal}) => Promise<object>} fetchData
 */
export function createRobotsLookup(fetchData) {
    const cache = new Map();
    return function lookup(url, { signal } = {}) {
        let origin;
        try {
            origin = new URL(url).origin;
        } catch {
            return Promise.resolve(NO_DATA);
        }
        if (!cache.has(origin)) {
            const pending = fetchData(origin, { signal }).then(cleanRobotsData).catch((error) => {
                cache.delete(origin); // An abort or a failure must not stay in the cache for the next run.
                if (error?.name === 'AbortError') throw error;
                return NO_DATA;
            });
            cache.set(origin, pending);
        }
        return cache.get(origin);
    };
}
