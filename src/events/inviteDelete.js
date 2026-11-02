import { updateInviteCache } from '../utils/inviteTracker.js';
export default { name:'inviteDelete', once:false, async execute(invite){ await updateInviteCache(invite.guild).catch(()=>{}); } };
