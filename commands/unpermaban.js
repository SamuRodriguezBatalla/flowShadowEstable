const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { removePermanentBan, isPermabanned } = require('../utils/dataManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unpermaban')
        .setDescription('🕊️ Revoca un baneo permanente (Elimina de la Lista Negra).')
        .addStringOption(option => option.setName('id_usuario').setDescription('ID del usuario a perdonar.').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        const targetId = interaction.options.getString('id_usuario');
        const guildId = interaction.guild.id;

        await interaction.deferReply();

        const banData = isPermabanned(guildId, targetId);
        if (!banData) return interaction.editReply(`⚠️ El usuario \`${targetId}\` no está en la Lista Negra.`);

        try {
            removePermanentBan(guildId, targetId);
            
            let discordUnbanStatus = '✅ Desbaneado de Discord.';
            try {
                await interaction.guild.members.unban(targetId, 'Unpermaban mediante BotArk');
            } catch (e) {
                discordUnbanStatus = '⚠️ No se pudo desbanear de Discord (Quizás no estaba baneado).';
            }

            await interaction.editReply(`🕊️ **Amnistía Concedida.**\nEl usuario \`${targetId}\` ha sido eliminado de la Lista Negra.\n(${discordUnbanStatus})`);

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Error al procesar el Unpermaban.');
        }
    },
};
