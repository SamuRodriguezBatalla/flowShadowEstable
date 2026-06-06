const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType } = require('discord.js');
const { resetServerData, loadGuildConfig, saveGuildConfig, isPermabanned, getGameBans, removeGameBan } = require('../utils/dataManager');
const { updateLog } = require('../utils/logger');
const { sincronizarRegistros } = require('../utils/syncManager');
const { sendRconCommand } = require('../utils/rconManager');

async function deleteChannelsInCategory(guild, categoryId) {
    if (!categoryId) return;
    const config = require('../utils/dataManager').loadGuildConfig(guild.id);
    if (config && (config.categories.market === categoryId || config.categories.admin === categoryId)) return;
    const category = guild.channels.cache.get(categoryId);
    if (!category || category.type !== ChannelType.GuildCategory) return;
    for (const [channelId, channel] of category.children.cache) {
        if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildVoice){
		await channel.delete().catch(()=>{});
		await new Promise(res => setTimeout(res, 500));
	}
    }
    await category.delete().catch(()=>{});
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
    data: new SlashCommandBuilder().setName('fullwipe').setDescription('☢️ BORRADO TOTAL: Season 0.').addBooleanOption(o => o.setName('auto_registros').setDescription('¿Crear canales?').setRequired(false)).setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        try { await interaction.deferReply({ fetchReply: true }); } catch (e) { return; }
        const autoSync = interaction.options.getBoolean('auto_registros') ?? true;

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('cancel_fullwipe').setLabel('Cancelar').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('confirm_fullwipe').setLabel('SÍ, REINICIAR').setStyle(ButtonStyle.Danger)
        );
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('☢️ FULL WIPE').setDescription('⚠️ Se eliminará TODO.\n⚠️ Reset a Season 0.').setColor('DarkRed')], components: [row] });

        const collector = interaction.channel.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 30000, max: 1 });
        collector.on('collect', async i => {
            if (i.customId === 'cancel_fullwipe') return i.update({ content: 'Cancelado.', embeds: [], components: [] });
            await i.update({ content: '☢️ **Ejecutando Demolición...**', embeds: [], components: [] });

            try {
                const guild = interaction.guild;
                let config = loadGuildConfig(guild.id) || { roles: {}, channels: {}, categories: {} };
                snapshotNames(guild, config);

                await deleteChannelsInCategory(guild, config.categories.private_registration);
                await deleteChannelsInCategory(guild, config.categories.tribes);
                resetServerData(guild.id); 
                config = loadGuildConfig(guild.id); 
                config.season = 0;

                const namePriv = config.names['cat_private_registration'] || '🔐 Rᴇɢɪsᴛʀᴏ-Pʀɪᴠᴀᴅᴏ';
                const newPrivateCat = await guild.channels.create({ name: namePriv, type: ChannelType.GuildCategory, position: 0, permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }] });
                config.categories.private_registration = newPrivateCat.id;
                
                const nameTribes = config.names['cat_tribes'] || 'Tʀiʙuѕ';
                const newTribesCat = await guild.channels.create({ name: nameTribes, type: ChannelType.GuildCategory, position: 2 });
                config.categories.tribes = newTribesCat.id;
                
                const leaderGlobalRole = guild.roles.cache.get(config.roles.leader);
                if (leaderGlobalRole) {
                    const nameLeader = config.names['ch_leader_channel'] || '👑・sᴀʟᴀ-ᴅᴇ-lɪᴅᴇʀᴇs';
                    const leaderChan = await guild.channels.create({ name: nameLeader, type: ChannelType.GuildText, parent: config.categories.tribes, permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: leaderGlobalRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] }).catch(()=>{});
                    if(leaderChan) config.channels.leader_channel = leaderChan.id; 
                }

                // RECREAR ERROR LOG PÚBLICO
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

                saveGuildConfig(guild.id, config); await updateLog(guild, interaction.client);

                const safeIDs = [config.roles.unverified, config.roles.survivor, config.roles.leader, config.roles.admin, config.roles.staff, guild.id, ...(config.roles.protected || [])];
                const roles = await guild.roles.fetch();
                for (const r of roles.values()) {
                    if (!safeIDs.includes(r.id) && !r.managed && !r.permissions.has('Administrator')) await r.delete().catch(()=>{});
                }

                const unverifiedRole = guild.roles.cache.get(config.roles.unverified);
                let membersToProcess = guild.members.cache; try { membersToProcess = await guild.members.fetch({ time: 30000, force: true }); } catch (e) {}
                if (unverifiedRole) {
                    for (const m of membersToProcess.values()) {
                        if (m.user.bot || m.id === guild.ownerId || m.permissions.has(PermissionFlagsBits.Administrator)) continue;
                        await m.roles.set([unverifiedRole.id]).catch(()=>{}); await new Promise(r => setTimeout(r, 100));
                    }
                }

                let unbannedCount = 0;
                try {
                    const bans = await guild.bans.fetch();
                    for (const [userId, banInfo] of bans) {
                        if (!isPermabanned(guild.id, userId)) { await guild.members.unban(userId, `Full Wipe Amnistía`); unbannedCount++; }
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
                                await u.send(`☢️ **¡Full Wipe en ${guild.name}!**\nTu baneo en Ark ha sido revocado.`);
                            } catch (e) {}
                        }
                        removeGameBan(guild.id, ban.ark_id);
                        arkUnbans++;
                    }
                }

                let syncText = autoSync ? "Creando canales..." : "Canales: Manuales.";
                await interaction.editReply({ content: `✅ **Wipe Completado.**\nSeason 0.\n${syncText}`, components: [] });
                
                if (autoSync) await sincronizarRegistros(guild, config);

            } catch (e) { console.error("Error FATAL:", e); await interaction.editReply({ content: `❌ Error: ${e.message}`, components: [] }); }
        });
    }
};
