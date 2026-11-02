import 'dotenv/config';
import { Client, GatewayIntentBits, Collection, Partials } from 'discord.js';
import { readdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { makeTokenStore } from './commands/questCommands.js';
import { BOT_NAME } from './utils/config.js';
import { startDashboard } from './dashboard.js';
import { writeFileSync, existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const col = {
    reset:  '\x1b[0m', bright: '\x1b[1m', cyan: '\x1b[96m',
    blue:   '\x1b[34m', white: '\x1b[97m', purple: '\x1b[35m',
    green:  '\x1b[92m', dim:   '\x1b[90m',
};

function banner() {
    const lines = [
        '',
        `${col.cyan}${col.bright}   ██████╗  ██████╗██╗   ██╗ ██╗${col.reset}`,
        `${col.cyan}${col.bright}  ██╔═══██╗██╔════╝██║   ██║███║${col.reset}`,
        `${col.blue}${col.bright}  ██║   ██║██║     ██║   ██║╚██║${col.reset}`,
        `${col.blue}${col.bright}  ██║▄▄ ██║██║     ╚██╗ ██╔╝ ██║${col.reset}`,
        `${col.white}${col.bright}  ╚██████╔╝╚██████╗ ╚████╔╝  ██║${col.reset}`,
        `${col.white}${col.bright}   ╚══▀▀═╝  ╚═════╝  ╚═══╝   ╚═╝${col.reset}`,
        '',
        `${col.dim}  ─────────────────────────────────────────────────${col.reset}`,
        `  ${col.green}●${col.reset} ${col.white}${BOT_NAME} • Quest Assistant${col.reset}  ${col.dim}|${col.reset}   ${col.white}${col.reset}`,
        `${col.dim}  ─────────────────────────────────────────────────${col.reset}`,
        '',
    ];
    for (const line of lines) process.stdout.write(line + '\n');
}

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) { console.error('DISCORD_TOKEN is not set.'); process.exit(1); }

// Ensure data files exist
mkdirSync('data', { recursive: true });
if (!existsSync('tokens.json'))    writeFileSync('tokens.json', '{}');
if (!existsSync('autoquest.json')) writeFileSync('autoquest.json', '[]');
if (!existsSync('data/commandChannels.json')) writeFileSync('data/commandChannels.json', '{}');
if (!existsSync('data/blacklist.json')) writeFileSync('data/blacklist.json', '{}');
if (!existsSync('data/blacklistHistory.json')) writeFileSync('data/blacklistHistory.json', '[]');
if (!existsSync('data/premium.json')) writeFileSync('data/premium.json', '{}');
if (!existsSync('data/orbiePoints.json')) writeFileSync('data/orbiePoints.json', '{}');
if (!existsSync('data/questAllUses.json')) writeFileSync('data/questAllUses.json', '{}');
if (!existsSync('data/purchases.json')) writeFileSync('data/purchases.json', '[]');
if (!existsSync('data/inviteCache.json')) writeFileSync('data/inviteCache.json', '{}');
if (!existsSync('data/premiumKeys.json')) writeFileSync('data/premiumKeys.json', '{}');
if (!existsSync('data/logChannels.json')) writeFileSync('data/logChannels.json', '{}');

banner();
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Message, Partials.Channel],
});

client.commands       = new Collection();
client.prefixCommands = new Collection();
client.tokenStore     = makeTokenStore(TOKEN);

const commandFiles = readdirSync(join(__dirname, 'commands')).filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
    const mod = await import(pathToFileURL(join(__dirname, 'commands', file)).href);
    // Single default export
    if (mod.default) {
        const cmd = mod.default;
        if (cmd?.data)   client.commands.set(cmd.data.name, cmd);
        if (cmd?.prefix) client.prefixCommands.set(cmd.prefix, cmd);
    }
    // Named exports (questCommands.js has multiple)
    for (const [key, cmd] of Object.entries(mod)) {
        if (key === 'default' || key === 'makeTokenStore' || key === 'handleLinkModal' || key === 'handleLinkPromptButton' || key === 'runAutoquestForUser') continue;
        if (cmd?.data)   client.commands.set(cmd.data.name, cmd);
        if (cmd?.prefix) client.prefixCommands.set(cmd.prefix, cmd);
    }
}

const eventFiles = readdirSync(join(__dirname, 'events')).filter(f => f.endsWith('.js'));
for (const file of eventFiles) {
    const mod   = await import(pathToFileURL(join(__dirname, 'events', file)).href);
    const event = mod.default;
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

client.login(TOKEN);
startDashboard(client);
