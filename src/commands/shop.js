import { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags, SeparatorBuilder, SeparatorSpacingSize } from 'discord.js';
import { getEmoji } from '../handlers/emoji.js';
import { withFooter } from '../utils/cv2Footer.js';
import { PREFIX, BOT_NAME } from '../utils/config.js';
import { getPoints, removePoints } from '../utils/orbiePointsStore.js';
import { getPremium, premiumDurationText } from '../utils/premiumStore.js';
import { generatePremiumKey } from '../utils/premiumKeyStore.js';
import { enableAutoquestFor } from '../quest/autoquestStore.js';
import { recordPurchase } from '../utils/purchaseStore.js';
import { guildLog } from '../utils/guildLogger.js';
import { keyDeliveryCard } from './premiumActivation.js';

const ITEMS = {
  questall: { cost: 5, title: '1× Quest All', description: 'Single-use Quest All access.' },
  autoquest: { cost: 15, title: '3 Days Autoquest', description: 'Autoquest for 3 days.' },
  premium7d: { cost: 20, title: '7 Days Premium', description: `${BOT_NAME} Premium for 7 days.` },
  premium_lifetime: { cost: 50, title: 'Lifetime Premium', description: `${BOT_NAME} Premium forever.` },
};

function card(text, color = 0xF472B6, ephemeral = false) {
  const c = new ContainerBuilder().setAccentColor(color);
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  return withFooter(c, ephemeral ? MessageFlags.Ephemeral : 0);
}

function shopCard(points, user) {
  const c = new ContainerBuilder().setAccentColor(0xF472B6);
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `# ${getEmoji('shop')} ${BOT_NAME} Shop\n-# Welcome to the cutest way to spend your Orbie Points, **${user?.username ?? 'there'}** ♡`
    ));
  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `${getEmoji('dot')} **Your Balance**\n> **${points} Orbie Points**\n\n` +
    `### ${getEmoji('shop')} Available Rewards\n` +
    `${getEmoji('dot')} **5** points  →  **1× Quest All**\n` +
    `${getEmoji('dot')} **15** points →  **3 Days Autoquest**\n` +
    `${getEmoji('premium')} **20** points →  **7 Days Premium**\n` +
    `${getEmoji('premium')} **50** points →  **Lifetime Premium**\n\n` +
    `### ${getEmoji('info')} How to redeem\n` +
    `Use \`${PREFIX}buy <item>\` or \`/buy\` to claim a reward.\n` +
    `**Items:** \`questall\` · \`autoquest\` · \`premium7d\` · \`premium_lifetime\`\n\n` +
    `${getEmoji('sparkle')} **Earn:** Every successful invite gives you **+1 Orbie Point**.\n` +
    `${getEmoji('warning')} **Final sale:** purchases are permanent and cannot be refunded, exchanged, transferred, or undone.`
  ));
  return withFooter(c, 0);
}

const shopCommand = {
  data: new SlashCommandBuilder().setName('shop').setDescription(`View the ${BOT_NAME} Orbie Point Shop`),
  prefix: 'shop',
  async execute(i) { return i.reply(shopCard(getPoints(i.guildId, i.user.id), i.user)); },
  async prefixExecute(message) { return message.reply(shopCard(getPoints(message.guildId, message.author.id), message.author)); },
};

const pointsCommand = {
  data: new SlashCommandBuilder().setName('orbiepoints').setDescription('View your Orbie Points'),
  prefix: 'orbiepoints',
  async execute(i) {
    const points = getPoints(i.guildId, i.user.id);
    return i.reply(card(`${getEmoji('heart')} **Orbie Points**\n\n${getEmoji('dot')} **Balance:** **${points}**\n${getEmoji('sparkle')} Every successful invite earns **+1 Orbie Point**.`));
  },
  async prefixExecute(message) {
    const points = getPoints(message.guildId, message.author.id);
    return message.reply(card(`${getEmoji('heart')} **Orbie Points**\n\n${getEmoji('dot')} **Balance:** **${points}**\n${getEmoji('sparkle')} Every successful invite earns **+1 Orbie Point**.`));
  },
};

const pointsShortcutCommand = {
  prefix: 'points',
  async prefixExecute(message) {
    const points = getPoints(message.guildId, message.author.id);
    return message.reply(card(`${getEmoji('heart')} **Orbie Points**\n\n${getEmoji('dot')} **Balance:** **${points}**\n${getEmoji('sparkle')} Every successful invite earns **+1 Orbie Point**.`));
  },
};

function itemChoice(raw) {
  const value = String(raw ?? '').toLowerCase().replace(/[- ]/g, '_');
  if (value === 'questall' || value === 'quest') return 'questall';
  if (value === 'autoquest' || value === 'auto') return 'autoquest';
  if (value === 'premium7d' || value === 'premium_7d' || value === '7d') return 'premium7d';
  if (value === 'premium_lifetime' || value === 'lifetime' || value === '50') return 'premium_lifetime';
  return null;
}

const buyCommand = {
  data: new SlashCommandBuilder().setName('buy').setDescription('Redeem Orbie Points in the shop')
    .addStringOption(o => o.setName('item').setDescription('Choose a shop reward').setRequired(true).addChoices(
      { name: '1× Quest All — 5 points', value: 'questall' },
      { name: '3 Days Autoquest — 15 points', value: 'autoquest' },
      { name: '7 Days Premium — 20 points', value: 'premium7d' },
      { name: 'Lifetime Premium — 50 points', value: 'premium_lifetime' },
    )),
  prefix: 'buy',
  async execute(i) { return redeem(i, i.user.id, i.guildId, itemChoice(i.options.getString('item')), true); },
  async prefixExecute(message, args) { return redeem(message, message.author.id, message.guildId, itemChoice(args[0]), false); },
};

