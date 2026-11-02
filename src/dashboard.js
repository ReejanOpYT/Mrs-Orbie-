import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { addPremium, removePremium, durationToMs, premiumDurationText, getPremium } from './utils/premiumStore.js';
import { getAllLogChannels, setLogChannel } from './utils/logStore.js';
import { BOT_NAME, SUPPORT_SERVER_URL, SUPPORT_SERVER_NAME, DEVELOPER_NAME, DASHBOARD_NAME, THEME_PRIMARY, THEME_SECONDARY, THEME_BACKGROUND, THEME_CARD, THEME_CARD_SECONDARY, THEME_TEXT, THEME_MUTED, THEME_SUCCESS, THEME_WARNING, THEME_ERROR } from './utils/config.js';
import { getCommandChannel, setCommandChannel } from './utils/channelStore.js';
import { generatePremiumKey, listActivePremiumKeys, deletePremiumKey } from './utils/premiumKeyStore.js';

const PORT = Number(process.env.DASHBOARD_PORT || 9190);
const HOST = process.env.DASHBOARD_HOST || '0.0.0.0';
const OWNER_ID = process.env.BOT_OWNER_ID || '1293127492982407195';
const PASSWORD = process.env.DASHBOARD_PASSWORD || '';
const COOKIE = 'orbie_dashboard';
const SESSION_TTL = 12 * 60 * 60 * 1000;
const sessions = new Map();
const DATA = new URL('../data/', import.meta.url);

