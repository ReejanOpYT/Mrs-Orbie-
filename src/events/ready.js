// : ! Mr Orbie Development !
import { ActivityType } from 'discord.js';
import { PREFIX, BOT_NAME } from '../utils/config.js';
import { startAutoquestWatcher } from '../utils/autoquestWatcher.js';
import { initApplicationEmojis, syncAppEmojis } from '../handlers/emoji.js';
import { cacheAllGuildInvites } from '../utils/inviteTracker.js';
import deployCommands from '../utils/deployCommands.js';

const col = { reset:'\x1b[0m', bright:'\x1b[1m', green:'\x1b[92m', white:'\x1b[97m', gray:'\x1b[90m', purple:'\x1b[35m' };
const line = `${col.purple}${col.bright}  ─────────────────────────────────────${col.reset}`;
export default { name:'clientReady', once:true, async execute(client){
  initApplicationEmojis(client);
  client.user.setPresence({activities:[{name:`${BOT_NAME} • Quest Assistant | ${PREFIX}help`,type:ActivityType.Watching}],status:'online'});
  console.log(line); console.log(`  ${col.green}${col.bright}✓ ${col.white}Logged in as ${col.green}${client.user.tag}${col.reset}`);
  console.log(`  ${col.green}${col.bright}✓ ${col.white}Serving ${col.green}${client.guilds.cache.size}${col.white} guild(s)${col.reset}`); console.log(line);

  // Auto-sync assets/emojis -> bot application emojis (uploads only what's missing, safe on every start)
  if (String(process.env.EMOJI_AUTO_SYNC ?? 'true').toLowerCase() !== 'false') {
    try {
      console.log(`  ${col.gray}▸ Syncing emojis…${col.reset}`);
      const er = await syncAppEmojis(client);
      console.log(`  ${col.green}${col.bright}✓ ${col.white}Emojis — local ${er.total} | uploaded ${col.green}${er.uploaded}${col.white} | already synced ${er.existing} | failed ${er.failed + er.skipped}${col.reset}`);
      if (er.aliasesMissing.length) console.log(`  ${col.gray}  · ${er.aliasesMissing.length} alias(es) have no matching emoji, using unicode fallback${col.reset}`);
      for (const d of er.details.slice(0, 5)) console.log(`  ${col.gray}  · ${d}${col.reset}`);
    } catch (e) {
      console.error('  emoji sync error:', e?.message || e);
    }
  }

  await deployCommands(client.token, client.application?.id || client.user.id); startAutoquestWatcher(client); await cacheAllGuildInvites(client);
} };
