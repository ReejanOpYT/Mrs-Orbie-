import * as fs from 'node:fs';
import * as path from 'node:path';

const FILE = path.join(process.cwd(), 'data', 'premium.json');

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch { return {}; }
}
function save(data) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export function addPremium(userId, durationMs = null, options = {}) {
  const data = load();
  const now = Date.now();
  const current = data[userId];
  const currentExpiry = current?.expiresAt ? Date.parse(current.expiresAt) : 0;
  if (options.extend && current && !current.expiresAt && !durationMs) {
    return current;
  }
  if (options.extend && current && !current.expiresAt && durationMs) {
    return current;
  }
  const base = options.extend && currentExpiry > now ? currentExpiry : now;
  const expiresAt = durationMs ? new Date(base + durationMs).toISOString() : null;
  data[userId] = { addedAt: new Date(now).toISOString(), expiresAt };
  save(data);
  return data[userId];
}

export function removePremium(userId) {
  const data = load();
  const existed = Boolean(data[userId]);
  delete data[userId];
  save(data);
  return existed;
}

export function getPremium(userId) {
  const data = load();
  const entry = data[userId];
  if (!entry) return null;
  if (entry.expiresAt && Date.now() >= Date.parse(entry.expiresAt)) {
    delete data[userId];
    save(data);
    return null;
  }
  return entry;
}

export function isPremium(userId) { return Boolean(getPremium(userId)); }
export function getPremiumCount() { return Object.keys(load()).filter(isPremium).length; }

export function durationToMs(value) {
  if (!value) return null;
  const match = String(value).trim().match(/^(\d+)(m|h|d|w|mo)$/i);
  if (!match) return null;
  const units = { m: 60e3, h: 3600e3, d: 86400e3, w: 604800e3, mo: 2592000e3 };
  return Number(match[1]) * units[match[2].toLowerCase()];
}

export function premiumDurationText(entry) {
  if (!entry?.expiresAt) return 'Lifetime';
  const left = Math.max(0, Date.parse(entry.expiresAt) - Date.now());
  if (left <= 0) return 'Expired';
  const d = Math.floor(left / 86400000);
  if (d) return `${d}d remaining`;
  const h = Math.floor(left / 3600000);
  if (h) return `${h}h remaining`;
  const m = Math.max(1, Math.floor(left / 60000));
  return `${m}m remaining`;
}
