const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { loadTribes } = require('../utils/dataManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkid')
        .setDescription('🔍 ADMIN: Busca IDs de plataforma duplicadas.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const tribes = loadTribes(interaction.guild.id);
        
        const idMap = new Map();

        for (const tName in tribes) {
            for (const member of tribes[tName].members) {
                const id = member.idPlay;
                if (!idMap.has(id)) idMap.set(id, []);
                idMap.get(id).push({ user: member.username, discordId: member.discordId, tribe: tName });
            }
        }

        const duplicates = [];
        for (const [id, users] of idMap) {
            if (users.length > 1) {
                duplicates.push({ id, users });
            }
        }

        if (duplicates.length === 0) {
            return interaction.editReply('✅ No se encontraron IDs duplicadas en la base de datos.');
        }

        const embed = new EmbedBuilder()
            .setTitle('⚠️ IDs de Plataforma Duplicadas Detectadas')
            .setColor('Orange');

        let desc = '';
        for (const dup of duplicates) {
            desc += `🆔 **${dup.id}**\n`;
            for (const u of dup.users) {
                desc += `└ <@${u.discordId}> (${u.tribe})\n`;
            }
            desc += '\n';
        }

        if (desc.length > 4000) desc = desc.substring(0, 4000) + '... (demasiados resultados)';
        
        embed.setDescription(desc);
        await interaction.editReply({ embeds: [embed] });
    },
};
