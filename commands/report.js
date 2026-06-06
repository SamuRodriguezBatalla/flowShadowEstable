const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('report')
        .setDescription('🚨 Reportar a un jugador (Abre formulario).'),

    async execute(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('report_modal')
            .setTitle('🚨 Reporte de Jugador');

        const nameInput = new TextInputBuilder()
            .setCustomId('report_name')
            .setLabel("Nombre del Acusado / Tribu")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const reasonInput = new TextInputBuilder()
            .setCustomId('report_reason')
            .setLabel("Motivo del Reporte")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const proofInput = new TextInputBuilder()
            .setCustomId('report_proof')
            .setLabel("Pruebas (Links de imagen/video)")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false);

        modal.addComponents(new ActionRowBuilder().addComponents(nameInput), new ActionRowBuilder().addComponents(reasonInput), new ActionRowBuilder().addComponents(proofInput));

        await interaction.showModal(modal);
    },
};
