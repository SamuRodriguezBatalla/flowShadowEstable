const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { deleteArkConfig, getArkConfig } = require('../utils/dataManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unlinkark')
        .setDescription('🔌 Desvincula el servidor de Ark y borra los datos de conexión.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const config = getArkConfig(interaction.guild.id);

        if (!config) {
            return interaction.reply({ content: '❌ No hay ningún servidor de Ark vinculado actualmente.', ephemeral: true });
        }

        // Borrar datos
        deleteArkConfig(interaction.guild.id);

        await interaction.reply(`🔌 **Desvinculación completada.**\nSe han eliminado la IP y la contraseña de la base de datos segura.\nYa no se podrán ejecutar comandos RCON desde este servidor.`);
    },
};
