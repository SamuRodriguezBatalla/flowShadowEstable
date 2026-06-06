const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { loadTribes, saveTribes } = require('../utils/dataManager');
const { updateLog } = require('../utils/logger');
const { updateTribePanel } = require('../utils/tribePanel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('editid')
        .setDescription('✏️ ADMIN: Cambia la ID de Plataforma de un usuario.')
        .addUserOption(o => o.setName('usuario').setRequired(true).setDescription('Usuario a editar'))
        .addStringOption(o => o.setName('nuevo_id').setRequired(true).setDescription('Nueva ID de Plataforma'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const tribes = loadTribes(guildId);
        const user = interaction.options.getUser('usuario');
        const newId = interaction.options.getString('nuevo_id');

        let found = false;
        let tribeName = null;

        for (const tName in tribes) {
            const member = tribes[tName].members.find(m => m.discordId === user.id);
            if (member) {
                member.idPlay = newId;
                tribeName = tName;
                found = true;
                break;
            }
        }

        if (!found) {
            return interaction.reply({ content: '❌ Usuario no encontrado en ninguna tribu.', flags: MessageFlags.Ephemeral });
        }

        saveTribes(guildId, tribes);
        
        await updateLog(interaction.guild, interaction.client);
        await updateTribePanel(interaction.guild, tribeName);

        await interaction.reply(`✅ ID de **${user.username}** actualizada a: \`${newId}\``);
    },
};
