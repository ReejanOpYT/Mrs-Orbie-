import * as fs from 'node:fs';
import * as path from 'node:path';

const AUTOQUEST_FILE = path.join(process.cwd(), 'autoquest.json');

function load() {
    try {
        const raw = JSON.parse(fs.readFileSync(AUTOQUEST_FILE, 'utf-8'));
        if (Array.isArray(raw)) return Object.fromEntries(raw.map(id => [id, null]));
        return raw && typeof raw === 'object' ? raw : {};
    } catch { return {}; }
}
function save(data) { fs.writeFileSync(AUTOQUEST_FILE, JSON.stringify(data, null, 2)); }

export function enableAutoquest(userId) {
    const data = load();
    if (Object.prototype.hasOwnProperty.call(data, userId) && data[userId] !== null) return false;
    data[userId] = null;
    save(data);
    return true;
}

export function enableAutoquestFor(userId, durationMs) {
    const data = load();
    const now = Date.now();
    const existing = data[userId];
    const base = existing && Date.parse(existing) > now ? Date.parse(existing) : now;
    const expiresAt = new Date(base + durationMs).toISOString();
    data[userId] = expiresAt;
    save(data);
    return { expiresAt };
}

export function disableAutoquest(userId) {
    const data = load();
    if (!Object.prototype.hasOwnProperty.call(data, userId)) return false;
    delete data[userId];
    save(data);
    return true;
}

export function isAutoquestEnabled(userId) {
    const data = load();
    if (!Object.prototype.hasOwnProperty.call(data, userId)) return false;
    const expiresAt = data[userId];
    if (expiresAt && Date.now() >= Date.parse(expiresAt)) { delete data[userId]; save(data); return false; }
    return true;
}

export function getAutoquestExpiry(userId) {
    const data = load();
    if (!Object.prototype.hasOwnProperty.call(data, userId)) return null;
    const expiresAt = data[userId];
    if (!expiresAt) return null;
    if (Date.now() >= Date.parse(expiresAt)) { delete data[userId]; save(data); return null; }
    return expiresAt;
}

export function getAutoquestUsers() { return Object.keys(load()).filter(isAutoquestEnabled); }
export function getAutoquestUserCount() { return getAutoquestUsers().length; }
