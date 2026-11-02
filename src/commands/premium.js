import { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags, SeparatorBuilder, SeparatorSpacingSize } from 'discord.js';
import { isOwner } from './access.js';
import { addPremium, removePremium, getPremium, durationToMs, premiumDurationText } from '../utils/premiumStore.js';
import { getEmoji } from '../handlers/emoji.js';
import { withFooter } from '../utils/cv2Footer.js';
import { PREFIX, BOT_NAME } from '../utils/config.js';
import { guildLog } from '../utils/guildLogger.js';

const card = (text, color = 0xE879F9, ephemeral = false, user = null) => {
  const c = new ContainerBuilder().setAccentColor(color);
  if (user) {
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${getEmoji('premium')} ${BOT_NAME} Premium\n-# A little extra magic for your account ♡`));
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  }
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  return withFooter(c, ephemeral ? MessageFlags.Ephemeral : 0);
};
const targetId = (raw) => {
  if (!raw) return null;
  const mention = raw.match(/^<@!?(\d+)>$/);
  return mention?.[1] ?? (/^\d{17,20}$/.test(raw) ? raw : null);
};

const addpremiumCommand = {
  data: new SlashCommandBuilder().setName('addpremium').setDescription(`Give a user ${BOT_NAME} Premium (Owner only)`)
    .addUserOption(o => o.setName('user').setDescription('User to receive Premium').setRequired(true))
    .addStringOption(o => o.setName('duration').setDescription('10m, 2h, 7d, 1w, 1mo; leave empty for lifetime').setRequired(false)),
  prefix: 'addpremium',
  async execute(i) {
    if (!isOwner(i.user.id)) return i.reply(card(`${getEmoji('error')} This command is **owner only**.`, 0xED4245, true));
    const user = i.options.getUser('user');
    const raw = i.options.getString('duration');
    const ms = raw ? durationToMs(raw) : null;
    if (raw && !ms) return i.reply(card(`${getEmoji('error')} Invalid duration. Use \`10m\`, \`2h\`, \`7d\`, \`1w\`, or \`1mo\`.`, 0xED4245, true));
    const entry = addPremium(user.id, ms);
    await guildLog(i.guild, { category:'Premium', title:'Premium Granted', description:`${i.user} granted Premium to ${user}.`, fields:[{name:'Owner',value:`${i.user} (${i.user.id})`},{name:'User',value:`${user} (${user.id})`},{name:'Plan',value:premiumDurationText(entry)}], color:'premium' });
    return i.reply(card(`${getEmoji('heart')} **Premium Activated**\n\n${getEmoji('user')} **User:** ${user}\n${getEmoji('star')} **Plan:** ${premiumDurationText(entry)}\n${getEmoji('sparkle')} **Unlocked:** Multi-account linking, \`/questall\`, and \`/autoquest\``));
  },
  async prefixExecute(message, args) {
    if (!isOwner(message.author.id)) return message.reply(card(`${getEmoji('error')} This command is **owner only**.`, 0xED4245));
    const id = targetId(args.shift());
    if (!id) return message.reply(card(`${getEmoji('error')} Usage: \`${PREFIX}addpremium @user [duration]\``, 0xED4245));
    const raw = args.shift();
    const ms = raw ? durationToMs(raw) : null;
    if (raw && !ms) return message.reply(card(`${getEmoji('error')} Invalid duration.`, 0xED4245));
    const user = await message.client.users.fetch(id).catch(() => null);
    const entry = addPremium(id, ms);
    await guildLog(message.guild, { category:'Premium', title:'Premium Granted', description:`${message.author} granted Premium to <@${id}>.`, fields:[{name:'Owner',value:`${message.author} (${message.author.id})`},{name:'User',value:`<@${id}> (${id})`},{name:'Plan',value:premiumDurationText(entry)}], color:'premium' });
    return message.reply(card(`${getEmoji('heart')} **Premium Activated**\n${getEmoji('user')} **User:** ${user ?? `<@${id}>`}\n${getEmoji('star')} **Plan:** ${premiumDurationText(entry)}`));
  },
};

