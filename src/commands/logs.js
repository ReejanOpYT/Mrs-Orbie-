import { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import { setLogChannel, removeLogChannel, getLogChannel } from '../utils/logStore.js';
import { getEmoji } from '../handlers/emoji.js';
import { withFooter } from '../utils/cv2Footer.js';
import { PREFIX, BOT_NAME } from '../utils/config.js';

const OWNER_ONLY = 'Only the server owner or a server administrator can manage the log channel.';
function card(text, color=0xF472B6, ephemeral=false){ const c=new ContainerBuilder().setAccentColor(color).addTextDisplayComponents(new TextDisplayBuilder().setContent(text)); return withFooter(c,ephemeral?MessageFlags.Ephemeral:0); }
function admin(member){ return Boolean(member?.permissions?.has?.('Administrator') || member?.guild?.ownerId===member?.id); }
function channelIdFrom(raw){ const m=String(raw??'').match(/^<#(\d+)>$/); return m?.[1] ?? (/^\d{17,20}$/.test(String(raw??''))?String(raw):null); }

const logsCommand = {
 data:new SlashCommandBuilder().setName('logs').setDescription('Configure Mrs Orbie server logs')
  .addSubcommand(s=>s.setName('setup').setDescription('Set the channel where all Mrs Orbie logs will be sent').addChannelOption(o=>o.setName('channel').setDescription('Log channel').setRequired(true)))
  .addSubcommand(s=>s.setName('disable').setDescription('Disable Mrs Orbie logs'))
  .addSubcommand(s=>s.setName('status').setDescription('Show the current log channel')),
 prefix:'logs',
 async execute(i){
  if (!i.guild) return i.reply(card(`${getEmoji('error')} This command can only be used in a server.`,0xED4245,true));
  if(!admin(i.member)) return i.reply(card(`${getEmoji('error')} ${OWNER_ONLY}`,0xED4245,true));
  const sub=i.options.getSubcommand();
  if(sub==='setup'){
   const ch=i.options.getChannel('channel'); if(!ch.isTextBased()) return i.reply(card(`${getEmoji('error')} Please select a text channel.`,0xED4245,true));
   setLogChannel(i.guild.id,ch.id);
   await i.reply(card(`${getEmoji('setup')} **${BOT_NAME} Logs Enabled**\n\n${getEmoji('dot')} **Channel:** ${ch}\n${getEmoji('sparkle')} Command logs, invite creation logs, successful invite logs, and Premium activity logs will be sent here.`));
   return;
  }
  if(sub==='disable'){ removeLogChannel(i.guild.id); return i.reply(card(`${getEmoji('success')} ${BOT_NAME} logs have been disabled.`)); }
  const id=getLogChannel(i.guild.id); return i.reply(card(id?`${getEmoji('setup')} **Logs are enabled**\n\n${getEmoji('dot')} Channel: <#${id}>`:`${getEmoji('warning')} **Logs are not configured**\n\nUse \`/logs setup\` or \`${PREFIX}logs setup #channel\`.`));
 },
 async prefixExecute(m,args){
  if(!m.guild) return m.reply(card(`${getEmoji('error')} This command can only be used in a server.`,0xED4245));
  if(!admin(m.member)) return m.reply(card(`${getEmoji('error')} ${OWNER_ONLY}`,0xED4245));
  const sub=(args.shift()||'status').toLowerCase();
  if(sub==='setup'){
   const raw=args.shift(); const id=channelIdFrom(raw); const ch=id?await m.guild.channels.fetch(id).catch(()=>null):null;
   if(!ch?.isTextBased?.()) return m.reply(card(`${getEmoji('error')} Usage: \`${PREFIX}logs setup #channel\``,0xED4245));
   setLogChannel(m.guild.id,ch.id);
   await m.reply(card(`${getEmoji('setup')} **${BOT_NAME} Logs Enabled**\n\n${getEmoji('dot')} **Channel:** ${ch}\n${getEmoji('sparkle')} Command logs, invite creation logs, successful invite logs, and Premium activity logs will be sent here.`));
   return;
  }
  if(sub==='disable'){ removeLogChannel(m.guild.id); return m.reply(card(`${getEmoji('success')} ${BOT_NAME} logs have been disabled.`)); }
  const id=getLogChannel(m.guild.id); return m.reply(card(id?`${getEmoji('setup')} **Logs are enabled**\n${getEmoji('dot')} Channel: <#${id}>`:`${getEmoji('warning')} Logs are not configured. Use \`${PREFIX}logs setup #channel\`.`));
 }
};
export default logsCommand;
