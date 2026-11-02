import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
} from 'discord.js';
import { getEmoji } from '../handlers/emoji.js';
import { PREFIX, BOT_NAME } from '../utils/config.js';
import { withFooter } from '../utils/cv2Footer.js';

const startedAt = Date.now();
const fmt = (ms) => {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${d}d ${h}h ${m}m ${sec}s`;
};
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const icon = (name, fallback = '•') => getEmoji(name) || fallback;

function card(title, body, color = 0xE879F9, thumb) {
  const c = new ContainerBuilder().setAccentColor(color);
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(title));
  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
  return withFooter(c);
}

const botInfo = {
  data: new SlashCommandBuilder().setName('botinfo').setDescription(`Show ${BOT_NAME} bot information`),
  prefix: 'botinfo',
  execute(interaction) { return interaction.reply(buildBotInfo(interaction.client)); },
  prefixExecute(message, _args, client) { return message.reply(buildBotInfo(client)); },
};

function buildBotInfo(client) {
  const users = client.guilds.cache.reduce((n, g) => n + (g.memberCount || 0), 0);
  return card(
    `# ${icon('bot')} ${BOT_NAME} Bot Information`,
    `${icon('info')} **Version:** \`${BOT_NAME} v2\`\n` +
    `${icon('robot')} **Node.js:** \`${process.version}\`\n` +
    `${icon('gear')} **Discord.js:** \`${client.constructor?.name ? '14.x' : 'Unknown'}\`\n` +
    `${icon('server')} **Servers:** \`${client.guilds.cache.size}\`\n` +
    `${icon('user')} **Cached members:** \`${users.toLocaleString()}\`\n` +
    `${icon('utility')} **Commands:** \`${client.commands.size}\`\n` +
    `${icon('success')} **Prefix:** \`${PREFIX}\``,
    0xE879F9,
  );
}

const status = {
  data: new SlashCommandBuilder().setName('status').setDescription(`Show live ${BOT_NAME} bot status`),
  prefix: 'status',
  execute(interaction) { return interaction.reply(buildStatus(interaction.client)); },
  prefixExecute(message, _args, client) { return message.reply(buildStatus(client)); },
};

function buildStatus(client) {
  const ws = client.ws.ping;
  const mem = process.memoryUsage();
  const uptime = process.uptime() * 1000;
  const state = client.ws.status === 0 ? `${icon('success')} Online` : `${icon('warning')} Connecting`;
  const latency = ws < 0 ? 'N/A' : `${ws}ms`;
  return card(
    `# ${icon('status')} ${BOT_NAME} Status`,
    `${icon('success')} **Bot:** ${state}\n` +
    `${icon('ping')} **WebSocket:** \`${latency}\`\n` +
    `${icon('info')} **Uptime:** \`${fmt(uptime)}\`\n` +
    `${icon('gear')} **Memory:** \`${mb(mem.rss)} RSS / ${mb(mem.heapUsed)} Heap\`\n` +
    `${icon('bot')} **Servers:** \`${client.guilds.cache.size}\`\n` +
    `${icon('utility')} **Process started:** <t:${Math.floor((Date.now() - uptime) / 1000)}:R>`,
    client.ws.status === 0 ? 0x57F287 : 0xFEE75C,
  );
}

export { botInfo, status };
