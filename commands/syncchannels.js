const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { loadGuildConfig } = require('../utils/dataManager');
const { sincronizarRegistros } = require('../utils/syncManager'); 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('syncchannels')
        // DESCRIPCIÓN CORREGIDA (Menos de 100 caracteres)
        .setDescription('👮 Crea el canal de registro para usuarios que ya tienen el rol "No Verificado".') 
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const guild = interaction.guild;
        const config = loadGuildConfig(guild.id);

        if (!config || !config.roles.unverified) {
            return interaction.editReply("❌ Configuración incompleta. Asegúrate de ejecutar /setup.");
        }

        try {
            await interaction.editReply("🔄 **Iniciando escaneo y creación de canales...**");
            
            // Llama a la función principal de chequeo de la DB/Roles
            await sincronizarRegistros(guild, config);

            return interaction.editReply("✅ Sincronización completa. Los canales faltantes han sido creados.");

        } catch (error) {
            console.error(`Error en /syncchannels: ${error.message}`);
            return interaction.editReply(`❌ Error durante la sincronización: ${error.message}`);
        }
    },
};