function readJson(file, fallback = {}) { try { return JSON.parse(fs.readFileSync(new URL(file, DATA), 'utf8')); } catch { return fallback; } }
function premiumEntries() { const d = readJson('premium.json'); return Object.entries(d).filter(([, e]) => !e.expiresAt || Date.now() < Date.parse(e.expiresAt)); }
function allPremiumEntries() { return Object.entries(readJson('premium.json')); }
function keys() { return Object.values(readJson('premiumKeys.json')); }
function esc(v = '') { return String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
function parseCookies(header = '') { return Object.fromEntries(header.split(';').map(x => x.trim()).filter(Boolean).map(x => { const i = x.indexOf('='); return [i < 0 ? x : x.slice(0, i), decodeURIComponent(i < 0 ? '' : x.slice(i + 1))]; })); }
function sessionFrom(req) { const t = parseCookies(req.headers.cookie || '')[COOKIE]; const s = t && sessions.get(t); return s && s.ownerId === OWNER_ID && s.expiresAt > Date.now() ? s : null; }
function newSession() { const t = crypto.randomBytes(32).toString('hex'); sessions.set(t, { ownerId: OWNER_ID, expiresAt: Date.now() + SESSION_TTL }); return t; }
function send(res, status, body, type = 'text/html', extra = {}) { res.writeHead(status, { 'Content-Type': `${type}; charset=utf-8`, ...extra }); res.end(body); }
function redirect(res, path, cookie) { const h = { Location: path }; if (cookie) h['Set-Cookie'] = cookie; res.writeHead(302, h); res.end(); }
function cookieFor(t) { return `${COOKIE}=${encodeURIComponent(t)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL / 1000}`; }
function clearCookie() { return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`; }
function parseBody(req) { return new Promise((resolve, reject) => { let b = ''; req.on('data', c => { b += c; if (b.length > 65536) reject(new Error('Request too large')); }); req.on('end', () => { try { resolve(new URLSearchParams(b)); } catch (e) { reject(e); } }); req.on('error', reject); }); }
function authPage(req, res) { if (!sessionFrom(req)) { redirect(res, '/dashboard/login'); return false; } return true; }
function duration(ms) { if (!ms) return 'Lifetime'; const d = Math.round(ms / 86400000); return d % 30 === 0 ? `${d / 30}mo` : `${d}d`; }
function formatDate(value) { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(); }
function initials(name = 'O') { return esc(String(name).trim().slice(0, 2).toUpperCase() || 'O'); }
async function getUser(client, id) { return client.users.cache.get(id) || await client.users.fetch(id).catch(() => null); }

function remainingMs(value) { if (!value) return Infinity; return Math.max(0, Date.parse(value) - Date.now()); }
function expiringPremiumEntries(days=7) { const limit = days * 86400000; return premiumEntries().filter(([,e]) => e.expiresAt && remainingMs(e.expiresAt) <= limit); }
function inviteRows(client) {
  const cache = readJson('inviteCache.json');
  const totals = new Map();
  for (const guild of Object.values(cache)) for (const inv of Object.values(guild || {})) {
    const id = inv?.inviterId; if (!id) continue;
    totals.set(id, (totals.get(id) || 0) + Number(inv.uses || 0));
  }
  return [...totals.entries()].sort((a,b)=>b[1]-a[1]).slice(0,25);
}
function commandRows(client) {
  return [...client.commands.values()].map(c => ({ name:c.data?.name || c.prefix || 'unknown', prefix:c.prefix || c.data?.name || '—', slash:c.data?.name || '—', description:c.data?.description || 'No description' })).sort((a,b)=>a.name.localeCompare(b.name));
}

const CSS = `
:root{--bg:${THEME_BACKGROUND};--p:${THEME_CARD};--p2:${THEME_CARD_SECONDARY};--pink:${THEME_PRIMARY};--purple:${THEME_SECONDARY};--text:${THEME_TEXT};--muted:${THEME_MUTED};--line:#2c2335;--good:${THEME_SUCCESS};--bad:${THEME_ERROR};--warning:${THEME_WARNING};--blue:#7289da}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 15% 0,#301032,transparent 35%),radial-gradient(circle at 100% 0,#25102e,transparent 30%),var(--bg);color:var(--text);font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif}a{text-decoration:none;color:inherit}.app{display:flex;min-height:100vh}.side{width:245px;padding:22px 15px;border-right:1px solid var(--line);background:#0e0b12ee;position:sticky;top:0;height:100vh}.brand{display:flex;align-items:center;gap:10px;font-weight:850;font-size:19px;margin-bottom:26px}.logo{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(135deg,#26102f,${THEME_PRIMARY});box-shadow:0 0 30px ${THEME_PRIMARY}33}.nav{display:grid;gap:6px}.nav a{padding:12px;border-radius:12px;color:var(--muted)}.nav a:hover,.nav a.active{background:#211a2a;color:#fff}.main{width:100%;max-width:1500px;margin:auto;padding:28px}.top{display:flex;justify-content:space-between;gap:15px;align-items:center;margin-bottom:20px}h1{margin:0;font-size:28px}h2{font-size:17px}.sub,.muted{color:var(--muted);font-size:13px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.card{background:linear-gradient(145deg,#1b1624f5,#120e18f5);border:1px solid var(--line);border-radius:17px;padding:18px;box-shadow:0 15px 40px #0004}.num{font-size:30px;font-weight:900;margin:12px 0 4px}.section{margin-top:16px}.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.btn{display:inline-block;border:0;border-radius:10px;padding:9px 12px;background:#2b2233;color:#fff;cursor:pointer}.btn:hover{filter:brightness(1.15)}.pink{background:linear-gradient(135deg,${THEME_PRIMARY},${THEME_SECONDARY})}.red{background:#6d2026}.green{background:#16582d}.small{font-size:12px;padding:6px 9px}.table{width:100%;border-collapse:collapse}.table th,.table td{padding:12px 8px;border-bottom:1px solid var(--line);text-align:left;font-size:13px;vertical-align:middle}.table th{color:var(--muted)}.pill{display:inline-block;padding:5px 9px;border-radius:999px;background:#29202f}.good{background:#153622;color:#9ff5ba}.bad{background:#35171b;color:#ff9ca1}.form{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.field{display:grid;gap:6px}.field label{font-size:12px;color:var(--muted)}input,select{width:100%;padding:10px;border-radius:10px;border:1px solid var(--line);background:#0f0c14;color:#fff;outline:0}input:focus,select:focus{border-color:#df75b4}.notice{padding:12px;border-radius:12px;background:#211a29;margin-bottom:14px}.empty{text-align:center;color:var(--muted);padding:18px}.login{min-height:100vh;display:grid;place-items:center;padding:20px}.loginbox{width:min(430px,100%);text-align:center}.loginbox .logo{margin:auto}.loginbox form{display:grid;gap:10px;margin-top:18px}.footer{text-align:center;color:#756b7c;font-size:11px;margin-top:25px}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.avatar{width:36px;height:36px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:8px;border:1px solid #ffffff22}.usercell{display:flex;align-items:center;gap:8px}.usercell .avatar{margin:0}.search{max-width:360px}.statline{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)}.statline:last-child{border-bottom:0}.hero{display:flex;justify-content:space-between;align-items:center;gap:18px}.heroBadge{padding:7px 10px;border:1px solid #ffffff12;border-radius:999px;background:#ffffff08;color:#ddd}.dangerText{color:#ff9ca1}
.eyebrow{font-size:10px;letter-spacing:2px;color:#d68abb;font-weight:800;margin-bottom:7px}.online{color:#9ff5ba!important}.heroTitle{font-size:23px;font-weight:900}.hero{min-height:155px}.orb{width:120px;height:120px;display:grid;place-items:center}.orbRing{width:108px;height:108px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(${THEME_PRIMARY} var(--score),#2b2233 0);position:relative}.orbRing:after{content:'';position:absolute;inset:8px;border-radius:50%;background:#110d15}.orbRing>div{position:relative;z-index:1;text-align:center}.orbRing strong{display:block;font-size:24px}.orbRing span{font-size:10px;color:var(--muted)}.statCard{position:relative;overflow:hidden}.statIcon{position:absolute;right:16px;top:15px;font-size:24px;opacity:.7}.num small{font-size:12px;color:var(--muted)}.pulse{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin-top:14px}.pulse>div{padding:12px;border:1px solid var(--line);border-radius:12px;background:#0e0a13}.pulse span,.pulse b{display:block}.pulse span{font-size:11px;color:var(--muted)}.pulse b{margin-top:4px}.attentionList{display:grid;gap:8px;margin-top:12px}.attention{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:11px;border-radius:12px;background:#16111c;border:1px solid var(--line)}.attention span{font-size:11px;color:var(--muted)}.attention a{grid-row:1/3;grid-column:2;align-self:center;color:#f6a7d1;font-size:12px}.attention.danger{border-color:#65313a}.attention.good{border-color:#27533a}.activityList{margin-top:10px}.activity{display:grid;grid-template-columns:36px 1fr auto;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)}.activity:last-child{border-bottom:0}.activityIcon{width:34px;height:34px;border-radius:11px;background:#251b2c;display:grid;place-items:center}.activity time{font-size:10px;color:#746a7a}.launchGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:12px}.launchGrid a{padding:12px;border:1px solid var(--line);border-radius:13px;background:#100c15;transition:.15s}.launchGrid a:hover{transform:translateY(-2px);border-color:#70435f;background:#19121f}.launchGrid span{font-size:18px;display:block}.launchGrid b{display:block;margin-top:5px;font-size:12px}.launchGrid small{display:block;color:var(--muted);font-size:10px;margin-top:2px}.quote{display:flex;gap:12px;align-items:center;background:linear-gradient(90deg,#1e1424,#15101c)}.quote>span{font-size:25px;color:${THEME_PRIMARY}}
@media(max-width:950px){.grid{grid-template-columns:repeat(2,1fr)}.form{grid-template-columns:1fr}.side{width:72px}.brand span,.nav span{display:none}.nav a{text-align:center}.main{padding:18px}}@media(max-width:560px){.grid{grid-template-columns:1fr}.main{padding:13px}.top{align-items:flex-start;flex-direction:column}.table{display:block;overflow:auto;white-space:nowrap}.hero{align-items:flex-start;flex-direction:column}.search{max-width:none;width:100%}}
`;

function shell(title, body, active = '') {
  const links = [['/dashboard','⌂','Overview'],['/dashboard/premium','💗','Premium'],['/dashboard/keys','🔑','Keys'],['/dashboard/analytics','◈','Analytics'],['/dashboard/invites','✈','Invites'],['/dashboard/commands','⌘','Commands'],['/dashboard/guilds','▣','Guilds'],['/dashboard/logs','▤','Logs'],['/dashboard/settings','⚙','Settings']];
  const support = SUPPORT_SERVER_URL ? `<a class="btn" href="${esc(SUPPORT_SERVER_URL)}" target="_blank" rel="noopener">♡ ${esc(SUPPORT_SERVER_NAME)}</a>` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} • ${esc(DASHBOARD_NAME)}</title><style>${CSS}</style></head><body><div class="app"><aside class="side"><div class="brand"><div class="logo">✦</div><span>${esc(BOT_NAME)}</span></div><nav class="nav">${links.map(([href,icon,label])=>`<a class="${active===label.toLowerCase()?'active':''}" href="${href}">${icon} <span>${label}</span></a>`).join('')}<a href="/dashboard/logout">↪ <span>Logout</span></a></nav></aside><main class="main"><div class="top" style="margin-bottom:10px"><div></div><div class="row">${support}</div></div>${body}<div class="footer">♡ ${esc(BOT_NAME)} • ${esc(DEVELOPER_NAME)} • Private Owner Dashboard</div></main></div></body></html>`;
}
function login(error='') { const support = SUPPORT_SERVER_URL ? `<a class="btn" href="${esc(SUPPORT_SERVER_URL)}" target="_blank" rel="noopener">♡ ${esc(SUPPORT_SERVER_NAME)}</a>` : ''; return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(DASHBOARD_NAME)}</title><style>${CSS}</style></head><body><div class="login"><div class="loginbox card"><div class="logo">✦</div><h1 style="margin-top:14px">${esc(BOT_NAME)}</h1><p class="muted">${esc(DASHBOARD_NAME)} • Private owner control panel ♡</p>${error?`<div class="dangerText">${esc(error)}</div>`:''}<form method="post" action="/dashboard/login"><input type="password" name="password" placeholder="Dashboard password" required autofocus><button class="btn pink">Enter Dashboard</button></form><div class="row" style="justify-content:center;margin-top:12px">${support}</div></div></div></body></html>`; }

function healthScore(client) {
  const ping = Number(client.ws?.ping ?? 0);
  if (!client.user) return 0;
  if (ping < 100) return 100;
  if (ping < 200) return 90;
  if (ping < 350) return 75;
  if (ping < 600) return 55;
  return 35;
}
function recentActivity(client) {
  const items = [];
  const premiums = allPremiumEntries().slice(-8).reverse();
  for (const [id,e] of premiums.slice(0,4)) items.push({icon:'💗', title:'Premium updated', text:id, time:e.addedAt});
  for (const k of keys().filter(x=>x.redeemedAt).slice(-4).reverse()) items.push({icon:'🔑', title:'Premium key redeemed', text:k.redeemedBy || 'Unknown user', time:k.redeemedAt});
  return items.sort((a,b)=>Date.parse(b.time||0)-Date.parse(a.time||0)).slice(0,6);
}
function attentionCards(client) {
  const expiring=expiringPremiumEntries(7).length;
  const unused=keys().filter(k=>!k.redeemedAt).length;
  const guilds=client.guilds.cache.size;
  return [
    expiring?`<div class="attention danger"><b>⏳ ${expiring} Premium user${expiring===1?'':'s'} expiring soon</b><span>Open Premium to extend access.</span><a href="/dashboard/premium">Review →</a></div>`:'<div class="attention good"><b>♡ Premium looks healthy</b><span>No timed Premium expires within 7 days.</span></div>',
    `<div class="attention"><b>🔑 ${unused} unused key${unused===1?'':'s'}</b><span>Keep keys ready for your next giveaway.</span><a href="/dashboard/keys">Manage →</a></div>`,
    `<div class="attention"><b>🌸 ${guilds} connected guild${guilds===1?'':'s'}</b><span>Manage servers and configuration from Guilds.</span><a href="/dashboard/guilds">Open →</a></div>`
  ].join('');
}

async function overview(client) {
  const activePremium = premiumEntries();
  const allKeys = keys();
  const usedKeys = allKeys.filter(k => k.redeemedAt).length;
  const botUser = client.user;
  const score = healthScore(client);
  const activity = recentActivity(client).map(x=>`<div class="activity"><div class="activityIcon">${x.icon}</div><div><b>${esc(x.title)}</b><div class="sub mono">${esc(x.text)}</div></div><time>${esc(formatDate(x.time))}</time></div>`).join('') || '<div class="empty">No recent activity yet.</div>';
  const totalMembers=[...client.guilds.cache.values()].reduce((n,g)=>n+(g.memberCount||0),0);
  return shell('Overview', `<div class="top"><div><div class="eyebrow">MRS ORBIE • OWNER CENTER</div><h1>Hey, Owner ♡</h1><div class="sub">Your little control room for Premium, keys, servers and bot health.</div></div><div class="row"><span class="heroBadge online">● LIVE</span><span class="heroBadge">🤖 ${botUser ? esc(botUser.tag) : 'Bot online'}</span></div></div>
  <div class="hero card"><div><div class="heroTitle">Everything is under control.</div><p class="sub">Manage ${BOT_NAME} without touching the terminal.</p><div class="row"><a class="btn pink" href="/dashboard/premium">💗 Manage Premium</a><a class="btn" href="/dashboard/keys">🔑 Create Keys</a><a class="btn" href="/dashboard/guilds">▣ Manage Guilds</a></div></div><div class="orb"><div class="orbRing" style="--score:${score*3.6}deg"><div><strong>${score}%</strong><span>health</span></div></div></div></div>
  <div class="grid section"><div class="card statCard"><div class="statIcon">♡</div><div class="muted">Premium users</div><div class="num">${activePremium.length}</div><div class="sub">${expiringPremiumEntries(7).length} need attention</div></div><div class="card statCard"><div class="statIcon">🔑</div><div class="muted">Key vault</div><div class="num">${allKeys.length}</div><div class="sub">${allKeys.length-usedKeys} ready • ${usedKeys} redeemed</div></div><div class="card statCard"><div class="statIcon">◈</div><div class="muted">Servers</div><div class="num">${client.guilds.cache.size}</div><div class="sub">${totalMembers.toLocaleString()} members reached</div></div><div class="card statCard"><div class="statIcon">⚡</div><div class="muted">Latency</div><div class="num">${client.ws?.ping ?? '—'}<small> ms</small></div><div class="sub">WebSocket response</div></div></div>
  <div class="grid section"><div class="card"><div class="hero"><div><h2>Orbie Pulse</h2><div class="sub">Live runtime snapshot</div></div><span class="pill good">Healthy</span></div><div class="pulse"><div><span>Uptime</span><b>${formatUptime(client.uptime || 0)}</b></div><div><span>Cached users</span><b>${client.users.cache.size}</b></div><div><span>Cached channels</span><b>${client.channels.cache.size}</b></div><div><span>Guilds</span><b>${client.guilds.cache.size}</b></div></div></div><div class="card"><div class="hero"><div><h2>Attention Center</h2><div class="sub">Little things worth checking</div></div></div><div class="attentionList">${attentionCards(client)}</div></div></div>
  <div class="grid section"><div class="card"><div class="hero"><div><h2>Recent Activity</h2><div class="sub">Latest Premium and key events</div></div><button class="btn small" onclick="location.reload()">↻ Refresh</button></div><div class="activityList">${activity}</div></div><div class="card"><h2>Quick Launch</h2><div class="launchGrid"><a href="/dashboard/premium"><span>💗</span><b>Premium</b><small>Users & expiry</small></a><a href="/dashboard/keys"><span>🔑</span><b>Key Vault</b><small>Generate & track</small></a><a href="/dashboard/invites"><span>✈</span><b>Invites</b><small>Top inviters</small></a><a href="/dashboard/analytics"><span>◈</span><b>Analytics</b><small>Growth insights</small></a><a href="/dashboard/commands"><span>⌘</span><b>Commands</b><small>Command directory</small></a><a href="/dashboard/settings"><span>⚙</span><b>Settings</b><small>Server controls</small></a></div></div></div>
  <div class="section card quote"><span>✦</span><div><b>${BOT_NAME} is ready.</b><div class="sub">Cute outside. Powerful inside. Keep your bot sparkling. ♡</div></div></div>
  <script>setTimeout(()=>location.reload(),60000)</script>`, 'overview');
}
function formatUptime(ms) { const s=Math.floor(ms/1000), d=Math.floor(s/86400), h=Math.floor(s%86400/3600), m=Math.floor(s%3600/60), sec=s%60; return d?`${d}d ${h}h`:h?`${h}h ${m}m`:`${m}m ${sec}s`; }

async function premium(client) {
  const entries = premiumEntries();
  const rows = (await Promise.all(entries.map(async ([id,e]) => [id,e,await getUser(client,id)]))).sort((a,b)=>String(a[2]?.username||a[0]).localeCompare(String(b[2]?.username||b[0]))).map(([id,e,user])=>{
    const name = user?.tag || user?.username || 'Discord User';
    const avatar = user?.displayAvatarURL?.({size:64,extension:'png'}) || '';
    const plan = e.expiresAt ? premiumDurationText(e) : 'Lifetime';
    return `<tr class="premium-row" data-user="${esc(`${name} ${id}`.toLowerCase())}"><td><div class="usercell">${avatar?`<img class="avatar" src="${esc(avatar)}" alt="">`:`<div class="avatar" style="display:grid;place-items:center;background:#2b2233">${initials(name)}</div>`}<div><b>${esc(name)}</b><div class="sub mono">${id}</div></div></div></td><td>${esc(formatDate(e.addedAt))}</td><td><span class="pill ${e.expiresAt?'':'good'}">${esc(plan)}</span>${e.expiresAt?`<div class="sub">${esc(formatDate(e.expiresAt))}</div>`:'<div class="sub">Never expires</div>'}</td><td><div class="row"><form method="post" action="/dashboard/premium/extend"><input type="hidden" name="userId" value="${id}"><input type="hidden" name="duration" value="7d"><button class="btn small">+7d</button></form><form method="post" action="/dashboard/premium/remove"><input type="hidden" name="userId" value="${id}"><button class="btn red small" onclick="return confirm('Remove Premium from ${esc(name).replace(/'/g,"\\'")}?')">Remove</button></form></div></td></tr>`;
  }).join('');
  return shell('Premium', `<div class="top"><div><h1>Premium Management 💗</h1><div class="sub">See the actual Discord username, plan, expiry and manage access.</div></div><input id="premiumSearch" class="search" placeholder="Search username or user ID" oninput="filterPremium()"></div><div class="card"><form class="form" method="post" action="/dashboard/premium/add"><div class="field"><label>Discord User ID</label><input name="userId" pattern="\\d{17,20}" required></div><div class="field"><label>Duration</label><input name="duration" placeholder="7d / 30d / 1mo / blank = lifetime"></div><div class="field"><label>&nbsp;</label><button class="btn pink">Add Premium</button></div></form></div><div class="section card"><div class="hero"><div><h2>Active Premium Users</h2><div class="sub">${entries.length} active account${entries.length===1?'':'s'}</div></div></div>${rows?`<table class="table"><tr><th>User</th><th>Added</th><th>Plan / Expiry</th><th>Action</th></tr>${rows}</table>`:'<div class="empty">No active Premium users.</div>'}</div><script>function filterPremium(){const q=document.getElementById('premiumSearch').value.toLowerCase().trim();document.querySelectorAll('.premium-row').forEach(r=>r.style.display=!q||r.dataset.user.includes(q)?'':'none')}</script>`, 'premium');
}

