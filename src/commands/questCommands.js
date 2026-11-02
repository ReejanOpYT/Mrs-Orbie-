import {
    SlashCommandBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
      ThumbnailBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ComponentType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
    Colors,
} from 'discord.js';
import { QuestClient } from '../quest/questClient.js';
import { TokenStore } from '../quest/tokenStore.js';
import { enableAutoquest, disableAutoquest, isAutoquestEnabled } from '../quest/autoquestStore.js';
import { PREFIX, BOT_NAME } from '../utils/config.js';
import { logQuestWebhook } from '../utils/webhookLogger.js';
import { withFooter } from '../utils/cv2Footer.js';
import { getEmoji, getButtonEmoji } from '../handlers/emoji.js';
import { isPremium } from '../utils/premiumStore.js';
import { getQuestAllUses, consumeQuestAllUse, addQuestAllUse } from '../utils/rewardStore.js';
import { guildLog } from '../utils/guildLogger.js';

// ── TokenStore (shared instance via BOT_TOKEN as secret) ───────────────────
export function makeTokenStore(secret) {
    return new TokenStore(secret);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function sanitizeToken(raw) {
    return raw.trim()
        .replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '')
        .replace(/^`+|`+$/g, '')
        .replace(/^Bot\s+/i, '')
        .trim();
}

function isValidUserToken(token) {
    return token.length >= 50 && /^[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+$/.test(token);
}

// ── UI Builders (Component V2) ─────────────────────────────────────────────

function buildLinkModal(account = 'main') {
    const slot = account === 'alt' ? 'alt' : 'main';
    const modal = new ModalBuilder()
        .setCustomId(`link_token_modal_${slot}`)
        .setTitle(`${slot === 'alt' ? 'Link Alt' : 'Link Main'} Account`);
    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('link_token_input')
                .setLabel('Your Discord user token')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Paste your token here...')
                .setRequired(true),
        ),
    );
    return modal;
}

function buildLinkPrompt(user, account = 'main') {
    const slot = account === 'alt' ? 'alt' : 'main';
    const c = new ContainerBuilder().setAccentColor(0xFEE75C);
    c.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# ${getEmoji('link')} Link Your ${slot === 'alt' ? 'Alt' : 'Main'} Account\n*Connect your Discord account to unlock Mrs Orbie quest features.*`,
                ),
            );
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `${getEmoji('book_')} **Choose your setup guide:**\n` +
            `Select **Link Token**, **Token For PC**, or **Token For Mobile** below.\n\n` +
            `${getEmoji('warning')} **Security:** Never post account credentials in a server channel or share them with anyone.`,
        ),
    );
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    c.addActionRowComponents(
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`link_prompt_${slot}`)
                .setLabel(slot === 'alt' ? 'Link Alt' : 'Link Main')
                .setEmoji(getButtonEmoji('link'))
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('link_guide_pc')
                .setLabel('Token For PC')
                .setEmoji(getButtonEmoji('book_'))
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('link_guide_mobile')
                .setLabel('Token For Mobile')
                .setEmoji(getButtonEmoji('book_'))
                .setStyle(ButtonStyle.Secondary),
        ),
    );
    return withFooter(c);
}

function buildNoQuestsCard() {
    const c = new ContainerBuilder().setAccentColor(0x4F545C);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# ${getEmoji('quest')} No Quests Available\nThere are no active, uncompleted quests on your account right now.`,
        ),
    );
    return withFooter(c);
}

function buildExpiredTokenCard() {
    const c = new ContainerBuilder().setAccentColor(0xED4245);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# ${getEmoji('error')} Token Expired\nYour saved token was rejected by Discord — it has likely expired.\n\n**Your token has been removed.** Re-link with \`/link\` or \`${PREFIX}link\`.`,
        ),
    );
    return withFooter(c);
}

function buildErrorCard(err) {
    const msg = err?.message ?? String(err);
    const is401 = msg.includes('401');
    const c = new ContainerBuilder().setAccentColor(0xED4245);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            is401
                ? `# ${getEmoji('error')} Invalid or Expired Token\nRe-link your token with \`${PREFIX}link\`.`
                : `# ${getEmoji('error')} Error\n${msg.slice(0, 800)}`,
        ),
    );
    return withFooter(c);
}

