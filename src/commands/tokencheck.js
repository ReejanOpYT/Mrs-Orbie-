import { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder } from 'discord.js';
import { PREFIX, BOT_NAME } from '../utils/config.js';
import { withFooter } from '../utils/cv2Footer.js';
import { getEmoji } from '../handlers/emoji.js';

function buildCard(user, accounts) {
  const hasMain = accounts.includes('main');
  const hasAlt = accounts.includes('alt');
  const total = accounts.length;
  const main = hasMain ? `${getEmoji('success')} **Connected**` : `${getEmoji('error')} **Not Connected**`;
  const alt = hasAlt ? `${getEmoji('success')} **Connected**` : `${getEmoji('error')} **Not Connected**`;

  const c = new ContainerBuilder().setAccentColor(0xF3A6D8);
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `# ${getEmoji('key')} Token Check\n` +
    `### ${user} • ${BOT_NAME} Account Status\n\n` +
    `${getEmoji('dot')} **Main Account**\n${main}\n\n` +
    `${getEmoji('dot')} **Alt Account**\n${alt}\n\n` +
    `${getEmoji('dot')} **Connected Accounts:** **${total}/2**\n\n` +
    `${total === 0
      ? `${getEmoji('warning')} No account is connected yet. Use \`${PREFIX}link\` to connect your Main account.`
      : total === 1
        ? `${getEmoji('premium')} One account is connected. Premium users can link **1 Main + 1 Alt**.`
        : `${getEmoji('premium')} Main + Alt are both connected.`}`
  ));
  return withFooter(c);
}

export const tokenCheckCommand = {
  data: new SlashCommandBuilder()
    .setName('tokencheck')
    .setDescription('Check which of your account slots are connected'),
  prefix: 'tokencheck',
  async execute(interaction) {
    const accounts = interaction.client.tokenStore.listAccounts(interaction.user.id);
    return interaction.reply(buildCard(interaction.user, accounts));
  },
  async prefixExecute(message) {
    const accounts = message.client.tokenStore.listAccounts(message.author.id);
    return message.reply(buildCard(message.author, accounts));
  },
};
