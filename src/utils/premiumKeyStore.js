import * as fs from 'node:fs';
import * as path from 'node:path';
import crypto from 'node:crypto';

const FILE = path.join(process.cwd(), 'data', 'premiumKeys.json');

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

function createSixCharacterKey(data) {
  // Exactly 6 characters, with at least one letter and one number.
  // Excludes ambiguous characters such as 0/O and 1/I.
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const numbers = '23456789';
  const alphabet = letters + numbers;

  for (let attempt = 0; attempt < 500; attempt++) {
    const bytes = crypto.randomBytes(6);
    let chars = Array.from({ length: 6 }, (_, i) => alphabet[bytes[i] % alphabet.length]);

    // Guarantee a true alphanumeric mix rather than merely allowing one.
    if (!chars.some(c => numbers.includes(c))) {
      chars[bytes[0] % 6] = numbers[bytes[1] % numbers.length];
    }
    if (!chars.some(c => letters.includes(c))) {
      chars[bytes[2] % 6] = letters[bytes[3] % letters.length];
    }

    // Shuffle so the required character types are not position-predictable.
    for (let i = chars.length - 1; i > 0; i--) {
      const j = bytes[i] % (i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    const key = chars.join('');
    if (!data[key]) return key;
  }
  throw new Error('Could not generate a unique premium key.');
}

export function generatePremiumKey({ userId = null, durationMs = null, source = 'owner' } = {}) {
  const data = load();
  const key = createSixCharacterKey(data);
  const createdAtMs = Date.now();
  // Key validity follows the Premium duration. Lifetime Premium keys remain valid for
  // 30 days as a redeem-key, while the Premium granted after redemption is lifetime.
  const keyValidityMs = durationMs ?? (30 * 86400000);
  const keyExpiresAt = new Date(createdAtMs + keyValidityMs).toISOString();
  data[key] = {
    key,
    userId,
    durationMs,
    source,
    createdAt: new Date(createdAtMs).toISOString(),
    keyExpiresAt,
    redeemedAt: null,
    redeemedBy: null,
    revealTokens: {},
  };
  save(data);
  return data[key];
}

export function getPremiumKey(key) {
  const data = load();
  return data[String(key ?? '').trim()] ?? null;
}

export function redeemPremiumKey(key, userId) {
  const data = load();
  const normalized = String(key ?? '').trim();
  const entry = data[normalized];
  if (!entry) return { ok: false, reason: 'invalid' };
  if (entry.redeemedAt) return { ok: false, reason: 'used' };
  if (entry.keyExpiresAt && Date.now() >= Date.parse(entry.keyExpiresAt)) return { ok: false, reason: 'expired' };

  entry.redeemedAt = new Date().toISOString();
  entry.redeemedBy = userId;
  save(data);
  return { ok: true, entry };
}


export function createKeyRevealToken(key, userId, ttlMs = 10 * 60 * 1000) {
  const data = load();
  const normalized = String(key ?? '').trim();
  const entry = data[normalized];
  if (!entry || (entry.userId && entry.userId !== userId)) return null;
  if (!entry.revealTokens || typeof entry.revealTokens !== 'object') entry.revealTokens = {};
  const token = crypto.randomBytes(18).toString('hex');
  entry.revealTokens[token] = { userId, expiresAt: Date.now() + ttlMs };
  save(data);
  return token;
}

export function resolveKeyRevealToken(token, userId) {
  const data = load();
  const normalized = String(token ?? '').trim();
  for (const entry of Object.values(data)) {
    if (!entry || !entry.revealTokens?.[normalized]) continue;
    const reveal = entry.revealTokens[normalized];
    if (reveal.userId !== userId || Number(reveal.expiresAt) < Date.now()) {
      delete entry.revealTokens[normalized];
      save(data);
      return null;
    }
    return entry;
  }
  return null;
}

export function listActivePremiumKeys() {
  return Object.values(load()).filter(x => !x.redeemedAt);
}

export function deletePremiumKey(key) {
  const data = load();
  const normalized = String(key ?? '').trim();
  const existed = Boolean(data[normalized]);
  delete data[normalized];
  if (existed) save(data);
  return existed;
}
