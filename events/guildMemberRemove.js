const { Events, EmbedBuilder, ChannelType } = require('discord.js');
const { loadTribes, saveTribes, loadGuildConfig, isPermabanned } = require('../utils/dataManager');
const { updateLog } = require('../utils/logger');
const { BAN_THRESHOLD } = require('../utils/constants');
// ELIMINADA LA LÍNEA DE IMAGEMAKER

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        const guild = member.guild;
        const config = loadGuildConfig(guild.id);
        if (!config) return;

        // 1. Limpieza de canal de registro
        let regChannel = guild.channels.cache.find(c => 
            c.type === ChannelType.GuildText && 
            c.topic && 
            c.topic.includes(`USER:${member.id}`)
        );

        if (!regChannel && config.categories.private_registration) {
            const suffix = member.id.slice(-4);
            regChannel = guild.channels.cache.find(c => 
                c.parentId === config.categories.private_registration && 
                c.name.includes('registro') && 
                c.name.includes(suffix)
            );
        }

        if (regChannel) {
            await regChannel.delete('Usuario abandonó').catch(() => {});
        }

        // 2. Gestión de Tribus y Bans
        let tribes = loadTribes(guild.id);
        let saved = false;
        let wasBanned = false;
        let banReason = 'Salida Voluntaria'; 
        let tribeName = null;
        let tribeData = null; 

        const permabanInfo = isPermabanned(guild.id, member.id);
        if (permabanInfo) {
            wasBanned = true;
            banReason = `⛔ Permaban: ${permabanInfo.reason}`;
        }

        for (const tName in tribes) {
            const t = tribes[tName];
            const idx = t.members.findIndex(m => m.discordId === member.id);
            if (idx !== -1) {
                tribeName = tName;
                tribeData = t;
                const totalWarns = (t.members[idx].warnings || 0) + (t.warnings || 0);
                if (!wasBanned && totalWarns >= BAN_THRESHOLD) {
                    wasBanned = true;
                    banReason = 'Acumulación de Warns';
                }
                t.members.splice(idx, 1);
                saved = true;
                if (t.members.length === 0) {
                    guild.roles.cache.find(r => r.name === tName)?.delete().catch(()=>{});
                    guild.channels.cache.get(t.channelId)?.delete().catch(()=>{});
                    delete tribes[tName];
                    tribeData = null;
                }
                break;
            }
        }

        if (saved) {
            saveTribes(guild.id, tribes);
            updateLog(guild, member.client);
        }

        // 3. Notificaciones (SIN CANVAS)
        const tribeDisplay = tribeName || 'Sin Tribu';
        const byeChan = guild.channels.cache.get(config.channels.goodbye);
        const banChan = guild.channels.cache.get(config.channels.ban_notifications);

        if (wasBanned && banChan) {
            const banEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(`🚫 REPORTE DE EXPULSIÓN`)
                .setDescription(`**${member.user.tag}** ha sido eliminado permanentemente.`)
                .setThumbnail(member.user.displayAvatarURL())
                .addFields(
                    { name: '👤 Usuario', value: `${member.user.username}\n\`${member.id}\``, inline: true },
                    { name: '🛡️ Afiliación', value: tribeDisplay, inline: true },
                    { name: '📉 Causa', value: `\`${banReason}\``, inline: false }
                )
                .setFooter({ text: 'Sistema de Justicia', iconURL: guild.iconURL() })
                .setTimestamp();
            banChan.send({ embeds: [banEmbed] }).catch(()=>{});
        }

        if (byeChan && !wasBanned) {
            const byeEmbed = new EmbedBuilder()
                .setColor('#607D8B')
                .setTitle('🍂 Un Superviviente ha partido...')
                .setDescription(`**${member.user.tag}** ha decidido abandonar la isla.`)
                .setThumbnail(member.user.displayAvatarURL())
                .addFields(
                    { name: '👤 Usuario', value: `${member.user.username}`, inline: true },
                    { name: '🛡️ Antigua Tribu', value: tribeDisplay, inline: true }
                )
                .setFooter({ text: `Esperamos verte de nuevo.`, iconURL: guild.iconURL() })
                .setTimestamp();
            byeChan.send({ embeds: [byeEmbed] }).catch(()=>{});
        }

        if (tribeData && tribeData.channelId) {
            const tCh = guild.channels.cache.get(tribeData.channelId);
            if (tCh) {
                const tEmbed = new EmbedBuilder()
                    .setTitle(wasBanned ? '🚨 ALERTA' : 'ℹ️ INFORME')
                    .setColor(wasBanned ? 'DarkRed' : 'Orange')
                    .setDescription(wasBanned 
                        ? `**${member.user.username}** ha sido **BANEADO** de **${guild.name}**.` 
                        : `**${member.user.username}** ha abandonado la tribu **${tribeName}** y **${guild.name}**.`)
                    .setTimestamp();
                tCh.send({ embeds: [tEmbed] }).catch(()=>{});
            }
        }
    },
};
