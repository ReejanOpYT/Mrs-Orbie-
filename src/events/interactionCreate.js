import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import { getEmoji } from '../handlers/emoji.js';
import { handleLinkModal, handleLinkPromptButton, handleLinkGuideButton } from '../commands/questCommands.js';
import { logWebhook } from '../utils/webhookLogger.js';
import { withFooter } from '../utils/cv2Footer.js';
import { checkCommandChannel, buildChannelOnlyCard, buildChannelNotConfiguredCard, ephemeralCard } from '../utils/channelGuard.js';
import { isBlacklisted } from '../utils/accessStore.js';
import { isOwner } from '../commands/access.js';
import { buildPremiumActivationModal, handlePremiumActivation } from '../commands/premiumActivation.js';
import { resolveKeyRevealToken } from '../utils/premiumKeyStore.js';
import { guildLog } from '../utils/guildLogger.js';

function errorCard() {
    const c = new ContainerBuilder().setAccentColor(0xED4245);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`${getEmoji('error')} Something went wrong.`),
    );
    return withFooter(c, MessageFlags.Ephemeral);
}

function channelGate(interaction) {
    if (!interaction.guild) return { allowed: true };
    const gate = checkCommandChannel(interaction.guild.id, interaction.channelId);
    if (gate.allowed) return gate;
    return gate.configured
        ? { allowed: false, card: ephemeralCard(buildChannelOnlyCard(gate.channelId)) }
        : { allowed: false, card: ephemeralCard(buildChannelNotConfiguredCard()) };
}

export default {
    name: 'interactionCreate',
    once: false,
    async execute(interaction, client) {
        if (isBlacklisted(interaction.user.id) && !isOwner(interaction.user.id)) return;
        // setchannel must remain accessible so an owner/admin can configure the server channel.
        if (interaction.isChatInputCommand() && (interaction.commandName === 'setchannel' || interaction.commandName === 'logs')) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            try {
                await logWebhook({ user: interaction.user, guild: interaction.guild, command: `/${interaction.commandName}`, source: 'Slash', status: 'Used' });
                await guildLog(interaction.guild, { category: 'Command', title: 'Command Used', description: `${interaction.user} used \`/${interaction.commandName}\`.`, fields: [{name:'User',value:`${interaction.user} (${interaction.user.id})`},{name:'Channel',value:`${interaction.channel}` }], color:'info' });
                await command.execute(interaction, client);
            } catch (err) {
                console.error(err);
                await logWebhook({ type: 'Command Error', user: interaction.user, guild: interaction.guild, command: `/${interaction.commandName}`, source: 'Slash', status: 'Error' });
                if (interaction.replied || interaction.deferred) await interaction.followUp(errorCard()).catch(() => {});
                else await interaction.reply(errorCard()).catch(() => {});
            }
            return;
        }

        // Premium activation/reveal components are intentionally usable from the
        // premium panel's channel (or any channel). They are not bot commands and
        // must not be blocked by the server's command-channel restriction.
        const premiumComponent =
            (interaction.isButton() && (interaction.customId === 'premium_activate' || interaction.customId.startsWith('premium_reveal:'))) ||
            (interaction.isModalSubmit() && interaction.customId === 'premium_activation_modal');
        const gate = isOwner(interaction.user.id) || premiumComponent ? { allowed: true } : channelGate(interaction);
        if (!gate.allowed) {
            await logWebhook({ type: 'Command Blocked', user: interaction.user, guild: interaction.guild, command: interaction.isChatInputCommand() ? `/${interaction.commandName}` : 'Component Interaction', source: interaction.isChatInputCommand() ? 'Slash' : 'Component', status: gate.configured ? 'Wrong Channel' : 'Channel Not Set' });
            if (!interaction.replied && !interaction.deferred) await interaction.reply(gate.card).catch(() => {});
            else await interaction.followUp(gate.card).catch(() => {});
            return;
        }

        if (interaction.isButton() && interaction.customId.startsWith('premium_reveal:')) {
            const token = interaction.customId.slice('premium_reveal:'.length);
            const entry = resolveKeyRevealToken(token, interaction.user.id);
            if (!entry) {
                const c = new ContainerBuilder().setAccentColor(0xED4245);
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${getEmoji('error')} This key reveal button is invalid, expired, or belongs to another account.`));
                return interaction.reply(withFooter(c, interaction.guildId ? MessageFlags.Ephemeral : 0));
            }
            const c = new ContainerBuilder().setAccentColor(0xF472B6);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `${getEmoji('key')} **Your Premium Key**\n\n` +
                `\`\`${entry.key}\`\`\n\n` +
                `${getEmoji('dot')} This key is visible only to you in this response.\n` +
                `${getEmoji('warning')} Keep it private — it can only be redeemed once by your account.`
            ));
            const flags = interaction.guildId ? MessageFlags.Ephemeral : 0;
            return interaction.reply(withFooter(c, flags));
        }

        if (interaction.isButton() && interaction.customId === 'premium_activate') {
            return interaction.showModal(buildPremiumActivationModal());
        }

        if (interaction.isModalSubmit() && interaction.customId === 'premium_activation_modal') {
            await handlePremiumActivation(interaction);
            return;
        }

        if (interaction.isModalSubmit() && /^link_token_modal_(main|alt)$/.test(interaction.customId)) {
            const account = interaction.customId.endsWith('_alt') ? 'alt' : 'main';
            await handleLinkModal(interaction, client, account);
            await logWebhook({ type: 'Token Link Used', user: interaction.user, guild: interaction.guild, command: '/link', source: 'Modal', status: 'Used' });
            return;
        }

        if (interaction.isButton() && /^link_prompt_(main|alt)$/.test(interaction.customId)) {
            const account = interaction.customId.endsWith('_alt') ? 'alt' : 'main';
            await handleLinkPromptButton(interaction, account);
            await logWebhook({ type: 'Link Prompt Used', user: interaction.user, guild: interaction.guild, command: '/link', source: 'Button', status: 'Used' });
            return;
        }

        if (interaction.isButton() && (interaction.customId === 'link_guide_pc' || interaction.customId === 'link_guide_mobile')) {
            const device = interaction.customId === 'link_guide_pc' ? 'pc' : 'mobile';
            await handleLinkGuideButton(interaction, device);
            await logWebhook({ type: 'Link Guide Used', user: interaction.user, guild: interaction.guild, command: `/link ${device}`, source: 'Button', status: 'Used' });
            return;
        }

        if (!interaction.isChatInputCommand()) return;
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await logWebhook({ user: interaction.user, guild: interaction.guild, command: `/${interaction.commandName}`, source: 'Slash', status: 'Used' });
            await command.execute(interaction, client);
        } catch (err) {
            console.error(err);
            await logWebhook({ type: 'Command Error', user: interaction.user, guild: interaction.guild, command: `/${interaction.commandName}`, source: 'Slash', status: 'Error' });
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorCard()).catch(() => {});
            } else {
                await interaction.reply(errorCard()).catch(() => {});
            }
        }
    },
};
