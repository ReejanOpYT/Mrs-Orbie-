import * as fs from 'node:fs';
import * as path from 'node:path';

const FILE = path.join(process.cwd(), 'data', 'logChannels.json');
function load(){ try { const d=JSON.parse(fs.readFileSync(FILE,'utf8')); return d&&typeof d==='object'&&!Array.isArray(d)?d:{}; } catch { return {}; } }
function save(d){ fs.mkdirSync(path.dirname(FILE),{recursive:true}); fs.writeFileSync(FILE,JSON.stringify(d,null,2)); }
export function getLogChannel(guildId){ return load()[guildId] ?? null; }
export function setLogChannel(guildId, channelId){ const d=load(); d[guildId]=channelId; save(d); return channelId; }
export function removeLogChannel(guildId){ const d=load(); const old=d[guildId]??null; delete d[guildId]; save(d); return old; }
export function getAllLogChannels(){ return load(); }
