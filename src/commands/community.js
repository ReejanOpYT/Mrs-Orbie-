import { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } from 'discord.js';
import { PREFIX, BOT_NAME } from '../utils/config.js';
import { getEmoji } from '../handlers/emoji.js';
import { withFooter } from '../utils/cv2Footer.js';
import fs from 'node:fs';
import path from 'node:path';

const FILE = path.join(process.cwd(), 'data', 'inviteCache.json');
function loadInvites(){ try { return JSON.parse(fs.readFileSync(FILE,'utf8')) || {}; } catch { return {}; } }
function card(title, body, color=0xE879F9){ const c=new ContainerBuilder().setAccentColor(color); c.addTextDisplayComponents(new TextDisplayBuilder().setContent(title)); c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)); c.addTextDisplayComponents(new TextDisplayBuilder().setContent(body)); return withFooter(c); }
const icon=(n,f='•')=>getEmoji(n)||f;

export const myInvitesCommand = {
  data: new SlashCommandBuilder().setName('myinvites').setDescription('See your tracked invite performance'),
  prefix: 'myinvites',
  async execute(i){ return i.reply(buildInvites(i.guild, i.user)); },
  async prefixExecute(m){ return m.reply(buildInvites(m.guild, m.author)); },
};
function buildInvites(guild,user){
  if(!guild) return card(`${icon('error','❌')} Server Only`, 'This command must be used inside a server.',0xED4245);
  const cache=loadInvites()[guild.id] || {};
  const rows=Object.values(cache).filter(x=>x.inviterId===user.id);
  const uses=rows.reduce((n,x)=>n+Number(x.uses||0),0);
  const codes=rows.length;
  return card(`# ${icon('link','🔗')} ${user.username} • Invite Stats`,
    `${icon('success','✓')} **Tracked successful uses:** **${uses}**\n`+
    `${icon('link','🔗')} **Invite codes:** **${codes}**\n`+
    `${icon('dot','•')} **Reward:** **1 Orbie Point** per successful invite\n\n`+
    `-# Invite tracking depends on Discord invite permissions and the bot's cached invite data.`,0xF472B6);
}

export const serverInfoCommand = {
  data: new SlashCommandBuilder().setName('serverinfo').setDescription('View a detailed server overview'),
  prefix: 'serverinfo',
  async execute(i){ return i.reply(buildServer(i.guild)); },
  async prefixExecute(m){ return m.reply(buildServer(m.guild)); },
};
function buildServer(g){
  if(!g) return card(`${icon('error','❌')} Server Only`, 'This command must be used inside a server.',0xED4245);
  const owner=g.ownerId ? `<@${g.ownerId}>` : 'Unknown';
  const text=`# ${icon('server','🏠')} ${g.name}\n`+
    `${icon('dot')} **Owner:** ${owner}\n`+
    `${icon('user')} **Members:** ${g.memberCount?.toLocaleString() ?? 'Unknown'}\n`+
    `${icon('dot')} **Channels:** ${g.channels.cache.size}\n`+
    `${icon('dot')} **Roles:** ${g.roles.cache.size}\n`+
    `${icon('dot')} **Boosts:** ${g.premiumSubscriptionCount ?? 0}\n`+
    `${icon('info')} **Created:** <t:${Math.floor(g.createdTimestamp/1000)}:D>\n`+
    `${icon('link')} **Server ID:** \`${g.id}\`\n\n`+
    `-# ${BOT_NAME} • Server overview`;
  return card(text,'',0xE879F9);
}
