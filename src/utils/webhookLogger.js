const WEBHOOK_URL = process.env.WEBHOOK_LOG_URL;

function safe(value, fallback = 'Unknown') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value).slice(0, 1000);
}

export async function logWebhook({ type = 'Command Used', user, guild, command, source = 'Slash', status = 'Used' }) {
  if (!WEBHOOK_URL) return;

  try {
    const payload = {
      username: `${BOT_NAME} Logs`,
      embeds: [{
        title: `📋 ${safe(type)}`,
        color: status === 'Error' ? 0xED4245 : 0x57F287,
        fields: [
          { name: 'User', value: `${safe(user?.tag || user?.username)} (${safe(user?.id)})`, inline: true },
          { name: 'Server', value: `${safe(guild?.name, 'DM')} (${safe(guild?.id, 'N/A')})`, inline: true },
          { name: 'Command', value: `\`${safe(command)}\``, inline: true },
          { name: 'Source', value: safe(source), inline: true },
          { name: 'Status', value: safe(status), inline: true },
        ],
        timestamp: new Date().toISOString(),
      }],
    };

    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('[Webhook Logger] Failed to send log:', error.message);
  }
}


export async function logQuestWebhook({ user, guild, questName, gameTitle, status, progress = 0, logs = [], rewardCount = 0, completedAt = null }) {
  if (!WEBHOOK_URL) return;
  try {
    const cleanLogs = logs.slice(-8).map((line) => safe(line, '')).filter(Boolean).join('\n').slice(0, 3000);
    const payload = {
      username: `${BOT_NAME} Logs`,
      embeds: [{
        title: `📝 Quest ${safe(status)}`,
        color: status === 'Complete' ? 0x57F287 : status === 'Failed' ? 0xED4245 : 0x5865F2,
        fields: [
          { name: 'User', value: `${safe(user?.tag || user?.username)} (${safe(user?.id)})`, inline: true },
          { name: 'Server', value: `${safe(guild?.name, 'DM')} (${safe(guild?.id, 'N/A')})`, inline: true },
          { name: 'Quest', value: safe(questName), inline: false },
          { name: 'Game', value: safe(gameTitle), inline: true },
          { name: 'Progress', value: `${Math.max(0, Math.min(100, Number(progress) || 0))}%`, inline: true },
          { name: 'Rewards Claimed', value: String(rewardCount || 0), inline: true },
          ...(completedAt ? [{ name: 'Quest Completed At', value: new Date(completedAt).toISOString(), inline: false }] : []),
          { name: 'Recent Logs', value: cleanLogs || 'No logs recorded.', inline: false },
        ],
        timestamp: new Date().toISOString(),
      }],
    };
    await fetch(WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  } catch (error) {
    console.error('[Webhook Logger] Quest log failed:', error.message);
  }
}
