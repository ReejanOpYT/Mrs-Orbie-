import { ContainerBuilder, TextDisplayBuilder } from 'discord.js';
import { getEmoji } from '../handlers/emoji.js';
import { PREFIX } from '../utils/config.js';
import { logWebhook } from '../utils/webhookLogger.js';
import { withFooter } from '../utils/cv2Footer.js';
import { checkCommandChannel, buildChannelOnlyCard, buildChannelNotConfiguredCard } from '../utils/channelGuard.js';
import { isBlacklisted } from '../utils/accessStore.js';
import { isOwner } from '../commands/access.js';
import { guildLog } from '../utils/guildLogger.js';

function errorCard() {
  const c = new ContainerBuilder().setAccentColor(0xED4245);
  c.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`${getEmoji('error')} Something went wrong.`),
  );
  return withFooter(c);
}

export default {
  name: 'messageCreate',
  once: false,
  async execute(message, client) {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;
    if (isBlacklisted(message.author.id) && !isOwner(message.author.id)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();
    const command = client.prefixCommands.get(commandName);
    if (!command) return;

    // setchannel is the one command that must remain usable outside the configured channel.
    if (!isOwner(message.author.id) && commandName !== 'setchannel' && commandName !== 'logs' && message.guild) {
      const gate = checkCommandChannel(message.guild.id, message.channel.id);
      if (!gate.allowed) {
        await logWebhook({ type: 'Command Blocked', user: message.author, guild: message.guild, command: `${PREFIX}${commandName}`, source: 'Prefix', status: gate.configured ? 'Wrong Channel' : 'Channel Not Set' });
        await message.reply(gate.configured ? buildChannelOnlyCard(gate.channelId) : buildChannelNotConfiguredCard()).catch(() => {});
        return;
      }
    }

    try {
      await logWebhook({ user: message.author, guild: message.guild, command: `${PREFIX}${commandName}`, source: 'Prefix', status: 'Used' });
      await guildLog(message.guild, { category: 'Command', title: 'Command Used', description: `${message.author} used \`${PREFIX}${commandName}\`.`, fields: [{name:'User',value:`${message.author} (${message.author.id})`},{name:'Channel',value:`${message.channel}`}], color:'info' });
      await command.prefixExecute(message, args, client);
    } catch (err) {
      console.error(err);
      await logWebhook({ type: 'Command Error', user: message.author, guild: message.guild, command: `${PREFIX}${commandName}`, source: 'Prefix', status: 'Error' });
      await message.reply(errorCard()).catch(() => {});
    }
  },
};
