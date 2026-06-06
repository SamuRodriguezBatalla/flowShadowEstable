const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('🗑️ Elimina una cantidad específica de mensajes recientes (Máx 100).')
        .addIntegerOption(option => 
            option.setName('cantidad')
                .setDescription('Número de mensajes a borrar (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)) // Discord solo permite borrar 100 de golpe
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Solo Admins

    async execute(interaction) {
        const amount = interaction.options.getInteger('cantidad');
        const channel = interaction.channel;

        if (!channel) return;

        // Respondemos primero de forma invisible para confirmar que el bot te escuchó
        await interaction.reply({ 
            content: `🧹 Iniciando borrado de **${amount}** mensajes...`, 
            flags: MessageFlags.Ephemeral 
        });

        try {
            // channel.bulkDelete(cantidad, filtrarViejos)
            // El 'true' es importante: le dice a Discord "si encuentras mensajes de más de 14 días, ignóralos y no me des error".
            const deleted = await channel.bulkDelete(amount, true);

            // Confirmamos cuántos se borraron realmente
            // (Puede ser menos de lo pedido si había mensajes muy viejos)
            if (deleted.size === 0) {
                await interaction.editReply({ 
                    content: '⚠️ No se pudieron borrar mensajes. Posiblemente sean demasiado antiguos (más de 14 días).' 
                });
            } else {
                await interaction.editReply({ 
                    content: `✅ **¡Listo!** Se han eliminado **${deleted.size}** mensajes.` 
                });
            }

        } catch (error) {
            console.error("Error en /clear:", error);
            await interaction.editReply({ 
                content: '❌ Ocurrió un error al intentar borrar los mensajes. Asegúrate de que tengo permisos para "Gestionar Mensajes".' 
            });
        }
    },
};