function buildQuestSelectCard(quests) {
    const ICONS = {
        PLAY_ON_DESKTOP: '🖥️', WATCH_VIDEO: '🎬', STREAM_ON_DESKTOP: '📺',
        PLAY_ACTIVITY: `${getEmoji('quest')}`, WATCH_VIDEO_ON_MOBILE: '📱',
    };

    const lines = quests.map((q, i) => {
        const tasks = (q.config.task_config ?? q.config.task_config_v2)?.tasks ?? {};
        const taskKey = Object.keys(tasks)[0] ?? '';
        const icon = ICONS[taskKey] ?? getEmoji('gear');
        const exp = Math.floor(new Date(q.config.expires_at).getTime() / 1000);
        return `**${i + 1}.** ${icon} **${q.config.messages.quest_name}**\n> *${q.config.messages.game_title}*  •  Expires <t:${exp}:R>`;
    }).join('\n\n');

    const c = new ContainerBuilder().setAccentColor(0x5865F2);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# ${getEmoji('quest')} ${quests.length} Quest${quests.length !== 1 ? 's' : ''} Available\n${lines}\n\n*Use the dropdown below to pick one.*`,
        ),
    );
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`quest_select_${Date.now()}`)
        .setPlaceholder('Pick a quest...')
        .addOptions(
            quests.map((q) => {
                const tasks = (q.config.task_config ?? q.config.task_config_v2)?.tasks ?? {};
                const taskKey = Object.keys(tasks)[0] ?? '';
                return {
                    label: q.config.messages.quest_name.slice(0, 100),
                    description: q.config.messages.game_title.slice(0, 100),
                    value: q.id,
                    emoji: ICONS[taskKey] ?? getEmoji('gear'),
                };
            }),
        );

    c.addActionRowComponents(new ActionRowBuilder().addComponents(menu));
    return withFooter(c);
}

function buildQuestInfoCard(quest, phase, claimed = 0, failReason = '', livePercent = null, liveNote = '', completionAt = null) {
    const cfg  = quest.config;
    const msgs = cfg.messages;
    const appId = cfg.application.id;

    const TASK_META = {
        PLAY_ON_DESKTOP:       { icon: '🖥️', label: 'Play on Desktop' },
        WATCH_VIDEO:           { icon: '🎬', label: 'Watch Video' },
        STREAM_ON_DESKTOP:     { icon: '📺', label: 'Stream on Desktop' },
        PLAY_ACTIVITY:         { icon: `${getEmoji('quest')}`, label: 'Play Activity' },
        WATCH_VIDEO_ON_MOBILE: { icon: '📱', label: 'Watch Video on Mobile' },
    };

    const taskLines = Object.entries((cfg.task_config ?? cfg.task_config_v2)?.tasks ?? {}).map(([type, task]) => {
        const meta = TASK_META[type] ?? { icon: '⚙️', label: type };
        let dur = '';
        if (type === 'PLAY_ON_DESKTOP' || type === 'STREAM_ON_DESKTOP') {
            dur = `  •  **${Math.ceil(task.target / 60)} min**`;
        } else if (type === 'WATCH_VIDEO' || type === 'WATCH_VIDEO_ON_MOBILE') {
            const s = task.target;
            dur = s >= 60 ? `  •  **${Math.ceil(s / 60)} min**` : `  •  **${s}s**`;
        }
        return `${meta.icon} ${meta.label}${dur}${phase === 'done' ? `  ${getEmoji('success')}` : ''}`;
    });

    const rewardLines = cfg.rewards_config.rewards.map((r) => {
        let line = `**${r.messages.name}**`;
        if (r.orb_quantity) line += `  ✦ *(${r.orb_quantity} Orbs)*`;
        else if (r.quantity) line += `  *(${r.quantity}d Nitro)*`;
        return line;
    });

    const expiresEpoch = Math.floor(new Date(cfg.expires_at).getTime() / 1000);
    const daysLeft = Math.max(0, Math.ceil((new Date(cfg.expires_at).getTime() - Date.now()) / 86400000));

    const PHASE = {
        starting: { color: 0x5865F2, title: `${getEmoji('gear')}  Solving Quest...`,  bar: '`░░░░░░░░░░`  **0%**  —  *Working on it...*' },
        done:     { color: 0x57F287, title: `${getEmoji('success')}  Quest Complete!`,    bar: '`██████████`  **100%**' },
        failed:   { color: 0xED4245, title: `${getEmoji('error')}  Quest Failed`,       bar: '' },
    };

    const p = PHASE[phase];
    const live = livePercent === null ? null : Math.max(0, Math.min(100, Math.round(livePercent)));
    const liveFilled = live === null ? 0 : Math.round(live / 10);
    const liveBar = live === null ? '' : `\`${'█'.repeat(liveFilled)}${'░'.repeat(10 - liveFilled)}\`  **${live}%**${liveNote ? `  —  *${liveNote}*` : ''}`;
    const liveIndicator = phase === 'starting' ? `\n\n${getEmoji('status')} **LIVE** • Updated <t:${Math.floor(Date.now()/1000)}:T>` : '';
    const completedLine = phase === 'done' ? `\n**Completed At:** ${completionAt ? `<t:${Math.floor(new Date(completionAt).getTime()/1000)}:F>` : `<t:${Math.floor(Date.now()/1000)}:F>`}` : ''; 
    const progressText = phase === 'failed' && failReason
        ? `\`░░░░░░░░░░\`  **0%**\n\`\`\`\n${failReason.slice(0, 300)}\n\`\`\``
        : liveBar || p.bar;

    const footerNote = phase === 'done' && claimed > 0
        ? `-# ${getEmoji('star')} ${claimed} reward(s) claimed`
        : phase === 'starting'
        ? `-# Quest Bot  •  Please wait...`
        : phase === 'failed'
        ? `-# Requires manual completion in the Discord app`
        : '';

    const c = new ContainerBuilder().setAccentColor(p.color);

    c.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# ${p.title}\n### ${msgs.quest_name}\n*${msgs.game_title}*  •  ${msgs.game_publisher}`,
                ),
            );

    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `📋 **Task**\n${taskLines.join('\n') || '*Unknown task*'}\n\n` +
            `📅 **Expires**  <t:${expiresEpoch}:R>  *(${daysLeft}d left)*\n\n` +
            `📊 **Progress**\n${progressText || '`░░░░░░░░░░`  0%'}\n\n` +
            `${getEmoji('star')} **Reward**\n${rewardLines.join('\n') || '*No rewards listed*'}`,
        ),
    );

    if (footerNote) {
        c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(footerNote));
    }

    return withFooter(c);
}

