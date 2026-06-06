const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { saveStatusPanel, getStatusPanel } = require('../utils/dataManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setupstatus')
        .setDescription('📊 Crea un panel de estado que se actualiza automáticamente.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const guild = interaction.guild;

        // 1. Borrar panel anterior de la DB si existe
        const oldPanel = getStatusPanel(guild.id);
        if (oldPanel) {
            // Intentar borrar el mensaje viejo para no dejar basura
            try {
                const ch = await guild.channels.fetch(oldPanel.channel_id);
                if (ch) await ch.messages.delete(oldPanel.message_id);
            } catch (e) {}
        }

        // 2. Enviar el nuevo panel (Placeholder)
        const embed = new EmbedBuilder()
            .setTitle('📡 Estado del Servidor')
            .setDescription('🔄 **Estableciendo conexión con el satélite...**\nEspera unos minutos para la primera actualización.')
            .setColor('Grey')
            .setTimestamp();

        const message = await interaction.channel.send({ embeds: [embed] });

        // 3. Guardar en DB
        saveStatusPanel(guild.id, interaction.channel.id, message.id);

        await interaction.editReply('✅ **Panel creado.** Se actualizará cada 5 minutos.');
    },
};
