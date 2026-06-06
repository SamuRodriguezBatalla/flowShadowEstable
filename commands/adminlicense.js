const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { addPremium, removePremium, isPremium, setUnlimited } = require('../utils/dataManager');
require('dotenv').config();

// 🔒 TU ID REAL
const OWNER_ID = process.env.OWNER_ID; 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('adminlicense')
        .setDescription('🔒 ADMIN: Gestionar licencias.')
        .addSubcommand(s => s.setName('add')
            .setDescription('➕ Añadir cliente.')
            .addStringOption(o => o.setName('server_id').setRequired(true).setDescription('ID Servidor'))
            .addStringOption(o => o.setName('cliente').setRequired(true).setDescription('Nombre Cliente')))
        .addSubcommand(s => s.setName('remove').setDescription('❌ Quitar licencia').addStringOption(o => o.setName('server_id').setRequired(true).setDescription('ID Servidor')))
        .addSubcommand(s => s.setName('check').setDescription('🔍 Verificar estado').addStringOption(o => o.setName('server_id').setRequired(true).setDescription('ID Servidor')))
        .addSubcommand(s => s.setName('unlimited').setDescription('♾️ Cambiar a ILIMITADO').addStringOption(o => o.setName('server_id').setRequired(true).setDescription('ID Servidor')))
        .addSubcommand(s => s.setName('monthly').setDescription('📅 Cambiar a MENSUAL').addStringOption(o => o.setName('server_id').setRequired(true).setDescription('ID Servidor')))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: '⛔ Acceso denegado.', ephemeral: true });

        const sub = interaction.options.getSubcommand();
        const targetGuildId = interaction.options.getString('server_id');

        if (sub === 'add') {
            const clientName = interaction.options.getString('cliente');
            addPremium(targetGuildId, clientName);
            return interaction.reply(`✅ **Licencia Activada.**\n👤 Cliente: **${clientName}**\n🆔 ID: \`${targetGuildId}\``);
        }

        if (sub === 'remove') {
            removePremium(targetGuildId);
            return interaction.reply(`💀 Licencia revocada para \`${targetGuildId}\`.`);
        }

        if (sub === 'unlimited') {
            if (!isPremium(targetGuildId)) return interaction.reply('❌ Sin licencia previa.');
            setUnlimited(targetGuildId, true);
            return interaction.reply(`♾️ Modo ILIMITADO activado para \`${targetGuildId}\`.`);
        }

        if (sub === 'monthly') {
            if (!isPremium(targetGuildId)) return interaction.reply('❌ Sin licencia previa.');
            setUnlimited(targetGuildId, false);
            return interaction.reply(`📅 Modo MENSUAL activado para \`${targetGuildId}\`.`);
        }

        if (sub === 'check') {
            const status = isPremium(targetGuildId);
            return interaction.reply(status ? `✅ Licencia ACTIVA.` : `❌ NO tiene licencia.`);
        }
    },
};