// ── Quest Runners ──────────────────────────────────────────────────────────

async function sendQuestDM(client, userId, quest, phase, logs = [], claimed = 0, percent = 0, completionAt = null) {
    try {
        const user = await client.users.fetch(userId);
        const dm = await user.createDM();
        const cfg = quest.config;
        const status = phase === 'done' ? `${getEmoji('success')} Complete` : phase === 'failed' ? `${getEmoji('error')} Failed` : `${getEmoji('warning')} In Progress`;
        const safePercent = Math.max(0, Math.min(100, Math.round(percent || 0)));
        const filled = Math.round(safePercent / 10);
        const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
        const recent = logs.slice(-10).map((x) => `> ${String(x).slice(0, 180)}`).join('\n') || '> No logs yet.';
        const completedLine = phase === 'done' ? `\n**Completed At:** ${completionAt ? `<t:${Math.floor(new Date(completionAt).getTime()/1000)}:F>` : `<t:${Math.floor(Date.now()/1000)}:F>`}` : '';
        const liveIndicator = phase === 'starting' ? `\n\n${getEmoji('status')} **LIVE** • Updated <t:${Math.floor(Date.now()/1000)}:T>` : '';
        const c = new ContainerBuilder().setAccentColor(phase === 'done' ? 0x57F287 : phase === 'failed' ? 0xED4245 : 0x5865F2);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `# ${getEmoji('quest')} Quest Update\n## ${cfg.messages.quest_name}\n*${cfg.messages.game_title}*\n\n**Status:** ${status}\n**Progress:** \`${bar}\` **${safePercent}%**\n**Expires:** <t:${Math.floor(new Date(cfg.expires_at).getTime() / 1000)}:R>\n**Rewards claimed:** ${claimed}${completedLine}${liveIndicator}\n\n**Recent Logs**\n${recent}\n\n-# ${BOT_NAME} • Quest Assistant • Made By ReejanOpYT`
        ));
        await dm.send(withFooter(c));
    } catch {}
}

async function runQuestOne(userId, tokenStore, send, discordClient, account = 'main', guild = null) {
    const token = tokenStore.get(userId, account);
    if (!token) { await send(buildLinkPrompt(await discordClient.users.fetch(userId).catch(() => null), account)); return false; }

    const qc = new QuestClient(token);
    try {
        const manager = await qc.fetchQuests();
        const valid = manager.filterQuestsValid();
        if (valid.length === 0) { await send(buildNoQuestsCard()); return false; }

        const selMsg = await send(buildQuestSelectCard(valid));

        let selectedId;
        try {
            const interaction = await selMsg.awaitMessageComponent({
                filter: (i) => i.user.id === userId,
                time: 60_000,
                componentType: ComponentType.StringSelect,
            });
            await interaction.deferUpdate();
            selectedId = interaction.values[0];
        } catch {
            const c = new ContainerBuilder().setAccentColor(0xED4245);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${getEmoji('warning')} Timed Out\nNo quest was selected within 60 seconds. Run \`${PREFIX}quest\` again.`));
            await selMsg.edit(withFooter(c));
            return false;
        }

        await selMsg.edit({ components: [], flags: MessageFlags.IsComponentsV2 });

        const quest = valid.find((q) => q.id === selectedId);
        const progressMsg = await send(buildQuestInfoCard(quest, 'starting'));

        const logs = [];
        const log = (m) => { console.log(m); logs.push(m); };
        const questDone = await manager.doingQuest(quest, log, ({ percent, note }) => {
            progressMsg.edit(buildQuestInfoCard(quest, 'starting', 0, '', percent, note)).catch(() => {});
        });

        if (!questDone) {
            const failReason = logs.filter(l => l.startsWith('[FAIL]')).slice(-2).join('\n') || logs.slice(-3).join('\n') || 'Could not be completed automatically.';
            await progressMsg.edit(buildQuestInfoCard(quest, 'failed', 0, failReason));
            await sendQuestDM(discordClient, userId, quest, 'failed', logs, 0, 0);
            await logQuestWebhook({ user: await discordClient.users.fetch(userId).catch(() => null), guild: null, questName: quest.config.messages.quest_name, gameTitle: quest.config.messages.game_title, status: 'Failed', progress: 0, logs, rewardCount: 0 });
            return false;
        }

        const claimed = await manager.claimRewards(log).catch(() => 0);
        const completionAt = quest.completedAt || new Date().toISOString();
        await progressMsg.edit(buildQuestInfoCard(quest, 'done', claimed, '', 100, 'Complete', completionAt));
        await sendQuestDM(discordClient, userId, quest, 'done', logs, claimed, 100, completionAt);
        await logQuestWebhook({ user: await discordClient.users.fetch(userId).catch(() => null), guild: guild ?? null, questName: quest.config.messages.quest_name, gameTitle: quest.config.messages.game_title, status: 'Complete', progress: 100, logs, rewardCount: claimed, completedAt: completionAt });
        await guildLog(guild, { category:'Quest', title:'Quest Completed', description:`${BOT_NAME} completed a quest for <@${userId}>.`, fields:[{name:'User',value:`<@${userId}> (${userId})`},{name:'Quest',value:quest.config.messages.quest_name},{name:'Completed At',value:new Date(completionAt).toISOString()}], color:'success' });
        return true;

    } catch (err) {
        const msg = err?.message ?? String(err);
        if (msg.includes('401') && tokenStore.has(userId)) {
            tokenStore.remove(userId, account); disableAutoquest(userId);
            await send(buildExpiredTokenCard()).catch(() => {});
        } else {
            await send(buildErrorCard(err)).catch(() => {});
        }
        return false;
    }
}

