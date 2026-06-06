const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { loadTribes, saveTribes } = require('../utils/dataManager'); // <--- NUEVO
const { updateLog } = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setid')
        .setDescription('ADMIN: Corrige ID PlayStation.')
        .addUserOption(o => o.setName('usuario').setRequired(true).setDescription('Usuario'))
        .addStringOption(o => o.setName('nuevo_id').setRequired(true).setDescription('Nuevo ID'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const tribes = loadTribes(guildId);
        const user = interaction.options.getUser('usuario');
        const newId = interaction.options.getString('nuevo_id');

        let found = false;
        for (const tName in tribes) {
            const mem = tribes[tName].members.find(m => m.discordId === user.id);
            if (mem) {
                mem.idPlay = newId;
                found = true;
                break;
            }
        }

        if (!found) return interaction.reply({ content: '❌ Usuario no registrado.', flags: MessageFlags.Ephemeral });

        saveTribes(guildId, tribes);
        await updateLog(interaction.guild, interaction.client);
        interaction.reply(`✅ ID de ${user} cambiado a: \`${newId}\``);
    },
};