async function redeem(ctx, userId, guildId, item, slash) {
  if (!guildId) return ctx.reply(card(`${getEmoji('error')} The Orbie Point Shop can only be used inside a server.`, 0xED4245, slash));
  if (!item || !ITEMS[item]) return ctx.reply(card(`${getEmoji('error')} Invalid shop item. Use \`${PREFIX}shop\` to see the available rewards.`, 0xED4245, slash));

  const product = ITEMS[item];
  const currentPremium = getPremium(userId);

  // Never charge for a reward that cannot be applied.
  if (item === 'premium_lifetime' && currentPremium?.expiresAt === undefined && currentPremium) {
    return ctx.reply(card(`${getEmoji('warning')} You already have **Lifetime Premium**. This item cannot be purchased again. Your points were not changed.`, 0xF59E0B, slash));
  }
  if (item === 'premium7d' && currentPremium && !currentPremium.expiresAt) {
    return ctx.reply(card(`${getEmoji('warning')} You already have **Lifetime Premium**. 7 Days Premium cannot be purchased. Your points were not changed.`, 0xF59E0B, slash));
  }

  const points = getPoints(guildId, userId);
  if (points < product.cost) {
    return ctx.reply(card(`${getEmoji('warning')} Not enough Orbie Points.\n\n${getEmoji('dot')} **You have:** ${points}\n${getEmoji('dot')} **Required:** ${product.cost}\n${getEmoji('sparkle')} Invite more people to earn points.`, 0xF59E0B, slash));
  }

  // Deduct exactly once. There is deliberately no refund/undo path after this succeeds.
  if (!removePoints(guildId, userId, product.cost)) {
    return ctx.reply(card(`${getEmoji('error')} Your points changed before the purchase could complete. No purchase was made.`, 0xED4245, slash));
  }

  let reward = product.title;
  let redeemKey = null;
  let dmSent = false;
  try {
    if (item === 'questall') {
      const { addQuestAllUse } = await import('../utils/rewardStore.js');
      addQuestAllUse(userId, 1);
      reward = '1 Quest All use';
    } else if (item === 'autoquest') {
      const entry = enableAutoquestFor(userId, 3 * 86400000);
      reward = `3 Days Autoquest (expires ${entry.expiresAt})`;
    } else if (item === 'premium7d') {
      const keyEntry = generatePremiumKey({ userId, durationMs: 7 * 86400000, source: 'shop' });
      redeemKey = keyEntry.key;
      reward = `7 Days Premium • Redeem Key ${keyEntry.key}`;
      const user = await ctx.client.users.fetch(userId).catch(() => null);
      if (user) dmSent = await user.send(keyDeliveryCard(keyEntry, '7 Days', 'Thank you for your Shop purchase! Your Premium is waiting to be activated.')).then(() => true).catch(() => false);
    } else if (item === 'premium_lifetime') {
      const keyEntry = generatePremiumKey({ userId, durationMs: null, source: 'shop' });
      redeemKey = keyEntry.key;
      reward = `Lifetime Premium • Redeem Key ${keyEntry.key}`;
      const user = await ctx.client.users.fetch(userId).catch(() => null);
      if (user) dmSent = await user.send(keyDeliveryCard(keyEntry, 'Lifetime', 'Thank you for your Shop purchase!')).then(() => true).catch(() => false);
    }
  } catch (err) {
    console.error('[Shop] Reward application failed after purchase:', err);
    // Do NOT silently refund or create a second transaction. The purchase remains final and is logged.
    recordPurchase({ guildId, userId, item, cost: product.cost, remainingPoints: getPoints(guildId, userId), reward: `${product.title} (application error)` });
    return ctx.reply(card(`${getEmoji('error')} Your purchase was recorded, but the reward could not be applied automatically. Please contact the bot owner with the purchase time. **The purchase is final and cannot be undone.**`, 0xED4245, slash));
  }

  const remainingPoints = getPoints(guildId, userId);
  recordPurchase({ guildId, userId, item, cost: product.cost, remainingPoints, reward });
  if (item === 'premium7d' || item === 'premium_lifetime') {
    await guildLog(ctx.guild, { category:'Premium', title:'Premium Purchased', description:`${ctx.user ?? ctx.author} purchased ${product.title} from the Orbie Shop.`, fields:[{name:'User',value:`${ctx.user ?? ctx.author}`},{name:'Item',value:product.title},{name:'Cost',value:`${product.cost} Orbie Points`},{name:'Key',value:'Generated and delivered privately'}], color:'premium' });
  }
  const keyNote = redeemKey ? `\n\n${getEmoji('key')} **Premium Key:** ${dmSent ? 'Sent to your DMs with a private reveal button' : 'Could not DM you — contact the bot owner securely.'}\n${getEmoji('book_')} Open the Premium panel and click **Activate Premium**.` : '';
  return ctx.reply(card(`${getEmoji('success')} **Purchase successful!**\n\n${getEmoji('shop')} **Item:** ${product.title}\n${getEmoji('dot')} **Cost:** ${product.cost} Orbie Points\n${getEmoji('dot')} **Remaining:** ${remainingPoints} Orbie Points${keyNote}\n\n${getEmoji('warning')} **Final sale:** this purchase cannot be refunded, exchanged, transferred, or undone.`));
}

export { shopCommand, pointsCommand, pointsShortcutCommand, buyCommand };
