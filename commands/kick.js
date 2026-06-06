const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendGlobalCommand } = require('../utils/serverManager'); // <--- CAMBIO
const { logAdminAction } = require('../utils/adminLogger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('👢 Expulsa a un jugador del servidor (PC/Consola).')
        .addStringOption(o => o.setName('id_ark').setDescription('ID de Ark (SteamID/EOS/PSN)').setRequired(true))
        .addStringOption(o => o.setName('razon').setDescription('Motivo').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(interaction) {
        await interaction.deferReply();
        const arkId = interaction.options.getString('id_ark');
        const reason = interaction.options.getString('razon');

        // Enviamos el kick a TODOS los servidores del cluster porque no sabemos dónde está
        // sendGlobalCommand se encarga de enviarlo por RCON o API según corresponda
        const result = await sendGlobalCommand(interaction.guild.id, `KickPlayer "${arkId}"`);

        // Analizamos el resultado
        // Si al menos un servidor responde con éxito o confirma el comando
        if (result.success) {
            await interaction.editReply(`👢 **Comando de expulsión enviado.**\nID: ${arkId}\nRazón: ${reason}\n\n**Resultados por servidor:**\n${result.message}`);
            await logAdminAction(interaction.guild, interaction.user, 'kick', `ID: ${arkId}\nRazón: ${reason}`);
        } else {
            await interaction.editReply(`❌ **Error General:** ${result.message}`);
        }
    },
};