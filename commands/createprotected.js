const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { loadGuildConfig, saveGuildConfig } = require('../utils/dataManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('createprotected')
        .setDescription('🔒 Crea un rol protegido del wipe (Solo Admins).')
        .addUserOption(o => o.setName('usuario').setRequired(true).setDescription('Usuario al que asignar el rol'))
        .addStringOption(o => o.setName('nombre_rol').setRequired(true).setDescription('Nombre del rol'))
        .addStringOption(o => o.setName('color').setDescription('Color (Hex) o nombre en inglés'))
        // 👇 ESTA LÍNEA ES LA QUE FALTABA
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const guild = interaction.guild;
        const config = loadGuildConfig(guild.id);
        if (!config) return interaction.reply({ content: '❌ Usa /setup primero.', flags: MessageFlags.Ephemeral });

        const member = interaction.options.getMember('usuario');
        const name = interaction.options.getString('nombre_rol');
        const color = interaction.options.getString('color') || 'Gold';

        await interaction.deferReply();
        try {
            // Crear el rol
            const role = await guild.roles.create({ name, color, reason: 'Rol Protegido creado por Admin' });
            
            // Asignarlo al usuario
            await member.roles.add(role);

            // Guardar en la lista de roles protegidos de la config
            if (!config.roles.protected) config.roles.protected = [];
            
            if (!config.roles.protected.includes(role.id)) {
                config.roles.protected.push(role.id);
                saveGuildConfig(guild.id, config);
            }

            interaction.editReply(`✅ Rol protegido **${name}** creado y asignado a ${member}. (No se borrará con Wipes).`);
        } catch (e) {
            interaction.editReply(`❌ Error: ${e.message}`);
        }
    }
};
