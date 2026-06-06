const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nuke')
        .setDescription('💣 Borra TODOS los mensajes del canal (Clonándolo).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const channel = interaction.channel;

        if (!channel) return;

        // Verificación: Solo canales de texto normales
        if (!channel.isTextBased() || channel.isThread() || channel.isVoiceBased()) {
            return interaction.reply({ 
                content: '❌ Este comando solo sirve para reiniciar canales de texto normales.', 
                flags: MessageFlags.Ephemeral 
            });
        }

        // 1. Crear Botones de Confirmación
        const confirmButton = new ButtonBuilder()
            .setCustomId('confirm-nuke')
            .setLabel('☢️ SÍ, DETONAR')
            .setStyle(ButtonStyle.Danger); // Color Rojo

        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel-nuke')
            .setLabel('Cancelar')
            .setStyle(ButtonStyle.Secondary); // Color Gris

        const row = new ActionRowBuilder()
            .addComponents(cancelButton, confirmButton);

        // 2. Enviar mensaje de advertencia (Solo visible para ti)
        const response = await interaction.reply({ 
            content: `⚠️ **¿Estás seguro de que quieres reiniciar este canal?**\n\nEsta acción:\n- Borrará **todos** los mensajes e historial.\n- Eliminará los mensajes fijados (pins).\n- **No se puede deshacer.**`,
            components: [row],
            flags: MessageFlags.Ephemeral 
        });

        // 3. Crear el colector para escuchar el clic del botón
        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 15000 // 15 segundos para decidir
        });

        collector.on('collect', async i => {
            if (i.customId === 'confirm-nuke') {
                // --- EJECUCIÓN DEL NUKE ---
                await i.update({ content: '☢️ **Iniciando protocolo de reinicio...**', components: [] });
                
                try {
                    // Clonar el canal con sus opciones (posición, permisos, tema, etc.)
                    const newChannel = await channel.clone({
                        position: channel.position
                    });

                    // Borrar el viejo
                    await channel.delete('Nuke Command Executed');

                    // Mensaje en el nuevo canal
                    await newChannel.send('https://media.giphy.com/media/HhTXt43pk1I1W/giphy.gif');
                    await newChannel.send(`💣 **Canal reiniciado con éxito por ${interaction.user}.**`);

                } catch (error) {
                    console.error(error);
                }

            } else if (i.customId === 'cancel-nuke') {
                // --- CANCELACIÓN ---
                await i.update({ content: '✅ Operación cancelada. El canal está a salvo.', components: [] });
            }
        });

        collector.on('end', collected => {
            // Si no pulsó nada en 15 segundos, desactivamos los botones
            if (collected.size === 0) {
                interaction.editReply({ content: '⏳ Tiempo de espera agotado. Operación cancelada.', components: [] }).catch(() => {});
            }
        });
    },
};