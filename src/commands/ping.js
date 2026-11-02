// : ! Mr Orbie Development !
// + Discord: ReejanOpYT
// + Community: https://discord.gg/jBv4rU75J (Mr Orbie Development)
// + for any queries reach out Community or DM me.

import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from 'discord.js';
import { getEmoji } from '../handlers/emoji.js';
import { withFooter } from '../utils/cv2Footer.js';

function statusLabel(ws) {
  if (ws < 80)  return { text: 'Blazing fast — no complaints here', color: 0x57F287 };
  if (ws < 150) return { text: 'Solid connection, all good', color: 0x57F287 };
  if (ws < 250) return { text: 'A little sluggish, but holding up', color: 0xFEE75C };
  return { text: 'Running hot — might be a hiccup', color: 0xED4245 };
}

function buildPingCard(ws, rest) {
  const { text, color } = statusLabel(ws);
  const c = new ContainerBuilder().setAccentColor(color);

  c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `# ${getEmoji('ping')} Latency Check\n-# ${text}`,
        ),
      );

  c.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
  );

  c.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `${getEmoji('info')} **WebSocket Heartbeat** — \`${ws}ms\`\n${getEmoji('arrow')} **REST Round-trip** — \`${rest}ms\``,
    ),
  );

  c.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
  );

  c.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `-# ${ws < 150 ? getEmoji('success') + ' All systems nominal' : ws < 250 ? getEmoji('warning') + ' Slight delay detected' : getEmoji('error') + ' Elevated latency — keep an eye on it'}`,
    ),
  );

  return withFooter(c);
}

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency'),
  prefix: 'ping',

  async execute(interaction) {
    const ws = interaction.client.ws.ping;
    const t = Date.now();
    await interaction.deferReply();
    const rest = Date.now() - t;
    await interaction.editReply(buildPingCard(ws, rest));
  },

  async prefixExecute(message, _a, client) {
    const ws = client.ws.ping;
    const t = Date.now();
    const sent = await message.reply('...');
    const rest = Date.now() - t;
    await sent.edit({ content: '', ...buildPingCard(ws, rest) });
  },
};

// : ! Mr Orbie Development !
// + Discord: ReejanOpYT
// + Community: https://discord.gg/jBv4rU75J (Mr Orbie Development)
// + for any queries reach out Community or DM me.
