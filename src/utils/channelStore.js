import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const FILE = join(process.cwd(), 'data', 'commandChannels.json');

function ensureFile() {
  if (!existsSync(FILE)) writeFileSync(FILE, '{}');
}

function read() {
  ensureFile();
  try { return JSON.parse(readFileSync(FILE, 'utf8')); } catch { return {}; }
}

function write(data) {
  ensureFile();
  writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export function getCommandChannel(guildId) {
  if (!guildId) return null;
  return read()[guildId] ?? null;
}

export function setCommandChannel(guildId, channelId) {
  if (!guildId) return false;
  const data = read();
  data[guildId] = channelId;
  write(data);
  return true;
}

export function clearCommandChannel(guildId) {
  if (!guildId) return false;
  const data = read();
  delete data[guildId];
  write(data);
  return true;
}
