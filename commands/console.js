const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendGlobalCommand, getAllServers } = require('../utils/serverManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('console') // O 'comando'
        .setDescription('Ejecuta comandos en tus servidores (PC/Consola).')
        .addStringOption(o => o.setName('comando').setDescription('Cheat command (ej: SaveWorld)').setRequired(true))
        .addStringOption(o => o.setName('servidor').setDescription('Servidor específico (Opcional)').setAutocomplete(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    // Autocompletado inteligente: Muestra RCON y Nitrado juntos
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const servers = getAllServers(interaction.guild.id);
        
        // Filtramos por lo que escribe el usuario
        const filtered = servers.filter(s => {
            const name = s.name || s.server_name; // RCON usa .name, Nitrado .server_name
            return name.toLowerCase().includes(focusedValue.toLowerCase());
        });

        await interaction.respond(
            filtered.slice(0, 25).map(s => ({ name: s.name || s.server_name, value: s.name || s.server_name }))
        );
    },

    async execute(interaction) {
        await interaction.deferReply();
        const command = interaction.options.getString('comando');
        const target = interaction.options.getString('servidor'); // Si es null, envía a todos

        const result = await sendGlobalCommand(interaction.guild.id, command, target);

        const embed = new EmbedBuilder()
            .setTitle('💻 Consola Remota')
            .setColor(result.message.includes('❌') ? 'Orange' : 'Green')
            .setDescription(`**Comando:** \`${command}\`\n\n${result.message}`)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};
