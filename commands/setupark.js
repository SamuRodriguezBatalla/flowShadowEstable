const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { addArkServer, getArkServers, removeArkServer } = require('../utils/dataManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setupark')
        .setDescription('💻 (SOLO PC) Vincula servidor mediante IP/Puerto RCON.') // <--- CAMBIO AQUÍ        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(s => s.setName('add').setDescription('Añadir un mapa al cluster.')
            .addStringOption(o => o.setName('nombre').setDescription('Nombre (Ej: Island)').setRequired(true))
            .addStringOption(o => o.setName('ip').setDescription('IP').setRequired(true))
            .addIntegerOption(o => o.setName('puerto').setDescription('Puerto RCON').setRequired(true))
            .addStringOption(o => o.setName('password').setDescription('Admin Password').setRequired(true)))
        .addSubcommand(s => s.setName('list').setDescription('Ver mapas conectados.'))
        .addSubcommand(s => s.setName('remove').setDescription('Eliminar un mapa.')
            .addStringOption(o => o.setName('nombre').setDescription('Nombre del mapa').setRequired(true).setAutocomplete(true))),

    async autocomplete(interaction) {
        const servers = getArkServers(interaction.guild.id);
        const focused = interaction.options.getFocused();
        await interaction.respond(servers.filter(s => s.name.toLowerCase().includes(focused.toLowerCase())).map(s => ({ name: s.name, value: s.name })));
    },

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true }); // Proteger pass
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === 'add') {
            const name = interaction.options.getString('nombre');
            const ip = interaction.options.getString('ip');
            const port = interaction.options.getInteger('puerto');
            const pass = interaction.options.getString('password');

            addArkServer(guildId, name, ip, port, pass);
            return interaction.editReply(`✅ Servidor **${name}** añadido al cluster.\n📡 Conexión: \`${ip}:${port}\``);
        }

        if (sub === 'list') {
            const servers = getArkServers(guildId);
            if (servers.length === 0) return interaction.editReply('❌ No hay servidores configurados.');
            
            const embed = new EmbedBuilder().setTitle('🦖 Cluster Configurado').setColor('Green');
            servers.forEach(s => embed.addFields({ name: s.name, value: `\`${s.ip}:${s.port}\``, inline: true }));
            return interaction.editReply({ embeds: [embed] });
        }

        if (sub === 'remove') {
            const name = interaction.options.getString('nombre');
            removeArkServer(guildId, name);
            return interaction.editReply(`🗑️ Servidor **${name}** eliminado del bot.`);
        }
    }
};
