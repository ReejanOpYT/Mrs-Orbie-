import * as crypto from 'node:crypto';
import * as fs from 'node:fs';

const STORE_FILE = 'tokens.json';
const ALGORITHM = 'aes-256-gcm';
const ACCOUNTS = ['main', 'alt'];

function deriveKey(secret) { return crypto.createHash('sha256').update(secret).digest(); }
function encrypt(text, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return JSON.stringify({ iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), data: encrypted.toString('hex') });
}
function decrypt(stored, key) {
  try {
    const { iv, tag, data } = JSON.parse(stored);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]).toString('utf8');
  } catch { return null; }
}
function loadStore() { try { return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')); } catch { return {}; } }
function saveStore(store) { fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2)); }

export class TokenStore {
  constructor(secret) { this.key = deriveKey(secret); }

  #normalise(entry) {
    if (!entry) return {};
    if (typeof entry === 'string') return { main: entry };
    if (entry.main || entry.alt) return entry;
    return {};
  }

  save(userId, token, account = 'main') {
    account = account === 'alt' ? 'alt' : 'main';
    const store = loadStore();
    const accounts = this.#normalise(store[userId]);
    accounts[account] = encrypt(token, this.key);
    store[userId] = accounts;
    saveStore(store);
  }

  get(userId, account = 'main') {
    const store = loadStore();
    const accounts = this.#normalise(store[userId]);
    return decrypt(accounts[account === 'alt' ? 'alt' : 'main'], this.key);
  }

  remove(userId, account = 'main') {
    const store = loadStore();
    const accounts = this.#normalise(store[userId]);
    const slot = account === 'alt' ? 'alt' : 'main';
    if (!accounts[slot]) return false;
    delete accounts[slot];
    if (Object.keys(accounts).length) store[userId] = accounts;
    else delete store[userId];
    saveStore(store);
    return true;
  }

  has(userId, account = 'main') { return Boolean(this.get(userId, account)); }
  listAccounts(userId) { const store = loadStore(); const a = this.#normalise(store[userId]); return ACCOUNTS.filter(x => Boolean(a[x])); }
  get size() { return Object.keys(loadStore()).length; }
  listUserIds() { return Object.keys(loadStore()); }
}
