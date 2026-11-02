import { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import { PREFIX, BOT_NAME } from '../utils/config.js';
import { addBlacklist, removeBlacklist } from '../utils/accessStore.js';
import { logWebhook } from '../utils/webhookLogger.js';
import { getEmoji } from '../handlers/emoji.js';
import { withFooter } from '../utils/cv2Footer.js';

const OWNER_ID = process.env.BOT_OWNER_ID || '1293127492982407195';
const ownerOnly = (id) => id === OWNER_ID;
const mention = (id) => `<@${id}>`;

function card(text, color = 0x5865F2, ephemeral = false) {
  const c = new ContainerBuilder().setAccentColor(color);
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  return withFooter(c, ephemeral ? MessageFlags.Ephemeral : 0);
}
function targetId(message, args) {
  const raw = args.shift();
  if (!raw) return null;
  const m = raw.match(/^<@!?(\d+)>$/);
  return m ? m[1] : /^\d{17,20}$/.test(raw) ? raw : null;
}
function parseDuration(value) {
  if (!value) return null;
  const m = value.match(/^(\d+)(m|h|d|w)$/i);
  if (!m) return null;
  const units = { m: 60e3, h: 3600e3, d: 86400e3, w: 604800e3 };
  return Number(m[1]) * units[m[2].toLowerCase()];
}
function durationText(ms) {
  if (!ms) return 'Permanent';
  const units = [['w',604800e3],['d',86400e3],['h',3600e3],['m',60e3]];
  for (const [name, value] of units) if (ms % value === 0) return `${ms / value}${name}`;
  return `${Math.round(ms / 1000)}s`;
}
async function audit(ctx, command, status = 'Used') {
  try { await logWebhook({ type: 'Blacklist Action', user: ctx.user ?? ctx.author, guild: ctx.guild, command, source: ctx.user ? 'Slash' : 'Prefix', status }); } catch {}
}

export const blacklistCommand = {
  data: new SlashCommandBuilder().setName('blacklist').setDescription('Blacklist a user (Owner only)')
    .addUserOption(o => o.setName('user').setDescription('User to blacklist').setRequired(true))
    .addStringOption(o => o.setName('duration').setDescription('Optional: 10m, 2h, 7d, 1w').setRequired(false))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),
  prefix: 'blacklist',
  async execute(interaction) {
    if (!ownerOnly(interaction.user.id)) return interaction.reply(card(`${getEmoji('error')} Owner only.`, 0xED4245, true));
    const user = interaction.options.getUser('user');
    if (user.bot || user.id === OWNER_ID) return interaction.reply(card(`${getEmoji('error')} This user cannot be blacklisted.`, 0xED4245, true));
    const duration = interaction.options.getString('duration');
    const durationMs = duration ? parseDuration(duration) : null;
    if (duration && !durationMs) return interaction.reply(card(`${getEmoji('error')} Invalid duration. Use \`10m\`, \`2h\`, \`7d\`, or \`1w\`.`, 0xED4245, true));
    const reason = interaction.options.getString('reason')?.trim() || 'No reason provided';
    const entry = addBlacklist(user.id, reason, interaction.user.id, durationMs);
    await audit(interaction, 'blacklist');
    await user.send(`${getEmoji('warning')} You have been blacklisted from using ${BOT_NAME}.\nReason: ${reason}${entry.expiresAt ? `\nExpires: <t:${Math.floor(Date.parse(entry.expiresAt)/1000)}:R>` : '\nDuration: Permanent'}`).catch(() => {});
    return interaction.reply(card(`${getEmoji('warning')} **Blacklisted** ${user}\n${getEmoji('info')} **Reason:** ${reason}\n${getEmoji('date')} **Duration:** ${durationText(durationMs)}`));
  },
  async prefixExecute(message, args) {
    if (!ownerOnly(message.author.id)) return message.reply(card(`${getEmoji('error')} Owner only.`, 0xED4245));
    const id = targetId(message, args);
    if (!id) return message.reply(card(`${getEmoji('error')} Usage: \`${PREFIX}blacklist @user [duration] [reason]\``, 0xED4245));
    if (id === OWNER_ID) return message.reply(card(`${getEmoji('error')} The bot owner cannot be blacklisted.`, 0xED4245));
    const durationMs = args[0] && parseDuration(args[0]) ? parseDuration(args.shift()) : null;
    const reason = args.join(' ').trim() || 'No reason provided';
    const entry = addBlacklist(id, reason, message.author.id, durationMs);
    await audit(message, 'blacklist');
    const user = await message.client.users.fetch(id).catch(() => null);
    if (user) await user.send(`${getEmoji('warning')} You have been blacklisted from using ${BOT_NAME}.\nReason: ${reason}${entry.expiresAt ? `\nExpires: <t:${Math.floor(Date.parse(entry.expiresAt)/1000)}:R>` : '\nDuration: Permanent'}`).catch(() => {});
    return message.reply(card(`${getEmoji('warning')} **Blacklisted** ${mention(id)}\n${getEmoji('info')} **Reason:** ${reason}\n${getEmoji('date')} **Duration:** ${durationText(durationMs)}`));
  }
};

export const unblacklistCommand = {
  data: new SlashCommandBuilder().setName('unblacklist').setDescription('Remove a user from the blacklist (Owner only)')
    .addUserOption(o => o.setName('user').setDescription('User to unblacklist').setRequired(true)),
  prefix: 'unblacklist',
  async execute(interaction) {
    if (!ownerOnly(interaction.user.id)) return interaction.reply(card(`${getEmoji('error')} Owner only.`, 0xED4245, true));
    const user = interaction.options.getUser('user');
    const existed = removeBlacklist(user.id, interaction.user.id);
    await audit(interaction, 'unblacklist');
    return interaction.reply(card(existed ? `${getEmoji('success')} Removed ${user} from the blacklist.` : `${getEmoji('warning')} ${user} was not blacklisted.`));
  },
  async prefixExecute(message, args) {
    if (!ownerOnly(message.author.id)) return message.reply(card(`${getEmoji('error')} Owner only.`, 0xED4245));
    const id = targetId(message, args);
    if (!id) return message.reply(card(`${getEmoji('error')} Usage: \`${PREFIX}unblacklist @user\``, 0xED4245));
    const existed = removeBlacklist(id, message.author.id);
    await audit(message, 'unblacklist');
    return message.reply(card(existed ? `${getEmoji('success')} Removed ${mention(id)} from the blacklist.` : `${getEmoji('warning')} ${mention(id)} was not blacklisted.`));
  }
};

export function isOwner(id) { return ownerOnly(id); }
