# Components V2 + Emoji UI Patch

This patch updates the UI to Components V2 and applies the requested custom emojis.

## Requested emojis
- Success / Complete / Verify: `<a:tick_pd:1538098190992150578>`
- Warning: `<a:warring1:1540890865784852562>`
- Incomplete / Error: `<a:Cross_:1538486340004487248>`
- Link / Token: `<a:link69:1540902009341743244>`
- Quests: `<:Quests:1540902466579730563>`
- Utility: `<:utility3:1540902741646381156>`
- Command arrow: `<a:Arrow_White:1538205028719005756>`

## Help menu
Every command is shown with the requested white arrow, grouped under Token/Link, Quests, and Utility.

## Token-handling preservation
The existing `src/commands/questCommands.js` token-store, token validation, token verification, save/remove, modal, and quest execution logic was retained. The changes in that file are UI emoji substitutions only.

## Footer GIF on Every Components V2 Response

Every command response, command error card, quest progress card, quest DM update, token-check/link result, and auto-quest DM now includes the same `assets/mrs-orbie-footer.gif` through the shared `src/utils/cv2Footer.js` helper.

The footer is attached as `mrs-orbie-footer.gif` and displayed with a Components V2 Media Gallery. This is presentation-only and does not alter the existing command prefix or token-handling logic.

## Set Command Channel

Server owners and members with **Administrator** permission can use `setchannel` by prefix or slash command.

- `setchannel` — set the current channel
- `setchannel #channel` — set a specific text channel
- `setchannel off` — remove the restriction
- `/setchannel` — set the current channel
- `/setchannel channel:#channel` — set a specific text channel

Once configured, normal bot commands and component interactions are accepted only in the selected channel. The `setchannel` command itself remains available outside the selected channel so an owner/admin can change the setting.
