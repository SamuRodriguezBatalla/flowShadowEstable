const { EmbedBuilder } = require('discord.js');

/**
 * Genera el Embed de ayuda con la lista de comandos actualizada.
 * Separa las funciones por roles para mayor claridad.
 * @returns {EmbedBuilder}
 */
function generateTribeHelpEmbed() {
    return new EmbedBuilder()
        .setTitle('📜 Guía de Comandos de la Tribu')
        .setDescription('Aquí tenéis la lista de comandos disponibles para gestionar vuestra tribu y supervivencia.')
        .setColor('#00BFFF') // Deep Sky Blue
        .addFields(
            { 
                name: '👤 Para Todos los Miembros', 
                value: 
                '`/tribu info` - Muestra la ficha de la tribu, miembros y estado.\n' +
                '`/tribu votar` - Inicia o participa en una votación de liderazgo.\n' +
                '`/tribu checkin` - 🕒 **Importante:** Renueva la actividad de la base para evitar el borrado.\n' +
                '`/infoplayer [usuario]` - Muestra la ficha (ID, Warns, Kit) de un jugador.'
            },
            { 
                name: '👑 Solo para Líderes', 
                value: 
                '`/tribu reclutar @Usuario` - Invita a un jugador sin tribu a unirse a la tuya.\n' +
                '`/tribu ascender @Usuario` - Traspasa el liderazgo a otro miembro.\n' +
                '`/tribu kick @Usuario` - Expulsa a un miembro de la tribu.\n' +
                '`/tribu rename "Nombre"` - Cambia el nombre de la tribu.'
            }
        )
        .setFooter({ text: 'Sistema de Ayuda Dinámico • BotArk' })
        .setTimestamp();
}

module.exports = { generateTribeHelpEmbed };
