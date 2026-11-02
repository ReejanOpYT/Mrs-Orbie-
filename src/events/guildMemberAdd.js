import { resolveUsedInvite } from '../utils/inviteTracker.js';
import { getEmoji } from '../handlers/emoji.js';
import { guildLog } from '../utils/guildLogger.js';

export default {
  name: 'guildMemberAdd',
  once: false,
  async execute(member) {
    try {
      const result = await resolveUsedInvite(member);
      if (!result?.inviterId) return;
      const inviter = await member.client.users.fetch(result.inviterId).catch(() => null);
      if (!inviter) return;
      await guildLog(member.guild, { category:'Invite', title:'Successful Invite', description:`${inviter} successfully invited ${member.user}.`, fields:[{name:'Inviter',value:`${inviter} (${inviter.id})`},{name:'New Member',value:`${member.user} (${member.id})`},{name:'Points',value:`+${result.points} Orbie Point(s)`},{name:'Total',value:String(result.total)}], color:'invite' });
      await inviter.send(
        `${getEmoji('dot')} **New successful invite!**\n` +
        `You earned **+${result.points} Orbie Point${result.points === 1 ? '' : 's'}** in **${member.guild.name}**.\n` +
        `${getEmoji('star')} Your balance: **${result.total} Orbie Points**`,
      ).catch(() => {});
    } catch (err) {
      console.warn(`[Invite Tracker] ${err.message}`);
    }
  },
};
