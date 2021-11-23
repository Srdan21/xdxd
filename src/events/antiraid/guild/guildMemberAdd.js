module.exports = async (oneforall, member) => {
    const {guild} = member;
    if(!member.user.bot) return
    if (!guild.me.permissions.has("VIEW_AUDIT_LOG")) return console.log("Permissions view audit logs is missing to the client");
    const guildData = oneforall.managers.guildsManager.getAndCreateIfNotExists(guild.id, {
        guildId: guild.id
    })
    const eventName = "antiBot"
    if (!guildData.antiraid.enable[eventName]) return;
    const action = await guild.fetchAuditLogs({type: "BOT_ADD"}).then(async (audit) => audit.entries.first());
     if(!action || action.executor.id === oneforall.user.id || oneforall.isOwner(action.executor.id)) return
    const memberData = oneforall.managers.membersManager.getAndCreateIfNotExists(`${guild.id}-${action.executor.id}`, {
        guildId: guild.id,
        memberId: action.executor.id
    });
    if (!memberData) return;
    memberData.permissionManager = new oneforall.Permission(oneforall, guild.id, action.executor.id, memberData, guildData);
    const hasPermission = memberData.permissionManager.has(`EVENT_ANTIRAID_${eventName.toUpperCase()}`)
    if (hasPermission) return;
    const sanction = guildData.antiraid.config[eventName]
    const raidLogs = guildData.logs.antiraid;
    const channelLog = guild.channels.cache.get(raidLogs)
    const {logs} = oneforall.handlers.langHandler.get(guildData.lang);
    const {template} = logs;
    const log = template.guild.bot(action.executor, member.user)
    log.description += `\n Sanction: **${sanction}**`
    if (sanction === 'ban') {
        guild.members.ban(action.executor.id, {days: 7, reason: `oneforall - ${eventName}`}).catch(() => {})
    }
    if (sanction === 'kick') {
        guild.members.kick(action.executor.id, `oneforall - ${eventName}`).catch(() => {})
    }
    if(sanction === 'unrank'){
        const memberExecutor = await guild.members.fetch(action.executor.id);
        const roleToSet = memberExecutor.roles.cache.filter(role => !oneforall.functions.roleHasSensiblePermissions(role.permissions))
        if(memberExecutor.manageable)
            memberExecutor.roles.set(roleToSet, `oneforall - ${eventName}`).catch(() => {})
        if(memberExecutor.user.bot){
            const {botRole} = memberExecutor.roles;
            await botRole.setPermissions(0n);
        }
    }
     if (sanction === 'mute') {
        if(!guildData.setup) return
        const mutedRole = guild.roles.cache.get(guildData.mute)
        if(!mutedRole) return
        const memberExecutor = await guild.members.fetch(action.executor.id);

        oneforall.managers.mutesManager.getAndCreateIfNotExists(`${guild.id}-${memberExecutor.id}`, {
            guildId: guild.id,
            memberId: memberExecutor.id,
            createdAt: new Date(),
            reason:  `oneforall - ${eventName}`,
            authorId: oneforall.user.id
        }).save().then(() => {
            memberExecutor.roles.add(guildData.mute, `oneforall - ${eventName}`)
        })
    }
    if(member.kickable)
        member.kick(`oneforall - ${eventName}`)
    if(!channelLog || channelLog.deleted) return;
    channelLog.send({embeds: [log]})


}