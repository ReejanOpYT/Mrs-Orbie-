import { updateInviteCache } from '../utils/inviteTracker.js';
import { guildLog } from '../utils/guildLogger.js';

export default {
  name: 'inviteCreate',
  once: false,
  async execute(invite) {
    await updateInviteCache(invite.guild).catch(() => {});
    await guildLog(invite.guild, { category:'Invite', title:'Invite Created', description:`A new invite was created.`, fields:[{name:'Code',value:`\`${invite.code}\``},{name:'Inviter',value:invite.inviter ? `${invite.inviter} (${invite.inviter.id})` : 'Unknown'},{name:'Channel',value:`${invite.channel ?? 'Unknown'}`}], color:'invite' });
  },
};