async function runQuestAll(userId, tokenStore, send, discordClient, account = 'main', guild = null) {
    const token = tokenStore.get(userId, account);
    if (!token) { await send(buildLinkPrompt(await discordClient.users.fetch(userId).catch(() => null), account)); return false; }

    const qc = new QuestClient(token);
    try {
        const manager = await qc.fetchQuests();
        const valid = manager.filterQuestsValid();
        if (valid.length === 0) { await send(buildNoQuestsCard()); return false; }

        const progressMsgs = await Promise.all(valid.map((q) => send(buildQuestInfoCard(q, 'starting'))));

        const questLogs = valid.map(() => []);
        const questResults = await Promise.allSettled(
            valid.map((quest, i) => {
                const log = (m) => { console.log(m); questLogs[i].push(m); };
                return manager.doingQuest(quest, log);
            }),
        );

        const completed = valid.filter((_, i) => questResults[i].status === 'fulfilled' && questResults[i].value === true);
        const skipped   = valid.filter((_, i) => questResults[i].status === 'rejected' || (questResults[i].status === 'fulfilled' && questResults[i].value === false));

        await Promise.allSettled(skipped.map((q) => {
            const idx = valid.indexOf(q);
            const failLogs = questLogs[idx].filter(l => l.startsWith('[FAIL]'));
            const reason = questResults[idx].status === 'rejected'
                ? questResults[idx].reason?.message ?? 'Unknown error'
                : failLogs.slice(-2).join('\n') || questLogs[idx].slice(-3).join('\n') || 'Could not be completed automatically.';
            return progressMsgs[idx].edit(buildQuestInfoCard(q, 'failed', 0, reason));
        }));

        if (completed.length === 0) {
            const c = new ContainerBuilder().setAccentColor(0xFEE75C);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${getEmoji('warning')} No Quests Auto-Completed\nAll quests require manual completion via the Discord desktop or app.`));
            await send(withFooter(c));
            return false;
        }

        const claimed = await manager.claimRewards(console.log).catch(() => 0);
        const claimedPer = completed.length > 0 ? Math.floor(claimed / completed.length) : 0;

        await Promise.allSettled(completed.map(async (q, i) => {
            const idx = valid.indexOf(q);
            const completionAt = q.completedAt || new Date().toISOString();
            await progressMsgs[idx].edit(buildQuestInfoCard(q, 'done', i === 0 ? claimed : claimedPer, '', 100, 'Complete', completionAt)).catch(() => {});
            await logQuestWebhook({
                user: await discordClient.users.fetch(userId).catch(() => null),
                guild: null,
                questName: q.config.messages.quest_name,
                gameTitle: q.config.messages.game_title,
                status: 'Complete',
                progress: 100,
                logs: questLogs[idx],
                rewardCount: i === 0 ? claimed : claimedPer,
                completedAt: completionAt,
            });
            await guildLog(guild, { category:'Quest', title:'Quest Completed', description:`${BOT_NAME} completed a quest for <@${userId}>.`, fields:[{name:'User',value:`<@${userId}> (${userId})`},{name:'Quest',value:q.config.messages.quest_name},{name:'Completed At',value:new Date(completionAt).toISOString()}], color:'success' });
        }));
        return true;

    } catch (err) {
        const msg = err?.message ?? String(err);
        if (msg.includes('401') && tokenStore.has(userId)) {
            tokenStore.remove(userId, account); disableAutoquest(userId);
            await send(buildExpiredTokenCard()).catch(() => {});
        } else {
            await send(buildErrorCard(err)).catch(() => {});
        }
        return false;
    }
}

async function runQuestList(userId, tokenStore, send, discordClient, account = 'main') {
    const token = tokenStore.get(userId, account);
    if (!token) {
        await send(buildLinkPrompt(await discordClient.users.fetch(userId).catch(() => null), account));
        return false;
    }

    const qc = new QuestClient(token);
    try {
        const manager = await qc.fetchQuests();
        const all = manager.list();
        if (all.length === 0) {
            await send(buildNoQuestsCard());
            return false;
        }

        const TASK_META = {
            PLAY_ON_DESKTOP:       { icon: '🖥️', label: 'Play on Desktop' },
            WATCH_VIDEO:           { icon: '🎬', label: 'Watch Video' },
            STREAM_ON_DESKTOP:     { icon: '📺', label: 'Stream on Desktop' },
            PLAY_ACTIVITY:         { icon: `${getEmoji('quest')}`, label: 'Play Activity' },
            WATCH_VIDEO_ON_MOBILE: { icon: '📱', label: 'Watch Video on Mobile' },
        };

        const lines = all.map((q, i) => {
            const cfg = q.config;
            const tasks = (cfg.task_config ?? cfg.task_config_v2)?.tasks ?? {};
            const taskKey = Object.keys(tasks)[0] ?? '';
            const meta = TASK_META[taskKey] ?? { icon: '⚙️', label: taskKey || 'Unknown task' };
            const expires = Math.floor(new Date(cfg.expires_at).getTime() / 1000);
            const status = q.isCompleted()
                ? `${getEmoji('success')} Completed`
                : q.isExpired()
                    ? `${getEmoji('error')} Expired`
                    : q.isEnrolledQuest()
                        ? '🟡 In progress'
                        : '⚪ Not started';
            return `**${i + 1}.** ${meta.icon} **${cfg.messages.quest_name}**\n> *${cfg.messages.game_title}*  •  ${meta.label}\n> ${status}  •  Expires <t:${expires}:R>`;
        }).join('\n\n');

        const c = new ContainerBuilder().setAccentColor(0x5865F2);
        c.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `# ${getEmoji('quest')} Your Quests\n${lines}`,
            ),
        );
        return Boolean(await send(withFooter(c)));
    } catch (err) {
        const msg = err?.message ?? String(err);
        if (msg.includes('401') && tokenStore.has(userId)) {
            tokenStore.remove(userId, account);
            disableAutoquest(userId);
            await send(buildExpiredTokenCard()).catch(() => {});
        } else {
            await send(buildErrorCard(err)).catch(() => {});
        }
        return false;
    }
}

