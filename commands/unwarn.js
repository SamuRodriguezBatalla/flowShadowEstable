const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { removeWarning } = require('../utils/warnings');
const { loadTribes } = require('../utils/dataManager');
const { logToTribe } = require('../utils/tribeLog'); 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unwarn')
        .setDescription('Remueve advertencia.')
        .addStringOption(o => o.setName('tipo').setDescription('Tipo').setRequired(true)
            .addChoices({ name: 'Leve (-1)', value: 'leve' }, { name: 'Media (-2)', value: 'media' }, { name: 'Grave (-4)', value: 'grave' }))
        .addUserOption(o => o.setName('usuario').setDescription('Usuario'))
        .addRoleOption(o => o.setName('rol_tribu').setDescription('Rol Tribu'))
        .addStringOption(o => o.setName('nombre_tribu').setDescription('Nombre manual').setAutocomplete(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const tribes = loadTribes(interaction.guild.id);
        const choices = Object.keys(tribes);
        const filtered = choices.filter(choice => choice.toLowerCase().includes(focusedValue.toLowerCase()));
        await interaction.respond(filtered.slice(0, 25).map(choice => ({ name: choice, value: choice })));
    },

    async execute(interaction) {
        const type = interaction.options.getString('tipo');
        const user = interaction.options.getUser('usuario');
        const role = interaction.options.getRole('rol_tribu');
        const str = interaction.options.getString('nombre_tribu');
        const guild = interaction.guild;

        if ([user, role, str].filter(i => i !== null).length !== 1) return interaction.reply({ content: '❌ Elige solo uno.', flags: MessageFlags.Ephemeral });

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        let result;
        let targetType = '';
        let targetName = '';

        if (user) {
            targetType = 'member';
            targetName = user.username;
            result = await removeWarning(guild, 'member', user.id, type);
        } else {
            targetType = 'tribe';
            const tName = role ? role.name : str;
            targetName = tName;
            result = await removeWarning(guild, 'tribe', tName, type);
        }

        if (result.success) {
            const tribes = loadTribes(guild.id);
            let updatedTribeData = null;
            let currentPoints = 0;

            if (targetType === 'member' && user) {
                for (const tName in tribes) {
                    const m = tribes[tName].members.find(mem => mem.discordId === user.id);
                    if (m) { updatedTribeData = tribes[tName]; currentPoints = m.warnings || 0; break; }
                }
            } else {
                const tName = role ? role.name : str;
                updatedTribeData = tribes[tName];
                currentPoints = updatedTribeData ? (updatedTribeData.warnings || 0) : 0;
            }

            if (updatedTribeData) {
                const desc = targetType === 'member' 
                    ? `👤 Se ha retirado una advertencia a **${targetName}** (**${type.toUpperCase()}**).\n💚 **Warns Personales:** ${currentPoints}`
                    : `🛡️ Se ha retirado una advertencia a **La Tribu** (**${type.toUpperCase()}**).\n💚 **Warns de Tribu:** ${currentPoints}`;
                
                await logToTribe(guild, updatedTribeData, '💚 Advertencia Retirada', desc, '#00FF00'); 
            }
            interaction.followUp(`💚 Warn removido. ${result.message}`);
        } else {
            interaction.followUp(`❌ Error: ${result.message}`);
        }
    },
};