const removepremiumCommand = {
  data: new SlashCommandBuilder().setName('removepremium').setDescription(`Remove ${BOT_NAME} Premium (Owner only)`)
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),
  prefix: 'removepremium',
  async execute(i) {
    if (!isOwner(i.user.id)) return i.reply(card(`${getEmoji('error')} This command is **owner only**.`, 0xED4245, true));
    const user = i.options.getUser('user');
    const existed = removePremium(user.id);
    if (existed) await guildLog(i.guild, { category:'Premium', title:'Premium Removed', description:`${i.user} removed Premium from ${user}.`, fields:[{name:'Owner',value:`${i.user} (${i.user.id})`},{name:'User',value:`${user} (${user.id})`}], color:'premium' });
    return i.reply(card(existed ? `${getEmoji('success')} Premium removed from ${user}.` : `${getEmoji('warning')} ${user} does not have Premium.`));
  },
  async prefixExecute(message, args) {
    if (!isOwner(message.author.id)) return message.reply(card(`${getEmoji('error')} This command is **owner only**.`, 0xED4245));
    const id = targetId(args.shift());
    if (!id) return message.reply(card(`${getEmoji('error')} Usage: \`${PREFIX}removepremium @user\``, 0xED4245));
    const existed = removePremium(id);
    if (existed) await guildLog(message.guild, { category:'Premium', title:'Premium Removed', description:`${message.author} removed Premium from <@${id}>.`, fields:[{name:'Owner',value:`${message.author} (${message.author.id})`},{name:'User',value:`<@${id}> (${id})`}], color:'premium' });
    return message.reply(card(existed ? `${getEmoji('success')} Premium removed from <@${id}>.` : `${getEmoji('warning')} <@${id}> does not have Premium.`));
  },
};

const premiumCommand = {
  data: new SlashCommandBuilder().setName('premium').setDescription(`View ${BOT_NAME} Premium status`)
    .addUserOption(o => o.setName('user').setDescription('Optional user; owner can inspect anyone').setRequired(false)),
  prefix: 'premium',
  async execute(i) {
    const target = i.options.getUser('user');
    if (target && target.id !== i.user.id && !isOwner(i.user.id)) return i.reply(card(`${getEmoji('error')} You can only view your own Premium status.`, 0xED4245, true));
    const userId = target?.id ?? i.user.id;
    const entry = getPremium(userId);
    return i.reply(card(entry
      ? `${getEmoji('heart')} **${BOT_NAME} Premium**\n\n${getEmoji('success')} **Status:** Active\n${getEmoji('star')} **Plan:** ${premiumDurationText(entry)}\n${getEmoji('sparkle')} **Features:** Main + Alt account, \`/questall\`, \`/autoquest\``
      : `${getEmoji('warning')} **${BOT_NAME} Premium**\n\n${getEmoji('error')} **Status:** Not active\n${getEmoji('info')} Premium unlocks multi-account linking, \`/questall\`, and \`/autoquest\`.`));
  },
  async prefixExecute(message, args) {
    const id = targetId(args[0]);
    if (id && id !== message.author.id && !isOwner(message.author.id)) return message.reply(card(`${getEmoji('error')} You can only view your own Premium status.`, 0xED4245));
    const userId = id ?? message.author.id;
    const entry = getPremium(userId);
    return message.reply(card(entry
      ? `${getEmoji('heart')} **${BOT_NAME} Premium**\n${getEmoji('success')} **Status:** Active\n${getEmoji('star')} **Plan:** ${premiumDurationText(entry)}`
      : `${getEmoji('warning')} **${BOT_NAME} Premium**\n${getEmoji('error')} **Status:** Not active\n${getEmoji('info')} Ask the bot owner for Premium access.`));
  },
};

export { addpremiumCommand, removepremiumCommand, premiumCommand };
