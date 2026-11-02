import * as fs from 'node:fs';
import * as path from 'node:path';

// Purchases are intentionally append-only. There is no refund/undo operation.
const FILE = path.join(process.cwd(), 'data', 'purchases.json');

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

function save(data) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export function recordPurchase({ guildId, userId, item, cost, remainingPoints, reward }) {
  const data = load();
  const purchase = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    guildId,
    userId,
    item,
    cost,
    remainingPoints,
    reward,
    purchasedAt: new Date().toISOString(),
    irreversible: true,
  };
  data.push(purchase);
  save(data);
  return purchase;
}

export function getUserPurchases(guildId, userId) {
  return load().filter(x => x.guildId === guildId && x.userId === userId);
}