async function runAutoquestForUser(userId, quest, tokenStore, discordClient, account = 'main') {
    const token = tokenStore.get(userId, account);
    if (!token || !quest) return false;

    const qc = new QuestClient(token);
    const logs = [];
    const log = (message) => {
        console.log(message);
        logs.push(message);
    };

    try {
        const manager = await qc.fetchQuests();
        const currentQuest = manager.get(quest.id) ?? quest;
        const user = await discordClient.users.fetch(userId).catch(() => null);
        if (!user) return false;

        const dm = await user.createDM();
        const progressMessage = await dm.send(buildQuestInfoCard(currentQuest, 'starting'));
        const completed = await manager.doingQuest(currentQuest, log, ({ percent, note }) => {
            progressMessage.edit(buildQuestInfoCard(currentQuest, 'starting', 0, '', percent, note)).catch(() => {});
        });

        if (!completed) {
            const reason = logs.filter((x) => String(x).startsWith('[FAIL]')).slice(-2).join('\n')
                || logs.slice(-3).join('\n')
                || 'Could not be completed automatically.';
            await progressMessage.edit(buildQuestInfoCard(currentQuest, 'failed', 0, reason)).catch(() => {});
            await sendQuestDM(discordClient, userId, currentQuest, 'failed', logs, 0, 0);
            await logQuestWebhook({
                user,
                guild: null,
                questName: currentQuest.config.messages.quest_name,
                gameTitle: currentQuest.config.messages.game_title,
                status: 'Failed',
                progress: 0,
                logs,
                rewardCount: 0,
            });
            return false;
        }

        const claimed = await manager.claimRewards(log).catch(() => 0);
        const completionAt = currentQuest.completedAt || new Date().toISOString();
        await progressMessage.edit(buildQuestInfoCard(currentQuest, 'done', claimed, '', 100, 'Complete', completionAt)).catch(() => {});
        await sendQuestDM(discordClient, userId, currentQuest, 'done', logs, claimed, 100, completionAt);
        await logQuestWebhook({
            user,
            guild: null,
            questName: currentQuest.config.messages.quest_name,
            gameTitle: currentQuest.config.messages.game_title,
            status: 'Complete',
            progress: 100,
            logs,
            rewardCount: claimed,
            completedAt: completionAt,
        });
        return true;
    } catch (err) {
        const msg = err?.message ?? String(err);
        if (msg.includes('401') && tokenStore.has(userId)) {
            tokenStore.remove(userId, account);
            disableAutoquest(userId);
        }
        return false;
    }
}