function keyPage() {
  const all = keys();
  const available = all.filter(k => !k.redeemedAt).length;
  const used = all.length - available;
  const rows = all.sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)).map(k=>`<tr><td><code class="mono">${esc(k.key)}</code></td><td>${esc(k.durationMs?duration(k.durationMs):'Lifetime')}</td><td><span class="pill ${k.redeemedAt?'bad':'good'}">${k.redeemedAt?'Used':'Available'}</span>${k.redeemedBy?`<div class="sub mono">By ${esc(k.redeemedBy)}</div>`:''}</td><td>${esc(formatDate(k.keyExpiresAt))}</td><td>${esc(formatDate(k.createdAt))}</td><td><form method="post" action="/dashboard/keys/delete"><input type="hidden" name="key" value="${esc(k.key)}"><button class="btn red small" onclick="return confirm('Delete this key?')">Delete</button></form></td></tr>`).join('');
  return shell('Premium Keys', `<div class="top"><div><h1>Premium Keys 🔑</h1><div class="sub">6-character mixed letter/number keys • single-use • lifetime keys have a 30-day redemption window.</div></div></div><div class="grid"><div class="card"><div class="muted">Total keys</div><div class="num">${all.length}</div></div><div class="card"><div class="muted">Available</div><div class="num">${available}</div></div><div class="card"><div class="muted">Redeemed</div><div class="num">${used}</div></div><div class="card"><div class="muted">Key format</div><div class="num" style="font-size:22px">A7K2Q9</div><div class="sub">Exactly 6 characters</div></div></div><div class="section card"><h2>Generate keys</h2><form class="form" method="post" action="/dashboard/keys/generate"><div class="field"><label>Target user (optional)</label><input name="userId" pattern="\\d{17,20}" placeholder="Discord User ID"></div><div class="field"><label>Premium duration</label><input name="duration" placeholder="7d / 30d / 1mo / blank = lifetime"></div><div class="field"><label>Quantity (1–25)</label><input name="quantity" type="number" min="1" max="25" value="1"></div><div class="field"><label>&nbsp;</label><button class="btn pink">Generate Key(s)</button></div></form><p class="sub" style="margin-top:10px">Bulk mode is handy for giveaways and staff distribution.</p></div><div class="section card"><h2>All Keys</h2>${rows?`<table class="table"><tr><th>Key</th><th>Duration</th><th>Status</th><th>Deadline</th><th>Created</th><th>Action</th></tr>${rows}</table>`:'<div class="empty">No keys.</div>'}</div>`, 'keys');
}

