const { EmbedBuilder } = require('discord.js');
const { loadTribes, saveTribe } = require('./dataManager');

/**
 * Actualiza o crea el panel de información dentro del canal privado de la tribu.
 * @param {Object} guild El objeto Guild de Discord.
 * @param {String} tribeName El nombre de la tribu a actualizar.
 */
async function updateTribePanel(guild, tribeName) {
    const tribes = loadTribes(guild.id);
    const tData = tribes[tribeName];

    if (!tData || !tData.channelId) return;

    const channel = guild.channels.cache.get(tData.channelId);
    if (!channel) return;

    // 1. Construir el Embed con datos actualizados
    const membersList = tData.members.map(m => {
        const icon = m.rango === 'Líder' ? '👑' : '👤';
        const kit = m.hasKit ? '✅' : '❌';
        const warns = m.warnings || 0;
        return `${icon} **${m.username}** \n└ 🆔: \`${m.idPlay}\` | 📦 Kit: ${kit} | ⚠️ Warns: ${warns}`;
    }).join('\n\n');

    const wars = (tData.wars && tData.wars.length > 0) ? tData.wars.join(', ') : 'Ninguna';
    const alliances = (tData.alliances && tData.alliances.length > 0) ? tData.alliances.join(', ') : 'Ninguna';

    const panelEmbed = new EmbedBuilder()
        .setTitle(`🛡️ Panel de Control: ${tribeName}`)
        .setColor('#FFD700') // Dorado
        .setDescription(`Información en tiempo real de tu tribu.\n\n**👥 Miembros:**\n${membersList || 'Nadie'}`)
        .addFields(
            { name: '⚔️ Guerras Activas', value: wars, inline: true },
            { name: '🕊️ Alianzas', value: alliances, inline: true },
            { name: '⚠️ Warns de Tribu', value: `${tData.warnings || 0}`, inline: true },
            { name: '🛠️ Comandos Rápidos', value: '`/tribu reclutar` • `/tribu checkin` • `/diplomacia` • `/mercado`', inline: false }
        )
        .setFooter({ text: 'Este mensaje se actualiza automáticamente.' })
        .setTimestamp();

    // 2. Buscar mensaje existente o enviar nuevo
    try {
        let message = null;
        if (tData.instructionMessageId) {
            try {
                message = await channel.messages.fetch(tData.instructionMessageId);
            } catch (e) {
                // Si falla (borrado manual), message será null
            }
        }

        if (message) {
            // Editar existente
            await message.edit({ embeds: [panelEmbed] });
        } else {
            // Enviar nuevo y guardar ID
            const newMsg = await channel.send({ embeds: [panelEmbed] });
            await newMsg.pin().catch(()=>{}); // Fijar mensaje
            
            tData.instructionMessageId = newMsg.id;
            saveTribe(guild.id, tribeName, tData);
        }
    } catch (error) {
        console.error(`Error actualizando panel de tribu ${tribeName}:`, error);
    }
}

module.exports = { updateTribePanel };
