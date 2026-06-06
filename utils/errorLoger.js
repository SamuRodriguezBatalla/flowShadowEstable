const { EmbedBuilder } = require('discord.js');

/**
 * Envía un error al canal de logs de soporte.
 * @param {Client} client - El cliente del bot.
 * @param {Error|string} error - El objeto de error o mensaje.
 * @param {string} context - Dónde ocurrió (ej: "Comando /setup", "Global").
 */
async function logError(client, error, context = 'Sistema Global') {
    // NOMBRE EXACTO del canal que creamos en setupsoporte
    const LOG_CHANNEL_NAME = 'logs-errores'; 

    // 1. Buscar el canal en la caché del bot
    // (Busca en todos los servidores. Si tienes el ID del server de soporte, sería mejor buscarlo allí específicamente)
    const logChannel = client.channels.cache.find(c => c.name === LOG_CHANNEL_NAME && c.isTextBased());

    // Si no existe el canal, lo mostramos por consola y salimos
    if (!logChannel) {
        console.error("⚠️ No se encontró el canal 'logs-errores' para reportar:");
        console.error(error);
        return;
    }

    // 2. Prevenir errores circulares (si el error es vacío)
    const errMessage = error.message || error || 'Error desconocido';
    const errStack = error.stack ? error.stack.substring(0, 1000) : 'Sin stacktrace'; // Discord limita a 1024 chars

    // 3. Crear Embed
    const embed = new EmbedBuilder()
        .setTitle('🚨 Excepción Detectada')
        .setColor('#FF0000') // Rojo Sangre
        .addFields(
            { name: '📍 Contexto', value: `\`${context}\``, inline: true },
            { name: '📄 Error', value: `\`\`\`xl\n${errMessage}\n\`\`\`` },
            { name: '🧩 Stack Trace', value: `\`\`\`js\n${errStack}\n\`\`\`` }
        )
        .setTimestamp()
        .setFooter({ text: 'Sistema de Reporte Automático' });

    // 4. Enviar
    try {
        await logChannel.send({ embeds: [embed] });
    } catch (e) {
        console.error("Error crítico: No pude enviar el log al canal de Discord.", e);
    }
}

module.exports = { logError };