import { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } from 'discord.js';
import { getEmoji } from '../handlers/emoji.js';
import { PREFIX, BOT_NAME } from '../utils/config.js';
import { withFooter } from '../utils/cv2Footer.js';

export default {
  data: new SlashCommandBuilder().setName('help').setDescription('See all available commands'),
  prefix: 'help',
  async execute(interaction) { await interaction.reply(buildHelp(interaction.user, interaction.client)); },
  async prefixExecute(message, _args, client) { await message.reply(buildHelp(message.author, client)); },
};

function commandLine(name, description, emoji = 'command') {
  return `${getEmoji(emoji)} \`/${name}\`  \`${PREFIX}${name}\` — ${description}`;
}

function buildHelp(user, client) {
  const c = new ContainerBuilder().setAccentColor(0xE879F9);
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `# ${getEmoji('heart')} ${BOT_NAME}\n-# Your cute Quest Assistant ✦\n-# Hey **${user.username}** ♡ here's your command menu`,
    ));

  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `${getEmoji('link')} **Account & Quests**\n` +
    `${commandLine('link', 'Open account-linking options', 'link')}\n` +
    `${commandLine('quest', 'Pick a quest', 'quest')}\n` +
    `${commandLine('questall', 'Attempt all quests • Premium', 'quests')}\n` +
    `${commandLine('questlist', 'View quest status', 'quests')}\n` +
    `${commandLine('autoquest', 'Automatic quest checking • Premium', 'gear')}\n` +
    `${commandLine('accounts', 'View your Main + Alt account slots', 'user')}`,
  ));

  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `${getEmoji('shop')} **Orbie Point Shop**\n` +
    `${commandLine('orbiepoints', 'View your Orbie Point balance', 'dot')}\n` +
    `-# ${getEmoji('dot')} Shortcut: \`${PREFIX}points\`\n` +
    `${commandLine('shop', 'Open the Orbie Point reward shop', 'shop')}\n` +
    `${commandLine('buy', 'Redeem points for rewards', 'premium')}\n` +
    `-# ${getEmoji('dot')} Earn **1 Orbie Point** for every successful invite.`,
  ));

  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `${getEmoji('star')} **Orbie Life**\n` +
    `${commandLine('myinvites', 'View your tracked invite performance', 'link')}\n` +
    `${commandLine('serverinfo', 'View a detailed server overview', 'server')}`
  ));

  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `${getEmoji('utility')} **Information**\n` +
    `${commandLine('ping', 'Check bot latency', 'ping')}\n` +
    `${commandLine('botinfo', 'Show bot information', 'bot')}\n` +
    `${commandLine('status', 'Show live bot status', 'status')}`
  ));

  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `${getEmoji('setup')} **Server Setup**\n${commandLine('setchannel', 'Set the command channel', 'setup')}`,
  ));

  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `${getEmoji('heart')} **Premium & Owner**\n` +
    `-# ${getEmoji('star')} \`${PREFIX}premium\` — view Premium status\n` +
    `-# ${getEmoji('star')} Owner: \`${PREFIX}addpremium @user [duration]\`\n` +
    `-# ${getEmoji('star')} Owner: \`${PREFIX}removepremium @user\`\n` +
    `-# ${getEmoji('key')} Owner: \`${PREFIX}generatekey @user [duration]\` — generate a 6-character alphanumeric key\n` +
    `-# ${getEmoji('premium')} Owner: \`${PREFIX}premium-panel [#channel]\` — send activation panel\n` +
    `-# ${getEmoji('dot')} Owner: \`${PREFIX}addpoints @user <amount>\` — add Orbie Points\n` +
    `-# ${getEmoji('dot')} Owner: \`${PREFIX}removepoints @user <amount>\` — remove Orbie Points\n` +
    `-# ${getEmoji('dot')} Owner: \`${PREFIX}setpoints @user <amount>\` — set Orbie Points\n` +
    `\n${getEmoji('warning')} **Owner Only**\n` +
    `-# ${getEmoji('warning')} \`${PREFIX}blacklist @user [duration] [reason]\`\n` +
    `-# ${getEmoji('success')} \`${PREFIX}unblacklist @user\``,
  ));

  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `-# ${getEmoji('success')} Serving **${client.guilds.cache.size}** server(s) · Prefix: \`${PREFIX}\``,
    ));
  return withFooter(c);
}
