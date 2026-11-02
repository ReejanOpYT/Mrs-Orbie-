import { ContainerBuilder, TextDisplayBuilder } from 'discord.js';
import { PREFIX, BOT_NAME } from '../utils/config.js';
import { getEmoji, syncAppEmojis } from '../handlers/emoji.js';
import { withFooter } from '../utils/cv2Footer.js';

const OWNER_ID = process.env.BOT_OWNER_ID || '1293127492982407195';

function card(text, color = 0xE879F9) {
  const c = new ContainerBuilder().setAccentColor(color);
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  return withFooter(c);
}

export default {
  // Intentionally prefix-only: the requested command is $emojis.
  prefix: 'emojis',

  async prefixExecute(message, _args, client) {
    if (message.author.id !== OWNER_ID) {
      return message.reply(card(`${getEmoji('error')} **Owner Only**\nOnly the bot owner can use \`${PREFIX}emojis\`.` , 0xED4245));
    }

    const status = await message.reply(card(`${getEmoji('gear')} **Emoji Sync Started**\nChecking \`assets/emojis\` against the bot's application emojis…`));

    try {
      const result = await syncAppEmojis(client);

      const lines = [
        `${getEmoji('success')} **Emoji Sync Complete**`,
        `${getEmoji('book_')} Local emoji files: **${result.total}**`,
        `${getEmoji('check')} Already synced: **${result.existing}**`,
        `${getEmoji('upload')} Uploaded now: **${result.uploaded}**`,
        `${getEmoji('warning')} Skipped (too large): **${result.skipped}**`,
        `${getEmoji('error')} Failed: **${result.failed}**`,
        `${getEmoji('dot')} Bot aliases matched: **${result.aliasesOk}/${result.aliasesOk + result.aliasesMissing.length}**`,
        `-# Existing emojis were left unchanged. Only missing emojis were uploaded.`
      ];
      if (result.aliasesMissing.length) result.details.push(...result.aliasesMissing.map(x => `alias without emoji: ${x}`));

      if (result.details.length) {
        const shown = result.details.slice(0, 8);
        lines.push(`\n${getEmoji('warning')} **Notes**\n${shown.map(x => `-# ${x}`).join('\n')}`);
        if (result.details.length > shown.length) {
          lines.push(`-# …and ${result.details.length - shown.length} more.`);
        }
      }

      await status.edit({ components: [card(lines.join('\n')).components[0]] }).catch(async () => {
        await message.reply(card(lines.join('\n')));
      });
    } catch (error) {
      console.error('[emoji-sync]', error);
      await status.edit({
        components: [card(`${getEmoji('error')} **Emoji Sync Failed**\n\`${error?.message || 'Unknown error'}\``, 0xED4245).components[0]]
      }).catch(() => {});
    }
  }
};
