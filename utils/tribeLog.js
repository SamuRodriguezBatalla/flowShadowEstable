const { EmbedBuilder } = require('discord.js');

/**
 * Envía un log de auditoría al canal privado de la tribu.
 * @param {object} guild - El objeto Guild de Discord.
 * @param {object} tribeData - Los datos de la tribu (del JSON).
 * @param {string} title - Título del Embed.
 * @param {string} description - Descripción del evento.
 * @param {string} color - Color en Hex (Default: Gold).
 */
async function logToTribe(guild, tribeData, title, description, color = '#FFD700') {
    if (!tribeData || !tribeData.channelId) return;
    
    const channel = guild.channels.cache.get(tribeData.channelId);
    
    if (channel) {
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color)
            .setTimestamp()
            .setFooter({ text: 'Registro de Actividad de Tribu' });
            
        await channel.send({ embeds: [embed] }).catch(console.error);
    }
}

module.exports = { logToTribe };