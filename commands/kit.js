const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { loadTribes, saveTribes, saveTribe } = require('../utils/dataManager');
const { updateLog } = require('../utils/logger');
const { updateTribePanel } = require('../utils/tribePanel'); // <--- IMPORTANTE

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kit')
        .setDescription('Marca estado del kit.')
        .addUserOption(o => o.setName('usuario').setRequired(true).setDescription('Usuario'))
        .addStringOption(o => o.setName('estado').setRequired(true).setDescription('Estado')
            .addChoices({ name: '✅ Entregado', value: 'true' }, { name: '❌ Pendiente', value: 'false' }))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const tribes = loadTribes(guildId);
        const targetUser = interaction.options.getUser('usuario');
        const isDelivered = interaction.options.getString('estado') === 'true';

        let found = false, tribeFound = null;

        for (const tName in tribes) {
            const idx = tribes[tName].members.findIndex(m => m.discordId === targetUser.id);
            if (idx !== -1) {
                tribes[tName].members[idx].hasKit = isDelivered;
                found = true;
                tribeFound = tName;
                break;
            }
        }

        if (!found) return interaction.reply({ content: `❌ ${targetUser} no tiene tribu.`, flags: MessageFlags.Ephemeral });

        saveTribe(guildId, tribeFound, tribes[tribeFound]);
        
        // ACTUALIZAR PANELES
        await updateLog(interaction.guild, interaction.client); // Log Público
        await updateTribePanel(interaction.guild, tribeFound);  // Panel Privado

        return interaction.reply(`📦 **Kit Actualizado:** ${targetUser} (${tribeFound}) -> ${isDelivered ? '✅ Entregado' : '❌ Pendiente'}`);
    },
};