function buildAutoquestCard(enabled, count = 0) {
    const c = new ContainerBuilder().setAccentColor(enabled ? 0x57F287 : 0xED4245);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            enabled
                ? `# ${getEmoji('success')} Autoquest Enabled\nNew quests will be checked automatically in the background.\n\n**Status:** Active\n**Tracked users:** ${count}`
                : `# ${getEmoji('error')} Autoquest Disabled\nAutomatic quest checking has been turned off for your account.`,
        ),
    );
    return withFooter(c);
}

function buildAutoquestStatusCard(enabled, count = 0) {
    const c = new ContainerBuilder().setAccentColor(enabled ? 0x57F287 : 0x5865F2);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# ${getEmoji('gear')} Autoquest Status\n**Status:** ${enabled ? '🟢 Enabled' : '🔴 Disabled'}\n**Tracked users:** ${count}`,
        ),
    );
    return withFooter(c);
}

function buildPremiumRequiredCard(feature) {
    const c = new ContainerBuilder().setAccentColor(0xE879F9);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `# ${getEmoji('heart')} Mrs Orbie Premium
**${feature}** is a Premium feature.

${getEmoji('star')} Premium unlocks **Main + Alt accounts**, **${PREFIX}questall**, and **${PREFIX}autoquest**.
${getEmoji('sparkle')} Ask the bot owner to enable Premium for your account.`,
    ));
    return withFooter(c, MessageFlags.Ephemeral);
}

function buildAccountsCard(accounts, premium) {
    const main = accounts.includes('main') ? `${getEmoji('success')} Linked` : `${getEmoji('error')} Not linked`;
    const alt = accounts.includes('alt') ? `${getEmoji('success')} Linked` : `${getEmoji('error')} Not linked`;
    const c = new ContainerBuilder().setAccentColor(0xE879F9);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `# ${getEmoji('heart')} Mrs Orbie Accounts\n\n${getEmoji('user')} **Main:** ${main}\n${getEmoji('sparkle')} **Alt:** ${premium ? alt : '🔒 Premium required'}\n\n${premium ? '*Premium allows one main + one alt account.*' : '*Upgrade to Premium to link an alt account.*'}`,
    ));
    return withFooter(c);
}

function buildLinkSuccessCard(user, account = 'main') {
    const slot = account === 'alt' ? 'alt' : 'main';
    const c = new ContainerBuilder().setAccentColor(0x57F287);
    c.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# ${getEmoji('success')} Account Linked\nYour **${slot === 'alt' ? 'Alt' : 'Main'}** account is linked successfully. You can now use Mrs Orbie's quest commands.`,
                ),
            );
    return withFooter(c, MessageFlags.Ephemeral);
}

export async function handleLinkPromptButton(interaction, account = 'main') {
    await interaction.showModal(buildLinkModal(account));
}

export async function handleLinkModal(interaction, client, account = 'main') {
    const slot = account === 'alt' ? 'alt' : 'main';
    if (slot === 'alt' && !isPremium(interaction.user.id)) {
        return interaction.reply({ ...buildPremiumRequiredCard('Alt account linking'), flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
    }
    const raw = interaction.fields.getTextInputValue('link_token_input');
    const token = sanitizeToken(raw);

    if (!isValidUserToken(token)) {
        return interaction.reply({
            ...buildErrorCard(new Error('The supplied credential format is invalid.')),
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
    }

    const store = client.tokenStore;
    const qc = new QuestClient(token);

    try {
        await qc.fetchUserRaw();
        store.save(interaction.user.id, token, slot);
        await interaction.reply(buildLinkSuccessCard(interaction.user, slot));
    } catch (err) {
        await interaction.reply({
            ...buildErrorCard(err),
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        }).catch(() => {});
    }
}

function buildLinkGuideCard(device, user) {
    const isPC = device === 'pc';
    const accent = isPC ? 0x5865F2 : 0x57F287;
    const icon = getEmoji('setup');
    const title = isPC ? 'PC Setup Guide' : 'Mobile Setup Guide';
    const platform = isPC ? 'Discord Desktop / Browser' : 'Discord Mobile App';
    const videoUrl = isPC
        ? 'https://youtube.com/watch?v=KbBqdpLhMVI&si=ZxytEQVfA8Qm337E'
        : 'https://youtube.com/watch?v=OIKeF6dwOhQ&si=KfnGBYnZOu3yLyQG';
    const reference = 'https://discord.com/channels/1518139990100410398/1518150634501836811/1541427626256760945';
    const steps = [
        `${getEmoji('green_dot')} **Watch the complete ${isPC ? 'PC' : 'Mobile'} Guide video:**\n[Watch ${isPC ? 'PC' : 'Mobile'} Guide](${videoUrl})`,
        `${getEmoji('green_dot')} **Follow the steps shown in the video carefully.**`,
        `${getEmoji('green_dot')} **After completing the guide, return to Mrs Orbie.**`,
        `${getEmoji('green_dot')} **Use the Link Token option only through the supported Mrs Orbie linking flow.**`,
        `${getEmoji('green_dot')} **Reference:**\n${reference}`,
    ];

    const c = new ContainerBuilder().setAccentColor(accent);
    c.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# ${icon} ${title}\n*Private guide • ${platform}*\n\nFollow the official guide carefully and keep your account credentials private.`,
                ),
            );

    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## ${getEmoji('activity')} Guide Steps\n${steps.join('\n\n')}`,
        ),
    );

    c.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
    );

    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## ${getEmoji('info')} Security First\n${getEmoji('warning')} **Never share your Discord password, account token, or authentication credentials with anyone.**\n${getEmoji('info')} Mrs Orbie will never ask you to post sensitive credentials in a public server channel.\n\n-# ${getEmoji('book_')} Mrs Orbie — Guide`,
        ),
    );

    return withFooter(c, MessageFlags.Ephemeral);
}

