// : ! Mr Orbie Development !
// + Discord: ReejanOpYT
// + Community: https://discord.gg/jBv4rU75J (Mr Orbie Development)

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, extname, basename } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const EMOJI_PATH = join(__dirname, '../../data/emoji.json');
const LOCAL_EMOJI_DIR = join(__dirname, '../../assets/emojis');

const MAX_EMOJI_BYTES = 256 * 1024; // Discord emoji size limit

/* ------------------------------------------------------------------ *
 *  How emojis work here
 *
 *  1. Every image in assets/emojis/ is uploaded (once) to the bot's
 *     Application Emojis on startup. The emoji name = the file name.
 *  2. The code asks for a *logical* name, e.g. getEmoji('success').
 *  3. EMOJI_ALIASES maps that logical name to the uploaded emoji name,
 *     so the emoji the bot shows is always one that was uploaded by it.
 *  4. Resolved against the live application emoji list, so the IDs are
 *     always the real ones for THIS bot. No hardcoded IDs anywhere.
 * ------------------------------------------------------------------ */

// logical name used in code  ->  uploaded emoji name (= file name in assets/emojis)
export const EMOJI_ALIASES = {
  // status
  success: 'tick_pd', check: 'tick_pd', verify: 'tick_pd', complete: 'tick_pd',
  error: 'Cross_', cross: 'Cross_', incomplete: 'Cross_',
  warning: 'warring1',
  info: 'info',
  // navigation / decoration
  arrow: 'Arrow_White', arrow_arrow: 'arrow_arrow',
  dot: 'pink_dot',
  star: 'Star', star_empty: 'Star', rating: 'Star',
  sparkle: 'StarPinkStar',
  heart: 'pinkhearts', review: 'pinkhearts',
  premium: 'diamond_pink', diamond: 'diamond_pink',
  crown: 'crown', admin: 'crown',
  // features
  link: 'link69', token: 'link69',
  quest: 'Quests', quests: 'Quests',
  utility: 'utility3', command: 'utility3',
  shop: 'shop',
  gear: 'Gear', robot: 'robot',
  ping: 'ping',
  book: 'book_',
  // presence / people
  setup: 'green_dot', fix: 'green_dot',
  user: 'requester', requester: 'requester',
  avatar: 'atomixUser',
  date: 'activities', status: 'activities', activity: 'activities',
  bot: 'home', server: 'home',
};

// Used only when no uploaded emoji matches (e.g. before the first sync finishes).
const FALLBACKS = {
  star: '✦', star_empty: '✦', user: '👤', requester: '👤', rating: '✦', heart: '♡',
  premium: '◆', diamond: '◆', shop: '🛍️', quest: '🎯', quests: '🎯', utility: '🛠️',
  info: 'ℹ️', setup: '🟢', warning: '⚠️', error: '❌', cross: '❌', success: '✅',
  check: '✅', verify: '✅', complete: '✅', incomplete: '❌', link: '🔗', token: '🔑',
  date: '📅', bot: '🤖', admin: '👑', crown: '👑', source: '📦', ping: '🏓', fire: '🔥',
  sparkle: '✨', gear: '⚙️', robot: '🤖', server: '🏠', status: '📡', avatar: '👤',
  command: '⌘', fix: '🟢', activity: '📡', activities: '📡', green_dot: '🟢', book_: '📖',
  book: '📖', dot: '•', arrow: '➜', arrow_arrow: '➜', upload: '⬆️', key: '🔑',
};

// uploaded emoji name -> { id, name, animated, text }
let applicationEmojiMap = new Map();
let applicationEmojiLower = new Map();

function rebuildMap(client) {
  const next = new Map();
  const lower = new Map();
  const emojis = client?.application?.emojis?.cache;
  if (emojis) {
    for (const e of emojis.values()) {
      if (!e?.name) continue;
      const info = { id: e.id, name: e.name, animated: Boolean(e.animated), text: e.toString() };
      next.set(e.name, info);
      lower.set(e.name.toLowerCase(), info);
    }
  }
  applicationEmojiMap = next;
  applicationEmojiLower = lower;
}

/** Refreshes the in-memory map from the client's cached application emojis. */
export function initApplicationEmojis(client) {
  try { rebuildMap(client); } catch {}
}