function guilds(client) {
  const logs=getAllLogChannels();
  const rows=[...client.guilds.cache.values()].sort((a,b)=>a.name.localeCompare(b.name)).map(g=>`<tr><td><b>${esc(g.name)}</b><div class="sub mono">${g.id}</div></td><td>${g.memberCount??'—'}</td><td>${esc(g.ownerId||'—')}</td><td>${logs[g.id]?`<span class="pill good">Logs set</span>`:'<span class="pill">Not set</span>'}</td><td><form method="post" action="/dashboard/guilds/leave"><input type="hidden" name="guildId" value="${g.id}"><button class="btn red small" onclick="return confirm('Leave this guild?')">Leave</button></form></td></tr>`).join('');
  return shell('Guilds', `<div class="top"><div><h1>Bot Guilds ◈</h1><div class="sub">Every server ${BOT_NAME} is currently connected to.</div></div></div><div class="card"><table class="table"><tr><th>Guild</th><th>Members</th><th>Owner ID</th><th>Logs</th><th>Action</th></tr>${rows||'<tr><td colspan="5" class="empty">No guilds.</td></tr>'}</table></div>`, 'guilds');
}

function logsPage(client) {
  const configured=getAllLogChannels();
  const rows=[...client.guilds.cache.values()].sort((a,b)=>a.name.localeCompare(b.name)).map(g=>`<tr><td><b>${esc(g.name)}</b><div class="sub mono">${g.id}</div></td><td>${configured[g.id]?`<span class="pill good">Configured</span>`:'<span class="pill">Not configured</span>'}</td><td>${configured[g.id]?`<#${configured[g.id]}>`:'—'}</td></tr>`).join('');
  return shell('Logs', `<div class="top"><div><h1>Logs Center ▣</h1><div class="sub">See which guilds have a log channel configured. The bot sends configured event logs there.</div></div></div><div class="notice">Current log scope includes the bot's configured server log events, including <b>invite creation</b> and <b>successful invite creation</b> logging where the corresponding event handler is enabled.</div><div class="card"><table class="table"><tr><th>Guild</th><th>Status</th><th>Channel</th></tr>${rows||'<tr><td colspan="3" class="empty">No guilds.</td></tr>'}</table></div>`, 'logs');
}

function settings(client) {
  const gs=[...client.guilds.cache.values()];
  const channels=[...client.channels.cache.values()].filter(c=>c.guild&&c.isTextBased?.());
  const opts=channels.map(c=>`<option value="${c.id}">${esc(c.guild.name)} / #${esc(c.name)}</option>`).join('');
  const logMap=getAllLogChannels();
  const current=gs.map(g=>`<tr><td>${esc(g.name)}</td><td>${getCommandChannel(g.id)?`<#${getCommandChannel(g.id)}>`:'Not set'}</td><td>${logMap[g.id]?`<#${logMap[g.id]}>`:'Not set'}</td></tr>`).join('');
  return shell('Settings', `<div class="top"><div><h1>Server Settings ⚙</h1><div class="sub">Configure the command channel and the single log channel per server.</div></div></div><div class="grid"><div class="card"><h2>Command Channel</h2><div class="sub">Only this channel accepts bot commands for that guild.</div><form method="post" action="/dashboard/settings/command"><div class="field"><label>Guild</label><select name="guildId" required>${gs.map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select></div><div class="field" style="margin-top:9px"><label>Channel</label><select name="channelId" required>${opts}</select></div><button class="btn pink" style="margin-top:9px">Save Command Channel</button></form></div><div class="card"><h2>Logs Channel</h2><div class="sub">Invite creation, successful invite creation and other configured bot events.</div><form method="post" action="/dashboard/settings/logs"><div class="field"><label>Guild</label><select name="guildId" required>${gs.map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select></div><div class="field" style="margin-top:9px"><label>Channel</label><select name="channelId" required>${opts}</select></div><button class="btn pink" style="margin-top:9px">Save Logs Channel</button></form></div></div><div class="section card"><h2>Current Configuration</h2><table class="table"><tr><th>Guild</th><th>Command Channel</th><th>Logs Channel</th></tr>${current||'<tr><td colspan="3" class="empty">No guilds.</td></tr>'}</table></div>`, 'settings');
}

function analytics(client) {
  const allKeys = keys(); const used = allKeys.filter(k=>k.redeemedAt).length;
  const premium = premiumEntries(); const expiring = expiringPremiumEntries(7).length;
  const lifetime = premium.filter(([,e])=>!e.expiresAt).length;
  const inviteTotal = inviteRows(client).reduce((n,[,u])=>n+u,0);
  const conversion = allKeys.length ? Math.round(used/allKeys.length*100) : 0;
  const topGuilds = [...client.guilds.cache.values()].sort((a,b)=>(b.memberCount||0)-(a.memberCount||0)).slice(0,8).map(g=>`<div class="statline"><span>${esc(g.name)}</span><b>${g.memberCount??'—'} members</b></div>`).join('');
  return shell('Analytics', `<div class="top"><div><h1>Orbie Analytics ◈</h1><div class="sub">Quick health, Premium and growth insights.</div></div><span class="heroBadge">Updated ${esc(new Date().toLocaleTimeString())}</span></div><div class="grid"><div class="card"><div class="muted">Key redemption</div><div class="num">${conversion}%</div><div class="sub">${used} of ${allKeys.length} keys redeemed</div></div><div class="card"><div class="muted">Lifetime Premium</div><div class="num">${lifetime}</div><div class="sub">Permanent active users</div></div><div class="card"><div class="muted">Expiring in 7 days</div><div class="num">${expiring}</div><div class="sub">Follow-up opportunities</div></div><div class="card"><div class="muted">Tracked invite uses</div><div class="num">${inviteTotal}</div><div class="sub">Across cached guild invites</div></div></div><div class="grid section"><div class="card"><h2>Premium health</h2><div class="statline"><span>Active users</span><b>${premium.length}</b></div><div class="statline"><span>Lifetime</span><b>${lifetime}</b></div><div class="statline"><span>Timed plans</span><b>${premium.length-lifetime}</b></div><div class="statline"><span>Expiring ≤ 7d</span><b>${expiring}</b></div></div><div class="card"><h2>Largest guilds</h2>${topGuilds||'<div class="empty">No guilds.</div>'}</div></div>`, 'analytics');
}

async function invites(client) {
  const rows = (await Promise.all(inviteRows(client).map(async ([id,uses],i)=>{ const u=await getUser(client,id); return `<tr><td><b>#${i+1}</b></td><td><div class="usercell">${u?.displayAvatarURL?`<img class="avatar" src="${esc(u.displayAvatarURL({size:64,extension:'png'}))}" alt="">`:''}<div><b>${esc(u?.tag||u?.username||'Unknown user')}</b><div class="sub mono">${id}</div></div></div></td><td><span class="pill good">${uses} uses</span></td></tr>`;}))).join('');
  return shell('Invites', `<div class="top"><div><h1>Invite Leaderboard ✈</h1><div class="sub">Who is bringing the most members through tracked invites.</div></div></div><div class="card"><table class="table"><tr><th>Rank</th><th>Inviter</th><th>Total uses</th></tr>${rows||'<tr><td colspan="3" class="empty">No invite data available.</td></tr>'}</table></div>`, 'invites');
}

function commands(client) {
  const rows=commandRows(client).map(c=>`<tr><td><b>${esc(c.name)}</b></td><td><code class="mono">$${esc(c.prefix)}</code></td><td><code class="mono">/${esc(c.slash)}</code></td><td>${esc(c.description)}</td></tr>`).join('');
  return shell('Commands', `<div class="top"><div><h1>Command Center ⌘</h1><div class="sub">Live command directory — prefix and slash names at a glance.</div></div></div><div class="card"><div class="notice">Default prefix: <b>$</b> • Slash commands are also enabled.</div><table class="table"><tr><th>Command</th><th>Prefix</th><th>Slash</th><th>Description</th></tr>${rows||'<tr><td colspan="4" class="empty">No commands loaded.</td></tr>'}</table></div>`, 'commands');
}

export function startDashboard(client) {
  const server=http.createServer(async(req,res)=>{
    try {
      const u=new URL(req.url,`http://${req.headers.host||'localhost'}`); const path=u.pathname;
      if(path==='/dashboard/login'&&req.method==='GET') return send(res,200,login());
      if(path==='/dashboard/login'&&req.method==='POST') { if(!PASSWORD)return send(res,503,'<h2>Dashboard password is not configured.</h2><p>Set DASHBOARD_PASSWORD in .env.</p>'); const b=await parseBody(req); if(b.get('password')!==PASSWORD)return send(res,401,login('Incorrect password.')); return redirect(res,'/dashboard',cookieFor(newSession())); }
      if(path==='/dashboard/logout'){const t=parseCookies(req.headers.cookie||'')[COOKIE];if(t)sessions.delete(t);return redirect(res,'/dashboard/login',clearCookie());}
      if(!path.startsWith('/dashboard'))return send(res,404,'Not found');
      if(!authPage(req,res))return;
      if(path==='/dashboard'&&req.method==='GET')return send(res,200,await overview(client));
      if(path==='/dashboard/premium'&&req.method==='GET')return send(res,200,await premium(client));
      if(path==='/dashboard/keys'&&req.method==='GET')return send(res,200,keyPage());
      if(path==='/dashboard/analytics'&&req.method==='GET')return send(res,200,analytics(client));
      if(path==='/dashboard/invites'&&req.method==='GET')return send(res,200,await invites(client));
      if(path==='/dashboard/commands'&&req.method==='GET')return send(res,200,commands(client));
      if(path==='/dashboard/guilds'&&req.method==='GET')return send(res,200,guilds(client));
      if(path==='/dashboard/logs'&&req.method==='GET')return send(res,200,logsPage(client));
      if(path==='/dashboard/settings'&&req.method==='GET')return send(res,200,settings(client));
      if(path==='/dashboard/premium/add'&&req.method==='POST'){const b=await parseBody(req);if(!/^\d{17,20}$/.test(b.get('userId')||''))return send(res,400,'Invalid Discord user ID.');const raw=(b.get('duration')||'').trim();const ms=raw?durationToMs(raw):null;if(raw&&!ms)return send(res,400,'Invalid duration.');addPremium(b.get('userId'),ms);return redirect(res,'/dashboard/premium');}
      if(path==='/dashboard/premium/remove'&&req.method==='POST'){const b=await parseBody(req);if(/^\d{17,20}$/.test(b.get('userId')||''))removePremium(b.get('userId'));return redirect(res,'/dashboard/premium');}
      if(path==='/dashboard/premium/extend'&&req.method==='POST'){const b=await parseBody(req);const id=(b.get('userId')||'').trim();const raw=(b.get('duration')||'7d').trim();const ms=durationToMs(raw);if(/^\d{17,20}$/.test(id)&&ms){const current=getPremium(id);if(current) addPremium(id,ms,{extend:true});}return redirect(res,'/dashboard/premium');}
      if(path==='/dashboard/keys/generate'&&req.method==='POST'){const b=await parseBody(req);const id=(b.get('userId')||'').trim();if(id&&!/^\d{17,20}$/.test(id))return send(res,400,'Invalid Discord user ID.');const raw=(b.get('duration')||'').trim();const ms=raw?durationToMs(raw):null;if(raw&&!ms)return send(res,400,'Invalid duration.');const quantity=Math.min(25,Math.max(1,Number(b.get('quantity')||1)));for(let i=0;i<quantity;i++)generatePremiumKey({userId:id||null,durationMs:ms,source:'dashboard'});return redirect(res,'/dashboard/keys');}
      if(path==='/dashboard/keys/delete'&&req.method==='POST'){const b=await parseBody(req);deletePremiumKey(b.get('key'));return redirect(res,'/dashboard/keys');}
      if(path==='/dashboard/guilds/leave'&&req.method==='POST'){const b=await parseBody(req);const g=client.guilds.cache.get(b.get('guildId'));if(g)await g.leave().catch(()=>{});return redirect(res,'/dashboard/guilds');}
      if(path==='/dashboard/settings/command'&&req.method==='POST'){const b=await parseBody(req);const g=client.guilds.cache.get(b.get('guildId'));const c=client.channels.cache.get(b.get('channelId'));if(g&&c&&c.guildId===g.id)setCommandChannel(g.id,c.id);return redirect(res,'/dashboard/settings');}
      if(path==='/dashboard/settings/logs'&&req.method==='POST'){const b=await parseBody(req);const g=client.guilds.cache.get(b.get('guildId'));const c=client.channels.cache.get(b.get('channelId'));if(g&&c&&c.guildId===g.id)setLogChannel(g.id,c.id);return redirect(res,'/dashboard/settings');}
      return send(res,404,shell('Not Found','<div class="card"><h1>404</h1><p class="muted">That dashboard page does not exist.</p></div>'));
    }catch(err){console.error('[Dashboard]',err);send(res,500,shell('Error',`<div class="card"><h1>Something went wrong</h1><p class="muted">${esc(err.message||'Internal error')}</p></div>`));}
  });
  if(!PASSWORD)console.warn('[Dashboard] DASHBOARD_PASSWORD is not set; login is disabled.');
  server.listen(PORT,HOST,()=>console.log(`[Dashboard] Running on http://${HOST==='0.0.0.0'?'free-us1.nexiohost.in':HOST}:${PORT}/dashboard`));
  return server;
}
