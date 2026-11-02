import {
  SlashCommandBuilder,
  ChannelType,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
} from 'discord.js';
import { getEmoji } from '../handlers/emoji.js';
import { PREFIX } from '../utils/config.js';
import { setCommandChannel, clearCommandChannel } from '../utils/channelStore.js';
import { isServerAdmin } from '../utils/channelGuard.js';
import { withFooter } from '../utils/cv2Footer.js';

function successCard(channel) {
  const c = new ContainerBuilder().setAccentColor(0x57F287);
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `# ${getEmoji('success')} Bot Channel Set\n` +
    `All bot commands are now available only in ${channel}.\n\n` +
    `${getEmoji('arrow')} Use the bot from this channel with both **${PREFIX}commands** and **slash commands**.`,
  ));
  return withFooter(c, 0);
}

function clearedCard() {
  const c = new ContainerBuilder().setAccentColor(0x57F287);
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `# ${getEmoji('success')} Bot Channel Cleared\n` +
    `The channel restriction has been removed.\n\n` +
    `${getEmoji('arrow')} A server owner or Administrator can run \`${PREFIX}setchannel\` again to choose a channel.`,
  ));
  return withFooter(c, 0);
}

function permissionCard() {
  const c = new ContainerBuilder().setAccentColor(0xED4245);
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `# ${getEmoji('error')} Permission Denied\n` +
    `Only the **server owner** or a member with **Administrator** permission can use this command.`,
  ));
  return withFooter(c, 0);
}

function usageCard() {
  const c = new ContainerBuilder().setAccentColor(0xFEE75C);
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `# ${getEmoji('warning')} Set Bot Channel\n` +
    `${getEmoji('arrow')} Run \`${PREFIX}setchannel\` in the channel you want to use.\n` +
    `${getEmoji('arrow')} Or use \`${PREFIX}setchannel #channel\` to choose a text channel.\n` +
    `${getEmoji('arrow')} Use \`${PREFIX}setchannel off\` to remove the restriction.\n\n` +
    `Only the server owner or an Administrator can change this.`,
  ));
  return withFooter(c, 0);
}

function resolvePrefixChannel(message, args) {
  const raw = args[0]?.trim();
  if (!raw) return message.channel;
  if (raw.toLowerCase() === 'off') return 'off';
  const id = raw.replace(/[<#>]/g, '');
  return message.guild.channels.cache.get(id) ?? null;
}

export default {
  data: new SlashCommandBuilder()
    .setName('setchannel')
    .setDescription('Set the only channel where the bot can be used')
    .addChannelOption(option => option
      .setName('channel')
      .setDescription('Text channel to use; leave empty to use the current channel')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setRequired(false)),
  prefix: 'setchannel',

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ ...usageCard(), flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
    if (!isServerAdmin(interaction.member, interaction.user.id)) {
      return interaction.reply({ ...permissionCard(), flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
    }
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;
    if (!channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
      return interaction.reply({ ...usageCard(), flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
    }
    setCommandChannel(interaction.guild.id, channel.id);
    await interaction.reply(successCard(channel));
  },

  async prefixExecute(message, args) {
    if (!message.guild) return message.reply(usageCard());
    if (!isServerAdmin(message.member, message.author.id)) return message.reply(permissionCard());
    const channel = resolvePrefixChannel(message, args);
    if (channel === 'off') {
      clearCommandChannel(message.guild.id);
      return message.reply(clearedCard());
    }
    if (!channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
      return message.reply(usageCard());
    }
    setCommandChannel(message.guild.id, channel.id);
    await message.reply(successCard(channel));
  },
};