function readOverrides() {
  try {
    if (!existsSync(EMOJI_PATH)) return {};
    const data = JSON.parse(readFileSync(EMOJI_PATH, 'utf8'));
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function lookupUploaded(name) {
  return (
    applicationEmojiMap.get(name) ||
    applicationEmojiMap.get(EMOJI_ALIASES[name]) ||
    applicationEmojiLower.get(String(name).toLowerCase()) ||
    null
  );
}

/** Emoji string for message content, e.g. <a:tick_pd:123>. */
export function getEmoji(name) {
  try {
    const uploaded = lookupUploaded(name);
    if (uploaded) return uploaded.text;
    const override = readOverrides()[name];
    if (typeof override === 'string' && override.trim()) return override.trim();
    return FALLBACKS[name] ?? '•';
  } catch {
    return '';
  }
}

/**
 * Emoji for `ButtonBuilder#setEmoji` / select options.
 * Returns {id, name, animated} for uploaded emojis, otherwise a unicode string.
 */
export function getButtonEmoji(name) {
  const uploaded = lookupUploaded(name);
  if (uploaded) return { id: uploaded.id, name: uploaded.name, animated: uploaded.animated };
  return FALLBACKS[name] ?? '•';
}

export function getAllEmojis() {
  return Object.fromEntries([...applicationEmojiMap.entries()].map(([k, v]) => [k, v.text]));
}

/* ------------------------------------------------------------------ *
 *  Sync: assets/emojis  ->  Application Emojis
 * ------------------------------------------------------------------ */

/** File name -> valid Discord emoji name (2-32 chars, A-Z a-z 0-9 _). */
function sanitizeEmojiName(filename) {
  let name = basename(filename, extname(filename));
  name = name.replace(/[^A-Za-z0-9_]/g, '_'); // underscores are valid, so Cross_ / book_ keep their names
  if (name.length < 2) name = `e_${name || 'x'}`;
  return name.slice(0, 32);
}

/** Builds [{ file, name, path }] with unique, deterministic names (gif wins a name clash). */
function listLocalEmojis() {
  if (!existsSync(LOCAL_EMOJI_DIR)) return [];
  const files = readdirSync(LOCAL_EMOJI_DIR)
    .filter(f => /\.(png|jpe?g|gif|webp)$/i.test(f))
    .sort((a, b) => {
      const ga = /\.gif$/i.test(a) ? 0 : 1;
      const gb = /\.gif$/i.test(b) ? 0 : 1;
      return ga - gb || a.localeCompare(b);
    });

  const used = new Set();
  const out = [];
  for (const file of files) {
    let name = sanitizeEmojiName(file);
    if (used.has(name.toLowerCase())) {
      const ext = extname(file).slice(1).toLowerCase();
      name = `${name.slice(0, 32 - ext.length - 1)}_${ext}`;
    }
    used.add(name.toLowerCase());
    out.push({ file, name, path: join(LOCAL_EMOJI_DIR, file) });
  }
  return out;
}

let running = null;

/**
 * Uploads every image in assets/emojis to the bot's Application Emojis.
 * - Matching is by name; existing emojis are never replaced or deleted.
 * - Safe to run on every start: it only uploads what is missing.
 * - Each emoji is usable immediately after it is uploaded.
 */
export function syncAppEmojis(client) {
  if (running) return running;
  running = runSync(client).finally(() => { running = null; });
  return running;
}

// Kept so older imports keep working.
export const autoUploadLocalEmojis = syncAppEmojis;

async function runSync(client) {
  const result = {
    total: 0, uploaded: 0, existing: 0, failed: 0, skipped: 0,
    aliasesOk: 0, aliasesMissing: [], details: [],
  };

  const local = listLocalEmojis();
  result.total = local.length;

  const api = client.application?.emojis;
  if (!api) {
    result.details.push('application emojis API unavailable (is discord.js >= 14.17?)');
    return result;
  }

  try {
    await api.fetch();
  } catch (err) {
    result.details.push(`could not fetch application emojis: ${err?.message || err}`);
    return result;
  }
  rebuildMap(client);

  for (const { file, name, path } of local) {
    if (applicationEmojiMap.has(name)) { result.existing++; continue; }

    let size = 0;
    try { size = statSync(path).size; } catch {}
    if (size > MAX_EMOJI_BYTES) {
      result.skipped++;
      result.details.push(`${file}: ${(size / 1024).toFixed(0)}KB is over Discord's 256KB emoji limit`);
      continue;
    }

    let created = null;
    let lastErr = null;
    for (let attempt = 0; attempt < 2 && !created; attempt++) {
      try {
        created = await api.create({ attachment: path, name });
      } catch (err) {
        lastErr = err;
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    if (created) {
      result.uploaded++;
      rebuildMap(client); // usable right away
      console.log(`[emoji-sync] uploaded ${name}`);
    } else {
      result.failed++;
      result.details.push(`${file}: ${lastErr?.message || 'upload failed'}`);
      console.error(`[emoji-sync] failed ${name}:`, lastErr?.message || lastErr);
    }

    await new Promise(r => setTimeout(r, 350)); // stay friendly to rate limits
  }

  rebuildMap(client);

  // Verify every alias used by the bot points at an uploaded emoji.
  for (const [logical, target] of Object.entries(EMOJI_ALIASES)) {
    if (applicationEmojiMap.has(target)) result.aliasesOk++;
    else result.aliasesMissing.push(`${logical} → ${target}`);
  }

  return result;
}
