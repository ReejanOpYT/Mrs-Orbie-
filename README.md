<div align="center">

# Mrs Orbie ♡

**A cute Discord quest assistant built with discord.js v14 and Components V2.**

![node](https://img.shields.io/badge/node-%3E%3D20-ff69b4?style=flat-square)
![discord.js](https://img.shields.io/badge/discord.js-v14-ff9ed2?style=flat-square)
![license](https://img.shields.io/badge/license-source--available-a9a9b3?style=flat-square)

</div>

---

## Features

- Quest commands with live progress cards, prefix and slash for every command
- Free tier (1 main account) and Premium (1 main + 1 alt)
- Orbie Point shop, earned from tracked server invites
- Premium keys, with an owner panel and a redeem button
- Server logs, command-channel lock, blacklist system
- Owner web dashboard
- **Automatic emoji sync** — drop an image in `assets/emojis/` and the bot uploads it and uses it

## Quick start

```bash
git clone https://github.com/ReejanOpYT/Mrs-Orbie-
npm install
cp .env.example .env     # then fill it in
npm start
```

Requires **Node.js 20+**. In the [Developer Portal](https://discord.com/developers/applications), enable the **Server Members** and **Message Content** intents and invite the bot with the `bot` and `applications.commands` scopes.

Minimum `.env`:

```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_application_id
BOT_OWNER_ID=your_discord_user_id
BOT_PREFIX=$
```

Everything else (theme colors, branding, dashboard, points prices, premium key rules) is documented in [`.env.example`](.env.example). Slash commands are registered globally on startup. Runtime data files are created automatically in `data/`.

## Emojis

Emojis are fully automatic. On every start the bot:

1. Reads every image in `assets/emojis/` (`png`, `jpg`, `gif`, `webp`).
2. Uploads the ones that are **missing** to the bot's **Application Emojis**. The emoji name is the file name (`tick_pd.gif` → `:tick_pd:`).
3. Uses those uploaded emojis everywhere. The code asks for a name like `success` or `error`, and the alias table in [`src/handlers/emoji.js`](src/handlers/emoji.js) (`EMOJI_ALIASES`) maps it to the uploaded emoji (`success` → `tick_pd`). No emoji IDs are hardcoded, so it works on any bot token out of the box.

Existing emojis are never replaced or deleted, so restarts are cheap. If an emoji is missing, a unicode fallback is shown instead.

| Want to… | Do this |
| --- | --- |
| Add a new emoji | Put the file in `assets/emojis/` and restart (or run `$emojis`) |
| Use it in code | `getEmoji('file_name')`, or `getButtonEmoji('file_name')` for buttons |
| Change what `success`, `error`, … show | Edit `EMOJI_ALIASES` |
| Re-sync without restarting | `$emojis` (owner only) |
| Turn auto-sync off | `EMOJI_AUTO_SYNC=false` |

Discord limits: emoji files must be **256 KB or less**, names **2–32 characters** (`A–Z a–z 0–9 _`). Animated emojis must be real GIFs (not animated WebP renamed to `.gif`). Bots can hold up to 2000 application emojis.

## Commands

Every command works as slash (`/help`) and prefix (`$help`).

| Category | Commands |
| --- | --- |
| Account & quests | `link` `accounts` `tokencheck` `quest` `questall` *(Premium)* `questlist` `autoquest` *(Premium)* |
| Points & shop | `orbiepoints` `points` `shop` `buy` `myinvites` |
| Premium | `premium` `premium-panel` *(Owner)* `generatekey` *(Owner)* `addpremium` *(Owner)* `removepremium` *(Owner)* |
| Utility | `help` `ping` `botinfo` `status` `serverinfo` `setchannel` `logs` |
| Owner | `addpoints` `removepoints` `setpoints` `blacklist` `unblacklist` `emojis` *(prefix only)* |

## Premium & points

- Every successfully tracked invite gives the inviter **1 Orbie Point**.
- Shop: **5 pts** → 1 Quest All · **15 pts** → 3 days Autoquest · **20 pts** → 7 days Premium · **50 pts** → Lifetime Premium.
- Premium keys are 6 characters, single-use, and redeemed from the Premium panel. See [`docs/README_PREMIUM_KEYS.md`](docs/README_PREMIUM_KEYS.md).
- Invite tracking needs the bot to be able to view server invites.

## Dashboard

A private owner dashboard runs on port `9190` by default. Set `DASHBOARD_PASSWORD` in `.env` first, then open `http://<host>:9190/dashboard`. It covers premium users and keys, guild management, command and log channels, and invite analytics. Put it behind HTTPS or a reverse proxy if it's exposed publicly.

## Project layout

```
src/
  commands/     slash + prefix commands
  events/       discord.js event handlers
  handlers/     emoji.js (sync + resolver)
  quest/        quest client, manager, stores
  utils/        stores, logging, footer, helpers
  dashboard.js  owner web panel
assets/
  emojis/       auto-uploaded to the bot's application emojis
data/           runtime JSON (git-ignored, created on start)
docs/           extra notes
```

## Security notes

- `.env`, `tokens.json`, `autoquest.json` and `data/*` are git-ignored. Never commit them.
- Account credentials are stored encrypted, but keep the host and `DISCORD_TOKEN` secure.
- **Heads up:** automating quests with a *user account* token is against Discord's Terms of Service and can get that account terminated. Self-hosting and use is at your own risk.

## License

Source-available, all rights reserved. See [LICENSE](LICENSE).

Made by **ReejanOpYT** · Mr Orbie Development
