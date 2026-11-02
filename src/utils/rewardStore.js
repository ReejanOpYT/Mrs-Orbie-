import * as fs from 'node:fs';
import * as path from 'node:path';

const FILE = path.join(process.cwd(), 'data', 'questAllUses.json');
function load() {
  try { const d = JSON.parse(fs.readFileSync(FILE, 'utf8')); return d && typeof d === 'object' && !Array.isArray(d) ? d : {}; }
  catch { return {}; }
}
function save(d) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); }
export function getQuestAllUses(userId) { return Number(load()[userId] ?? 0); }
export function addQuestAllUse(userId, amount = 1) { const d = load(); d[userId] = getQuestAllUses(userId) + amount; save(d); return d[userId]; }
export function consumeQuestAllUse(userId) { const d = load(); const current = Number(d[userId] ?? 0); if (current <= 0) return false; d[userId] = current - 1; save(d); return true; }
