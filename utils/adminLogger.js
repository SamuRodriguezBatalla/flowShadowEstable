const { EmbedBuilder } = require('discord.js');
const { loadGuildConfig } = require('./dataManager');

async function logAdminAction(guild, user, command, details) {
    const config = loadGuildConfig(guild.id);
    if (!config || !config.channels.admin_log) return;

    const channel = guild.channels.cache.get(config.channels.admin_log);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle(`🛡️ Comando Admin Ejecutado`)
        .setColor('DarkRed')
        .addFields(
            { name: '👤 Admin', value: `${user.tag} (\`${user.id}\`)`, inline: true },
            { name: '⌨️ Comando', value: `\`/${command}\``, inline: true },
            { name: '📝 Detalles', value: details || 'Sin detalles', inline: false }
        )
        .setTimestamp();

    await channel.send({ embeds: [embed] }).catch(() => {});
}

module.exports = { logAdminAction };
