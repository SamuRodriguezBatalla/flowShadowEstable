const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { logHistoricalData } = require('../utils/historyLogger'); 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkout')
        .setDescription('💾 Consulta el registro de tribus de una Season archivada.')
        .addStringOption(option => option.setName('season_number')
            .setDescription('El número de Season a consultar.')
            .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const seasonNumber = interaction.options.getString('season_number');
        await interaction.deferReply(); 

        try {
            // Pasamos el ID del guild para leer SU historial
            const historyEmbeds = logHistoricalData(interaction.guild.id, seasonNumber);
            
            if (!historyEmbeds || historyEmbeds.length === 0) {
                return interaction.editReply(`❌ No se encontraron datos para la Season ${seasonNumber} en este servidor.`);
            }

            await interaction.editReply({ 
                content: `📜 **REGISTRO ARCHIVADO:** Temporada ${seasonNumber}`,
                embeds: historyEmbeds,
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Error al leer historial.');
        }
    },
};