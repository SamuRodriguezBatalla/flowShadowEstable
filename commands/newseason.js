const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { loadTribes, saveTribes, loadGuildConfig, saveGuildConfig, archiveSeason, isPermabanned, getGameBans, removeGameBan } = require('../utils/dataManager');
const { updateLog } = require('../utils/logger');
const { sincronizarRegistros } = require('../utils/syncManager'); 
const { sendRconCommand } = require('../utils/rconManager');

async function deleteChannelsInCategory(guild, categoryId) {
    if (!categoryId) return;
    const config = require('../utils/dataManager').loadGuildConfig(guild.id);
    
    // PROTECCIÓN: Mercado y Admin
    if (config && (config.categories.market === categoryId || config.categories.admin === categoryId)) return;

    const category = guild.channels.cache.get(categoryId);
    if (!category || category.type !== ChannelType.GuildCategory) return;

    for (const [channelId, channel] of category.children.cache) {
        if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildVoice) {
           await channel.delete().catch(e => console.log(`Error borrando canal ${channel.name}: ${e.message}`));
	   await new Promise(res => setTimeout(res, 500));
        }
    }
    await category.delete().catch(e => console.log(`Error borrando categoría ${category.name}: ${e.message}`));
}

function snapshotNames(guild, config) {
    if (!config.names) config.names = {};
    const catKeys = ['private_registration', 'registration', 'tribes', 'market', 'admin'];
    catKeys.forEach(k => { if (config.categories[k]) { const c = guild.channels.cache.get(config.categories[k]); if (c) config.names[`cat_${k}`] = c.name; } });
    const chanKeys = ['welcome', 'log', 'checkin_log', 'goodbye', 'ban_notifications', 'leader_channel', 'market', 'error_log', 'admin_log', 'reports'];
    chanKeys.forEach(k => { if (config.channels[k]) { const c = guild.channels.cache.get(config.channels[k]); if (c) config.names[`ch_${k}`] = c.name; } });
    saveGuildConfig(guild.id, config);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('newseason')
        .setDescription('🚀 Inicia nueva season.')
        .addBooleanOption(option => option.setName('auto_registros').setDescription('¿Crear canales YA?').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try { await interaction.deferReply(); } catch (e) { return; }
        const guild = interaction.guild;
        const autoSync = interaction.options.getBoolean('auto_registros') ?? true;
        let config = loadGuildConfig(guild.id);
        if (!config) return interaction.editReply('❌ Falta /setup.');

        snapshotNames(guild, config);

        try {
            const oldSeason = config.season || 0;
            const currentTribes = loadTribes(guild.id);
            archiveSeason(guild.id, oldSeason, currentTribes);
            saveTribes(guild.id, {}); 
            config.season = oldSeason + 1;
            await interaction.editReply(`🔥 **Cambiando a Season ${config.season}...**`);

            await deleteChannelsInCategory(guild, config.categories.private_registration);
            await deleteChannelsInCategory(guild, config.categories.tribes);

            const namePriv = config.names['cat_private_registration'] || '🔐 Rᴇɢɪsᴛʀᴏ-Pʀɪᴠᴀᴅᴏ';
            const newPrivateCat = await guild.channels.create({
                name: namePriv, type: ChannelType.GuildCategory, position: 0, 
                permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }]
            });
            config.categories.private_registration = newPrivateCat.id;
            
            const nameTribes = config.names['cat_tribes'] || 'Tʀiʙuѕ';
            const newTribesCat = await guild.channels.create({ name: nameTribes, type: ChannelType.GuildCategory, position: 2 });
            config.categories.tribes = newTribesCat.id; 
            
            const leaderGlobalRole = guild.roles.cache.get(config.roles.leader);
            if (leaderGlobalRole) {
                const nameLeader = config.names['ch_leader_channel'] || '👑・sᴀʟᴀ-ᴅᴇ-lɪᴅᴇʀᴇs'; 
                const leaderChan = await guild.channels.create({
                    name: nameLeader, type: ChannelType.GuildText, parent: config.categories.tribes, 
                    permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: leaderGlobalRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }]
                }).catch(()=>{});
                if(leaderChan) config.channels.leader_channel = leaderChan.id;
            }
            
            const nameError = config.names['ch_error_log'] || 'Eʀʀᴏʀᴇs-ᴅᴇ-Rᴇɢɪsᴛʀᴏ · 🚨';
            const errorChan = await guild.channels.create({
                name: nameError, type: ChannelType.GuildText, parent: newPrivateCat.id,
                permissionOverwrites: [
                    { id: guild.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] }, 
                    { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ]
            });
            await errorChan.setPosition(0);
            config.channels.error_log = errorChan.id;

            saveGuildConfig(guild.id, config);

            const safeIDs = [config.roles.unverified, config.roles.survivor, config.roles.leader, config.roles.admin, config.roles.staff, guild.id, ...(config.roles.protected || [])];
            const roles = await guild.roles.fetch();
            for (const r of roles.values()) {
                if (!safeIDs.includes(r.id) && !r.managed && !r.permissions.has(PermissionFlagsBits.Administrator)) await r.delete().catch(()=>{});
            }

            const unverifiedRole = guild.roles.cache.get(config.roles.unverified);
            let membersToProcess = guild.members.cache; try { membersToProcess = await guild.members.fetch({ time: 30000, force: true }); } catch (e) {}
            if (unverifiedRole) {
                for (const m of membersToProcess.values()) {
                    if (m.user.bot || m.id === guild.ownerId || m.permissions.has(PermissionFlagsBits.Administrator)) continue;
                    await m.roles.set([unverifiedRole.id]).catch(()=>{}); await new Promise(r => setTimeout(r, 100));
                }
            }
            
            await updateLog(guild, interaction.client);

            let unbannedCount = 0;
            try {
                const bans = await guild.bans.fetch();
                for (const [userId, banInfo] of bans) {
                    if (!isPermabanned(guild.id, userId)) { await guild.members.unban(userId, `Season ${config.season}`); unbannedCount++; }
                }
            } catch (err) {}

            const gameBans = getGameBans(guild.id);
            let arkUnbans = 0;
            for (const ban of gameBans) {
                if (ban.ban_type === 'season') {
                    await sendRconCommand(guild.id, `UnbanPlayer "${ban.ark_id}"`);
                    if (ban.discord_id) {
                        try {
                            const u = await interaction.client.users.fetch(ban.discord_id);
                            await u.send(`🦖 **¡Nueva Season en ${guild.name}!**\nTu baneo en Ark ha sido levantado.`);
                        } catch (e) {}
                    }
                    removeGameBan(guild.id, ban.ark_id);
                    arkUnbans++;
                }
            }

            let syncText = autoSync ? "Abriendo canales..." : "Canales: Manuales.";
            await interaction.editReply(`✅ **Season ${config.season} iniciada.**\n- ${syncText}`);
            
            if (autoSync) await sincronizarRegistros(guild, config);

        } catch (e) {
            console.error("Error FATAL:", e);
            await interaction.editReply(`❌ Error: ${e.message}`);
        }
    }
};
