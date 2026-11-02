import {
  SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
  SeparatorSpacingSize, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
  MessageFlags, ChannelType,
} from 'discord.js';
import { isOwner } from './access.js';
import { addPremium, durationToMs, premiumDurationText } from '../utils/premiumStore.js';
import { generatePremiumKey, redeemPremiumKey, createKeyRevealToken } from '../utils/premiumKeyStore.js';
import { getEmoji, getButtonEmoji } from '../handlers/emoji.js';
import { withFooter } from '../utils/cv2Footer.js';
import { PREFIX, BOT_NAME } from '../utils/config.js';
import { guildLog } from '../utils/guildLogger.js';

const OWNER_ID = process.env.BOT_OWNER_ID || '1293127492982407195';

function panelCard() {
  const c = new ContainerBuilder().setAccentColor(0xF472B6);
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `# ${getEmoji('premium')} ${BOT_NAME} Premium\n-# Unlock the prettier side of ${BOT_NAME} ♡\n\n${getEmoji('heart')} Premium includes **Main + Alt linking**, **Quest All**, **Autoquest**, and more.`
    ));
  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `### ${getEmoji('key')} Premium Key Activation\n` +
    `${getEmoji('dot')} Premium keys are **6 characters** with a mix of letters and numbers and can be redeemed only once.\n` +
    `${getEmoji('dot')} Premium keys are **not account-locked** — anyone can redeem a valid key.\n` +
    `${getEmoji('dot')} Each key can be redeemed **once only**; after redemption it becomes permanently used.\n\n` +
    `### ${getEmoji('book_')} Important Notes\n` +
    `${getEmoji('dot')} **No trial system** — every key grants the exact Premium duration attached to it.\n` +
    `${getEmoji('dot')} Used, invalid, or expired keys cannot be redeemed.\n` +
    `${getEmoji('dot')} If your DMs are closed, contact the bot owner with your purchase details.`
  ));
  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  c.addActionRowComponents(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('premium_activate').setLabel('Activate Premium').setEmoji(getButtonEmoji('key')).setStyle(ButtonStyle.Primary),
  ));
  return withFooter(c, 0);
}

function resultCard(text, color = 0xF472B6, ephemeral = true) {
  const c = new ContainerBuilder().setAccentColor(color);
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  return withFooter(c, ephemeral ? MessageFlags.Ephemeral : 0);
}

export function buildPremiumActivationModal() {
  return new ModalBuilder()
    .setCustomId('premium_activation_modal')
    .setTitle('Mrs Orbie • Activate Premium')
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('premium_key_input')
        .setLabel('6-character Premium Key')
        .setPlaceholder('A7K2Q9')
        .setStyle(TextInputStyle.Short)
        .setMinLength(6)
        .setMaxLength(6)
        .setRequired(true),
    ));
}

export async function handlePremiumActivation(interaction) {
  const key = interaction.fields.getTextInputValue('premium_key_input').trim();
  if (!/^[A-Za-z0-9]{6}$/.test(key)) return interaction.reply(resultCard(`${getEmoji('error')} Please enter a valid **6-character** Premium key using letters and numbers.`, 0xED4245));

  const result = redeemPremiumKey(key, interaction.user.id);
  if (!result.ok) {
    const messages = {
      invalid: `${getEmoji('error')} That Premium key is invalid. Please check the **6 characters** and try again.`,
      used: `${getEmoji('warning')} That Premium key has already been redeemed and cannot be used again.`,
      expired: `${getEmoji('warning')} That Premium key has expired and can no longer be redeemed.`,
    };
    return interaction.reply(resultCard(messages[result.reason] ?? messages.invalid, 0xED4245));
  }

  const entry = addPremium(interaction.user.id, result.entry.durationMs, { extend: true });
  await guildLog(interaction.guild, { category:'Premium', title:'Premium Activated', description:`${interaction.user} activated Premium with a redeem key.`, fields:[{name:'User',value:`${interaction.user} (${interaction.user.id})`},{name:'Plan',value:premiumDurationText(entry)}], color:'premium' });
  return interaction.reply(resultCard(
    `${getEmoji('premium')} **Premium Activated!**\n\n` +
    `${getEmoji('success')} **Status:** Active\n` +
    `${getEmoji('key')} **Key:** \`${key}\`\n` +
    `${getEmoji('star')} **Plan:** ${premiumDurationText(entry)}\n\n` +
    `${getEmoji('sparkle')} Enjoy your ${BOT_NAME} Premium features ♡`,
  ));
}

