const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendGlobalCommand } = require('../utils/serverManager'); // <--- CAMBIO

module.exports = {
    data: new SlashCommandBuilder()
        .setName('arkbroadcast')
        .setDescription('📢 Envía un mensaje global a TODOS los servidores (PC/Consola).')
        .addStringOption(o => o.setName('mensaje').setDescription('Texto a mostrar en pantalla').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();
        const msg = interaction.options.getString('mensaje');

        // Broadcast funciona igual en RCON y Nitrado API Console
        const result = await sendGlobalCommand(interaction.guild.id, `Broadcast ${msg}`);

        const embed = new EmbedBuilder()
            .setTitle('📢 Broadcast Global Enviado')
            .setColor('Blue')
            .setDescription(`**Mensaje:** "${msg}"\n\n**Informe de entrega:**\n${result.message}`)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};