import * as fs from 'node:fs';
import * as path from 'node:path';

const FILE = path.join(process.cwd(), 'data', 'orbiePoints.json');

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

export function getPoints(guildId, userId) {
  const data = load();
  return Number(data[guildId]?.[userId] ?? 0);
}

export function addPoints(guildId, userId, amount = 1) {
  if (!guildId || !userId || !Number.isFinite(amount) || amount <= 0) return 0;
  const data = load();
  if (!data[guildId]) data[guildId] = {};
  data[guildId][userId] = getPoints(guildId, userId) + Math.floor(amount);
  save(data);
  return data[guildId][userId];
}

export function removePoints(guildId, userId, amount) {
  if (!guildId || !userId || !Number.isFinite(amount) || amount <= 0) return false;
  const current = getPoints(guildId, userId);
  if (current < amount) return false;
  const data = load();
  data[guildId][userId] = current - Math.floor(amount);
  save(data);
  return true;
}

export function hasPoints(guildId, userId, amount) {
  return getPoints(guildId, userId) >= amount;
}

export function setPoints(guildId, userId, amount) {
  const data = load();
  if (!data[guildId]) data[guildId] = {};
  data[guildId][userId] = Math.max(0, Math.floor(Number(amount) || 0));
  save(data);
  return data[guildId][userId];
}