export async function handleLinkGuideButton(interaction, device) {
    const c = buildLinkGuideCard(device, interaction.user);
    await interaction.reply(c);
}

const linkCommand = {
    data: new SlashCommandBuilder()
        .setName('link')
        .setDescription('Link your Main or Alt Discord account')
        .addStringOption(o => o.setName('account').setDescription('Account slot').setRequired(false).addChoices(
            { name: 'Main', value: 'main' },
            { name: 'Alt (Premium)', value: 'alt' },
        )),
    prefix: 'link',
    async execute(interaction) {
        const account = interaction.options.getString('account') ?? 'main';
        if (account === 'alt' && !isPremium(interaction.user.id)) return interaction.reply({ ...buildPremiumRequiredCard('Alt account linking'), flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        await interaction.reply({ ...buildLinkPrompt(interaction.user, account), flags: MessageFlags.IsComponentsV2 });
    },
    async prefixExecute(message, args) {
        const account = String(args[0] ?? 'main').toLowerCase() === 'alt' ? 'alt' : 'main';
        if (account === 'alt' && !isPremium(message.author.id)) return message.reply(buildPremiumRequiredCard('Alt account linking'));
        await message.reply(buildLinkPrompt(message.author, account));
    },
};

const accountsCommand = {
    data: new SlashCommandBuilder().setName('accounts').setDescription('View your linked Mrs Orbie accounts'),
    prefix: 'accounts',
    async execute(interaction, client) { return interaction.reply(buildAccountsCard(client.tokenStore.listAccounts(interaction.user.id), isPremium(interaction.user.id))); },
    async prefixExecute(message, _args, client) { return message.reply(buildAccountsCard(client.tokenStore.listAccounts(message.author.id), isPremium(message.author.id))); },
};

const questCommand = {
    data: new SlashCommandBuilder()
        .setName('quest')
        .setDescription('Pick and complete one available quest')
        .addStringOption(o => o.setName('account').setDescription('Account slot').setRequired(false).addChoices({ name: 'Main', value: 'main' }, { name: 'Alt (Premium)', value: 'alt' })),
    prefix: 'quest',

    async execute(interaction, client) {
        const account = interaction.options.getString('account') ?? 'main';
        if (account === 'alt' && !isPremium(interaction.user.id)) return interaction.reply({ ...buildPremiumRequiredCard('Alt account quests'), flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        await runQuestOne(interaction.user.id, client.tokenStore, (payload) => interaction.reply(payload), client, account, interaction.guild);
    },

    async prefixExecute(message, _args, client) {
        const account = String(_args[0] ?? 'main').toLowerCase() === 'alt' ? 'alt' : 'main';
        if (account === 'alt' && !isPremium(message.author.id)) return message.reply(buildPremiumRequiredCard('Alt account quests'));
        await runQuestOne(message.author.id, client.tokenStore, (payload) => message.reply(payload), client, account, message.guild);
    },
};

const questAllCommand = {
    data: new SlashCommandBuilder()
        .setName('questall')
        .setDescription('Attempt all quests (Premium only)')
        .addStringOption(o => o.setName('account').setDescription('Account slot').setRequired(false).addChoices({ name: 'Main', value: 'main' }, { name: 'Alt (Premium)', value: 'alt' })),
    prefix: 'questall',

    async execute(interaction, client) {
        const userId = interaction.user.id;
        const premium = isPremium(userId);
        const account = interaction.options.getString('account') ?? 'main';
        if (account === 'alt' && !premium) return interaction.reply({ ...buildPremiumRequiredCard('Alt Quest All'), flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const rewardUse = !premium;
        if (rewardUse && getQuestAllUses(userId) < 1) return interaction.reply({ ...buildPremiumRequiredCard('Quest All'), flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        if (!client.tokenStore.has(userId, account)) return runQuestAll(userId, client.tokenStore, (payload) => interaction.reply(payload), client, account, interaction.guild);
        if (rewardUse) consumeQuestAllUse(userId);
        const ok = await runQuestAll(userId, client.tokenStore, (payload) => interaction.reply(payload), client, account, interaction.guild);
        if (!ok && rewardUse) addQuestAllUse(userId, 1);
    },

    async prefixExecute(message, _args, client) {
        const userId = message.author.id;
        const premium = isPremium(userId);
        const account = String(_args[0] ?? 'main').toLowerCase() === 'alt' ? 'alt' : 'main';
        if (account === 'alt' && !premium) return message.reply(buildPremiumRequiredCard('Alt Quest All'));
        const rewardUse = !premium;
        if (rewardUse && getQuestAllUses(userId) < 1) return message.reply(buildPremiumRequiredCard('Quest All'));
        if (!client.tokenStore.has(userId, account)) return runQuestAll(userId, client.tokenStore, (payload) => message.reply(payload), client, account, message.guild);
        if (rewardUse) consumeQuestAllUse(userId);
        const ok = await runQuestAll(userId, client.tokenStore, (payload) => message.reply(payload), client, account, message.guild);
        if (!ok && rewardUse) addQuestAllUse(userId, 1);
    },
};

const questListCommand = {
    data: new SlashCommandBuilder()
        .setName('questlist')
        .setDescription('View your current quests and their status')
        .addStringOption(o => o.setName('account').setDescription('Account slot').setRequired(false).addChoices({ name: 'Main', value: 'main' }, { name: 'Alt (Premium)', value: 'alt' })),
    prefix: 'questlist',

    async execute(interaction, client) {
        const account = interaction.options.getString('account') ?? 'main';
        if (account === 'alt' && !isPremium(interaction.user.id)) return interaction.reply({ ...buildPremiumRequiredCard('Alt account quests'), flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        await runQuestList(interaction.user.id, client.tokenStore, (payload) => interaction.reply(payload), client, account);
    },

    async prefixExecute(message, _args, client) {
        const account = String(_args[0] ?? 'main').toLowerCase() === 'alt' ? 'alt' : 'main';
        if (account === 'alt' && !isPremium(message.author.id)) return message.reply(buildPremiumRequiredCard('Alt account quests'));
        await runQuestList(message.author.id, client.tokenStore, (payload) => message.reply(payload), client, account);
    },
};

const autoquestCommand = {
    data: new SlashCommandBuilder()
        .setName('autoquest')
        .setDescription('Manage automatic quest checking')
        .addStringOption((option) => option
            .setName('action')
            .setDescription('Choose an autoquest action')
            .setRequired(false)
            .addChoices(
                { name: 'Enable', value: 'enable' },
                { name: 'Disable', value: 'disable' },
                { name: 'Status', value: 'status' },
            )),
    prefix: 'autoquest',

    async execute(interaction, client) {
        const action = interaction.options.getString('action') ?? 'enable';
        const userId = interaction.user.id;
        if (action === 'status') {
            return interaction.reply(buildAutoquestStatusCard(isAutoquestEnabled(userId), client.tokenStore.size));
        }
        if (!client.tokenStore.has(userId)) {
            return interaction.reply({ ...buildLinkPrompt(interaction.user), flags: MessageFlags.IsComponentsV2 });
        }
        if (action === 'disable') {
            disableAutoquest(userId);
            return interaction.reply(buildAutoquestCard(false));
        }
        if (!isPremium(userId)) return interaction.reply({ ...buildPremiumRequiredCard('Autoquest'), flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        enableAutoquest(userId);
        return interaction.reply(buildAutoquestCard(true, client.tokenStore.size));
    },

    async prefixExecute(message, args, client) {
        const action = String(args[0] ?? 'enable').toLowerCase();
        const userId = message.author.id;
        if (action === 'status') return message.reply(buildAutoquestStatusCard(isAutoquestEnabled(userId), client.tokenStore.size));
        if (action === 'disable' || action === 'off') {
            disableAutoquest(userId);
            return message.reply(buildAutoquestCard(false));
        }
        if (!isPremium(userId)) return message.reply(buildPremiumRequiredCard('Autoquest'));
        if (!client.tokenStore.has(userId)) return message.reply(buildLinkPrompt(message.author));
        enableAutoquest(userId);
        return message.reply(buildAutoquestCard(true, client.tokenStore.size));
    },
};

export {
    linkCommand,
    accountsCommand,
    questCommand,
    questAllCommand,
    questListCommand,
    autoquestCommand,
    runAutoquestForUser,
};

