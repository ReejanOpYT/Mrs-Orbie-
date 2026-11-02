import { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import { PREFIX } from '../utils/config.js';
import { getEmoji } from '../handlers/emoji.js';
import { getPoints, addPoints, removePoints, setPoints } from '../utils/orbiePointsStore.js';
import { isOwner } from './access.js';
import { withFooter } from '../utils/cv2Footer.js';

function card(text, color = 0xF472B6, ephemeral = false) {
  const c = new ContainerBuilder().setAccentColor(color);
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  return withFooter(c, ephemeral ? MessageFlags.Ephemeral : 0);
}

function parseUserId(raw) {
  if (!raw) return null;
  const mention = String(raw).match(/^<@!?(\d+)>$/);
  if (mention) return mention[1];
  return /^\d{17,20}$/.test(String(raw)) ? String(raw) : null;
}

function amount(raw) {
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

function ownerError(ephemeral = false) {
  return card(`${getEmoji('error')} **Owner Only**\nThis command can only be used by the **Mrs Orbie bot owner**.`, 0xED4245, ephemeral);
}

async function resolveTarget(client, id) {
  return client.users.fetch(id).catch(() => null);
}

function resultText(action, user, oldValue, newValue) {
  return `${getEmoji('success')} **Points Updated**\n\n` +
    `${getEmoji('user')} **User:** ${user}\n` +
    `${getEmoji('dot')} **Action:** ${action}\n` +
    `${getEmoji('dot')} **Previous:** ${oldValue} Orbie Points\n` +
    `${getEmoji('dot')} **Current:** **${newValue} Orbie Points**`;
}

const addPointsCommand = {
  data: new SlashCommandBuilder().setName('addpoints').setDescription('Add Orbie Points to a user (Owner only)')
    .addUserOption(o => o.setName('user').setDescription('User receiving points').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Number of points to add').setMinValue(1).setRequired(true)),
  prefix: 'addpoints',
  async execute(i) {
    if (!isOwner(i.user.id)) return i.reply(ownerError(true));
    const user = i.options.getUser('user');
    const n = i.options.getInteger('amount');
    const oldValue = getPoints(i.guildId, user.id);
    const newValue = addPoints(i.guildId, user.id, n);
    return i.reply(card(resultText(`+${n}`, user, oldValue, newValue)));
  },
  async prefixExecute(message, args) {
    if (!isOwner(message.author.id)) return message.reply(ownerError());
    const id = parseUserId(args.shift());
    const n = amount(args.shift());
    if (!id || !n || n < 1) return message.reply(card(`${getEmoji('error')} Usage: \`${PREFIX}addpoints @user <amount>\`\nExample: \`${PREFIX}addpoints @User 10\``, 0xED4245));
    const oldValue = getPoints(message.guildId, id);
    const newValue = addPoints(message.guildId, id, n);
    const user = await resolveTarget(message.client, id);
    return message.reply(card(resultText(`+${n}`, user ?? `<@${id}>`, oldValue, newValue)));
  },
};

const removePointsCommand = {
  data: new SlashCommandBuilder().setName('removepoints').setDescription('Remove Orbie Points from a user (Owner only)')
    .addUserOption(o => o.setName('user').setDescription('User losing points').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Number of points to remove').setMinValue(1).setRequired(true)),
  prefix: 'removepoints',
  async execute(i) {
    if (!isOwner(i.user.id)) return i.reply(ownerError(true));
    const user = i.options.getUser('user');
    const n = i.options.getInteger('amount');
    const oldValue = getPoints(i.guildId, user.id);
    if (!removePoints(i.guildId, user.id, n)) return i.reply(card(`${getEmoji('warning')} **Not enough points**\n${getEmoji('dot')} ${user} has **${oldValue}** Orbie Points, so **${n}** cannot be removed.`, 0xF59E0B, true));
    const newValue = getPoints(i.guildId, user.id);
    return i.reply(card(resultText(`-${n}`, user, oldValue, newValue)));
  },
  async prefixExecute(message, args) {
    if (!isOwner(message.author.id)) return message.reply(ownerError());
    const id = parseUserId(args.shift());
    const n = amount(args.shift());
    if (!id || !n || n < 1) return message.reply(card(`${getEmoji('error')} Usage: \`${PREFIX}removepoints @user <amount>\``, 0xED4245));
    const oldValue = getPoints(message.guildId, id);
    if (!removePoints(message.guildId, id, n)) return message.reply(card(`${getEmoji('warning')} **Not enough points**\n<@${id}> has **${oldValue}** Orbie Points, so **${n}** cannot be removed.`, 0xF59E0B));
    const newValue = getPoints(message.guildId, id);
    const user = await resolveTarget(message.client, id);
    return message.reply(card(resultText(`-${n}`, user ?? `<@${id}>`, oldValue, newValue)));
  },
};

const setPointsCommand = {
  data: new SlashCommandBuilder().setName('setpoints').setDescription('Set a user\'s Orbie Points (Owner only)')
    .addUserOption(o => o.setName('user').setDescription('User whose balance will be set').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('New point balance').setMinValue(0).setRequired(true)),
  prefix: 'setpoints',
  async execute(i) {
    if (!isOwner(i.user.id)) return i.reply(ownerError(true));
    const user = i.options.getUser('user');
    const n = i.options.getInteger('amount');
    const oldValue = getPoints(i.guildId, user.id);
    const newValue = setPoints(i.guildId, user.id, n);
    return i.reply(card(resultText(`Set to ${n}`, user, oldValue, newValue)));
  },
  async prefixExecute(message, args) {
    if (!isOwner(message.author.id)) return message.reply(ownerError());
    const id = parseUserId(args.shift());
    const n = amount(args.shift());
    if (!id || n === null) return message.reply(card(`${getEmoji('error')} Usage: \`${PREFIX}setpoints @user <amount>\``, 0xED4245));
    const oldValue = getPoints(message.guildId, id);
    const newValue = setPoints(message.guildId, id, n);
    const user = await resolveTarget(message.client, id);
    return message.reply(card(resultText(`Set to ${n}`, user ?? `<@${id}>`, oldValue, newValue)));
  },
};

export { addPointsCommand, removePointsCommand, setPointsCommand };
