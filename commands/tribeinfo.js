const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { loadTribes } = require('../utils/dataManager'); // <--- NUEVO

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tribeinfo')
        .setDescription('Info pública de una tribu.')
        .addRoleOption(o => o.setName('rol_tribu').setDescription('Rol de la tribu').setRequired(true)),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const tribes = loadTribes(guildId);
        const role = interaction.options.getRole('rol_tribu');
        
        // Búsqueda case-insensitive por nombre de rol
        const tName = Object.keys(tribes).find(k => k.toLowerCase() === role.name.toLowerCase());

        if (!tName) return interaction.reply({ content: `❌ No se encontraron datos para **${role.name}**.`, flags: MessageFlags.Ephemeral });

        const data = tribes[tName];
        const members = data.members.map(m => `${m.rango === 'Líder' ? '👑' : '👤'} ${m.username}`).join('\n');

        interaction.reply(`🛡️ **FICHA PÚBLICA: ${tName.toUpperCase()}**\n\n` +
                          `⚠️ **Puntos:** ${data.warnings || 0}\n` +
                          `📍 **Base:** <#${data.channelId || '?'}>\n\n` +
                          `👥 **Miembros:**\n${members}`);
    },
};