import { existsSync, readFileSync, writeFileSync } from 'fs';

const BLACKLIST_FILE = 'data/blacklist.json';
const HISTORY_FILE = 'data/blacklistHistory.json';

function ensure(file, fallback = {}) {
  if (!existsSync(file)) writeFileSync(file, JSON.stringify(fallback, null, 2));
}
function read(file, fallback = {}) {
  ensure(file, fallback);
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return fallback; }
}
function write(file, data) { writeFileSync(file, JSON.stringify(data, null, 2)); }
function cleanExpired(data) {
  let changed = false;
  const now = Date.now();
  for (const [id, entry] of Object.entries(data)) {
    if (entry?.expiresAt && Date.parse(entry.expiresAt) <= now) {
      delete data[id];
      changed = true;
    }
  }
  return changed;
}
function history(action, userId, details = {}) {
  const data = read(HISTORY_FILE, []);
  if (!Array.isArray(data)) return;
  data.push({ action, userId, at: new Date().toISOString(), ...details });
  if (data.length > 500) data.splice(0, data.length - 500);
  write(HISTORY_FILE, data);
}

export function isBlacklisted(userId) {
  const data = read(BLACKLIST_FILE);
  const changed = cleanExpired(data);
  if (changed) write(BLACKLIST_FILE, data);
  return Boolean(data[userId]);
}

export function addBlacklist(userId, reason, addedBy, durationMs = null) {
  const data = read(BLACKLIST_FILE);
  const now = new Date();
  const expiresAt = durationMs ? new Date(now.getTime() + durationMs).toISOString() : null;
  data[userId] = { reason: reason || 'No reason provided', addedAt: now.toISOString(), addedBy, expiresAt };
  write(BLACKLIST_FILE, data);
  history('blacklist', userId, { reason: data[userId].reason, addedBy, expiresAt });
  return data[userId];
}

export function removeBlacklist(userId, removedBy = null) {
  const data = read(BLACKLIST_FILE);
  cleanExpired(data);
  const existed = Boolean(data[userId]);
  delete data[userId];
  write(BLACKLIST_FILE, data);
  if (existed) history('unblacklist', userId, { removedBy });
  return existed;
}

export function getBlacklistEntry(userId) {
  const data = read(BLACKLIST_FILE);
  if (cleanExpired(data)) write(BLACKLIST_FILE, data);
  return data[userId] ?? null;
}

export function getBlacklistEntries() {
  const data = read(BLACKLIST_FILE);
  if (cleanExpired(data)) write(BLACKLIST_FILE, data);
  return Object.entries(data).map(([userId, entry]) => ({ userId, ...entry }));
}

export function getBlacklistHistory() { return read(HISTORY_FILE, []); }
