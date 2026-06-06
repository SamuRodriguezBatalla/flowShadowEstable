const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { logHistoricalData } = require('../utils/historyLogger'); 
const { getAvailableSeasons } = require('../utils/dataManager'); // <-- NUEVA FUNCIÓN
const { loadGuildConfig } = require('../utils/dataManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('historycheck')
        .setDescription('💾 Consulta el registro de tribus de una Season archivada.')
        .addStringOption(option => option.setName('season_number')
            .setDescription('El número de Season a consultar (ej: 1, 2, 3).')
            .setRequired(true)
            .setAutocomplete(true)) // <-- ACTIVAMOS AUTOCOMPLETE
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const guildId = interaction.guild.id;
        
        // Obtener todas las seasons archivadas para este servidor
        const choices = getAvailableSeasons(guildId); 
        
        // Filtramos las opciones basadas en lo que el usuario está escribiendo
        const filtered = choices.filter(choice => String(choice).startsWith(focusedValue));
        
        await interaction.respond(
            filtered.slice(0, 25).map(choice => ({ 
                name: `Season ${choice}`, 
                value: String(choice) 
            })),
        );
    },

    async execute(interaction) {
        const seasonNumber = interaction.options.getString('season_number');
        const guildId = interaction.guild.id;
        
        // Verificación de permiso redundante (ya está en data, pero es buena práctica)
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Solo administradores.', ephemeral: true });
        }

        await interaction.deferReply(); 

        try {
            // logHistoricalData ya está configurada para leer de la base de datos (DB)
            const historyEmbeds = logHistoricalData(guildId, seasonNumber);
            
            if (!historyEmbeds || historyEmbeds.length === 0) {
                return interaction.editReply(`❌ No se encontraron datos archivados para la Season ${seasonNumber} en este servidor.`);
            }

            await interaction.editReply({ 
                content: `📜 **REGISTRO ARCHIVADO:** Temporada ${seasonNumber}`,
                embeds: historyEmbeds,
            });

        } catch (error) {
            console.error(`Error al procesar /historycheck para Season ${seasonNumber}:`, error);
            await interaction.editReply('❌ Hubo un error al leer los datos de la temporada. Revisa los logs.');
        }
    },
};