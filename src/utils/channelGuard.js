import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import { getEmoji } from '../handlers/emoji.js';
import { PREFIX } from './config.js';
import { getCommandChannel } from './channelStore.js';
import { withFooter } from './cv2Footer.js';

export function isServerAdmin(member, userId) {
  return Boolean(member && (member.permissions?.has('Administrator') || member.guild?.ownerId === userId));
}

export function buildChannelOnlyCard(channelId) {
  const c = new ContainerBuilder().setAccentColor(0xFEE75C);
  c.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `# ${getEmoji('warning')} Wrong Channel\n` +
      `Bot commands only work in <#${channelId}>.\n\n` +
      `Head over there and try again!`,
    ),
  );
  return withFooter(c);
}

export function buildChannelNotConfiguredCard() {
  const c = new ContainerBuilder().setAccentColor(0xFEE75C);
  c.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `# ${getEmoji('warning')} Bot channel is not configured\n` +
      `A server owner or Administrator must run \`${PREFIX}setchannel\` in the channel where you want to use the bot.\n\n` +
      `${getEmoji('arrow')} Slash: \`/setchannel\``,
    ),
  );
  return withFooter(c);
}

export function checkCommandChannel(guildId, channelId) {
  if (!guildId) return { allowed: true, configured: false, channelId: null };
  const configured = getCommandChannel(guildId);
  if (!configured) return { allowed: false, configured: false, channelId: null };
  return { allowed: configured === channelId, configured: true, channelId: configured };
}

export function ephemeralCard(card) {
  return { ...card, flags: (card.flags ?? MessageFlags.IsComponentsV2) | MessageFlags.Ephemeral };
}
