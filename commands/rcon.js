const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendGlobalCommand } = require('../utils/serverManager'); //

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rcon')
        .setDescription('💻 Ejecuta un comando en el servidor (Compatible PC/Consola).')
        .addStringOption(o => o.setName('comando').setDescription('El comando a ejecutar (Ej: SaveWorld, DoExit)').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();
        const command = interaction.options.getString('comando');

        // Enviar a todos los servidores (Híbrido)
        const result = await sendGlobalCommand(interaction.guild.id, command);

        const embed = new EmbedBuilder()
            .setTitle('💻 Consola Remota')
            .setColor(result.success ? 'Green' : 'Orange')
            .addFields(
                { name: '📥 Entrada', value: `\`${command}\`` },
                { name: '📤 Salida Global', value: result.message.substring(0, 1024) }
            )
            .setFooter({ text: 'Nota: En consolas (Nitrado) la respuesta puede ser solo de confirmación.' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};