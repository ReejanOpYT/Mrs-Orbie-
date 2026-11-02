import * as fs from 'node:fs';
import * as path from 'node:path';
import { addPoints } from './orbiePointsStore.js';

const FILE = path.join(process.cwd(), 'data', 'inviteCache.json');

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

function snapshot(invites) {
  const out = {};
  for (const invite of invites.values()) {
    out[invite.code] = {
      uses: Number(invite.uses ?? 0),
      inviterId: invite.inviter?.id ?? null,
      maxUses: invite.maxUses ?? 0,
    };
  }
  return out;
}

export async function cacheGuildInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    const data = load();
    data[guild.id] = snapshot(invites);
    save(data);
    return data[guild.id];
  } catch (err) {
    console.warn(`[Invite Tracker] Cannot cache invites for ${guild.name}: ${err.message}`);
    return null;
  }
}

export async function cacheAllGuildInvites(client) {
  for (const guild of client.guilds.cache.values()) await cacheGuildInvites(guild);
}

export async function updateInviteCache(guild) {
  return cacheGuildInvites(guild);
}

export async function resolveUsedInvite(member) {
  const guild = member.guild;
  if (member.user.bot) return null;

  const data = load();
  const before = data[guild.id] ?? {};
  let invites;
  try {
    invites = await guild.invites.fetch();
  } catch (err) {
    console.warn(`[Invite Tracker] Cannot fetch invites for ${guild.name}: ${err.message}`);
    return null;
  }

  const after = snapshot(invites);
  const candidates = [];
  for (const [code, current] of Object.entries(after)) {
    const previous = before[code];
    if (!previous || !current.inviterId) continue;
    const delta = current.uses - Number(previous.uses ?? 0);
    if (delta > 0) candidates.push({ code, inviterId: current.inviterId, delta });
  }

  // Persist the newest state before awarding, so a restart cannot repeatedly pay the same delta.
  data[guild.id] = after;
  save(data);

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.delta - a.delta);
  const used = candidates[0];
  // One successful member invite = exactly one Orbie Point.
  const points = 1;
  const total = addPoints(guild.id, used.inviterId, points);
  return { ...used, points, total };
}