const premiumPanelCommand = {
  data: new SlashCommandBuilder().setName('premium-panel').setDescription('Send the Mrs Orbie Premium activation panel (Owner only)')
    .addChannelOption(o => o.setName('channel').setDescription('Channel where the panel should be sent').setRequired(false)),
  prefix: 'premium-panel',
  async execute(i) {
    if (!isOwner(i.user.id)) return i.reply(resultCard(`${getEmoji('error')} This command is **bot-owner only**.`, 0xED4245));
    const channel = i.options.getChannel('channel') ?? i.channel;
    if (!channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
      return i.reply(resultCard(`${getEmoji('error')} Please choose a text or announcement channel.`, 0xED4245));
    }
    await channel.send(panelCard());
    return i.reply(resultCard(`${getEmoji('success')} Premium activation panel sent to ${channel}.`));
  },
  async prefixExecute(message, args) {
    if (!isOwner(message.author.id)) return message.reply(resultCard(`${getEmoji('error')} This command is **bot-owner only**.`, 0xED4245));
    let channel = message.channel;
    const raw = args[0];
    if (raw) {
      const id = raw.match(/^<#(\d+)>$/)?.[1] ?? (/^\d{17,20}$/.test(raw) ? raw : null);
      if (id) channel = await message.client.channels.fetch(id).catch(() => null);
    }
    if (!channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) return message.reply(resultCard(`${getEmoji('error')} Invalid text channel.`, 0xED4245));
    await channel.send(panelCard());
    return message.reply(resultCard(`${getEmoji('success')} Premium activation panel sent to ${channel}.`));
  },
};

export function keyDeliveryCard(entry, durationLabel, intro) {
  const token = createKeyRevealToken(entry.key, entry.userId);
  const c = new ContainerBuilder().setAccentColor(0xF472B6);
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `${getEmoji('premium')} **Your ${BOT_NAME} Premium Key**\n\n${intro}\n\n` +
    `${getEmoji('key')} **Premium Key**\n` +
    `${getEmoji('dot')} Your key is hidden until you press the button below.\n` +
    `${getEmoji('star')} **Duration:** ${durationLabel}\n\n` +
    `${getEmoji('book_')} **Redeem Instructions**\n` +
    `Open the ${BOT_NAME} Premium panel, click **Activate Premium**, and enter your 6-character key.\n\n` +
    `${getEmoji('warning')} This key can be redeemed by **any Discord user**, but **only once**. Once redeemed, it cannot be used again.\n\n` +
    `${getEmoji('book_')} **Key Deadline:** <t:${Math.floor(Date.parse(entry.keyExpiresAt) / 1000)}:F>\n` +
    `-# The key itself expires on this deadline. Lifetime Premium keys have a 30-day redemption window; after activation, Lifetime Premium does not expire.`
  ));
  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  c.addActionRowComponents(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`premium_reveal:${token}`)
      .setLabel('Show / Copy Key')
      .setEmoji(getButtonEmoji('key'))
      .setStyle(ButtonStyle.Secondary)
  ));
  return withFooter(c, 0);
}

const generateKeyCommand = {
  data: new SlashCommandBuilder().setName('generatekey').setDescription('Generate a Premium redeem key (Owner only)')
    .addUserOption(o => o.setName('user').setDescription('User who will receive the key by DM').setRequired(true))
    .addStringOption(o => o.setName('duration').setDescription('10m, 2h, 7d, 1w, 1mo; leave empty for lifetime').setRequired(false)),
  prefix: 'generatekey',
  async execute(i) {
    if (!isOwner(i.user.id)) return i.reply(resultCard(`${getEmoji('error')} This command is **bot-owner only**.`, 0xED4245));
    const user = i.options.getUser('user');
    const raw = i.options.getString('duration');
    const durationMs = raw ? durationToMs(raw) : null;
    if (raw && !durationMs) return i.reply(resultCard(`${getEmoji('error')} Invalid duration. Use \`10m\`, \`2h\`, \`7d\`, \`1w\`, or \`1mo\`.`, 0xED4245));
    const entry = generatePremiumKey({ userId: user.id, durationMs, source: 'owner' });
    const dm = keyDeliveryCard(entry, durationMs ? raw : 'Lifetime', 'A Premium key has been generated. It can be redeemed by any Discord user once.');
    const sent = await user.send(dm).then(() => true).catch(() => false);
    await guildLog(i.guild, { category:'Premium', title:'Premium Key Generated', description:`${i.user} generated a Premium key for ${user}.`, fields:[{name:'Owner',value:`${i.user} (${i.user.id})`},{name:'User',value:`${user} (${user.id})`},{name:'Duration',value:durationMs ? raw : 'Lifetime'}], color:'premium' });
    return i.reply(resultCard(`${getEmoji('success')} Key generated for ${user}. ${sent ? 'I sent the key to their DMs.' : 'Their DMs are closed, so send them the key securely.'}`));
  },
  async prefixExecute(message, args) {
    if (!isOwner(message.author.id)) return message.reply(resultCard(`${getEmoji('error')} This command is **bot-owner only**.`, 0xED4245));
    const rawUser = args.shift();
    const id = rawUser?.match(/^<@!?(\d+)>$/)?.[1] ?? (/^\d{17,20}$/.test(rawUser ?? '') ? rawUser : null);
    if (!id) return message.reply(resultCard(`${getEmoji('error')} Usage: \`${PREFIX}generatekey @user [duration]\``, 0xED4245));
    const raw = args.shift();
    const durationMs = raw ? durationToMs(raw) : null;
    if (raw && !durationMs) return message.reply(resultCard(`${getEmoji('error')} Invalid duration.`, 0xED4245));
    const user = await message.client.users.fetch(id).catch(() => null);
    if (!user) return message.reply(resultCard(`${getEmoji('error')} User not found.`, 0xED4245));
    const entry = generatePremiumKey({ userId: id, durationMs, source: 'owner' });
    const dm = keyDeliveryCard(entry, durationMs ? raw : 'Lifetime', 'A Premium key has been generated. It can be redeemed by any Discord user once.');
    const sent = await user.send(dm).then(() => true).catch(() => false);
    await guildLog(message.guild, { category:'Premium', title:'Premium Key Generated', description:`${message.author} generated a Premium key for ${user}.`, fields:[{name:'Owner',value:`${message.author} (${message.author.id})`},{name:'User',value:`${user} (${id})`},{name:'Duration',value:durationMs ? raw : 'Lifetime'}], color:'premium' });
    return message.reply(resultCard(`${getEmoji('success')} Key generated for ${user}. ${sent ? 'DM sent.' : 'DM failed — deliver the key securely.'}`));
  },
};

export { premiumPanelCommand, generateKeyCommand };
