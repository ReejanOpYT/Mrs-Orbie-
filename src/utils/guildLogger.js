import { EmbedBuilder } from 'discord.js';
import { getLogChannel } from './logStore.js';
import { getEmoji } from '../handlers/emoji.js';

const colors = { success:0x57F287, error:0xED4245, warning:0xFEE75C, info:0x5865F2, premium:0xE879F9, invite:0xF472B6 };
const icons = { Command:'📋', Invite:'📨', Premium:getEmoji('premium'), Quest:getEmoji('quest') };
export async function guildLog(guild, { category='Server', title='Log', description='', fields=[], color='info' } = {}) {
  if (!guild) return false;
  const channelId = getLogChannel(guild.id); if (!channelId) return false;
  const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(()=>null);
  if (!channel?.isTextBased?.()) return false;
  const embed = new EmbedBuilder().setColor(colors[color] ?? colors.info).setTitle(`${icons[category] ?? '📌'} ${title}`).setDescription(String(description||'').slice(0,4096)).setTimestamp();
  const safeFields = fields.filter(f=>f?.name&&f?.value).slice(0,25).map(f=>({name:String(f.name).slice(0,256),value:String(f.value).slice(0,1024),inline:Boolean(f.inline)}));
  if (safeFields.length) embed.addFields(safeFields);
  await channel.send({ embeds:[embed] }).catch(()=>null);
  return true;
}
