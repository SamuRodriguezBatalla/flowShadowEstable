const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require('discord.js');
const { applyWarning } = require('../utils/warnings');
const { loadTribes } = require('../utils/dataManager');
const { logToTribe } = require('../utils/tribeLog'); 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Aplica advertencia.')
        .addStringOption(o => o.setName('tipo').setDescription('Tipo').setRequired(true)
            .addChoices({ name: 'Leve (+1)', value: 'leve' }, { name: 'Media (+2)', value: 'media' }, { name: 'Grave (+4)', value: 'grave' }))
        .addUserOption(o => o.setName('usuario').setDescription('Usuario'))
        .addRoleOption(o => o.setName('rol_tribu').setDescription('Rol de Tribu'))
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

        if ([user, role, str].filter(i => i !== null).length !== 1) {
            return interaction.reply({ content: '❌ Elige solo UNO: usuario, rol o nombre.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        let result;
        let targetType = '';
        let targetName = '';
        
        if (user) {
            targetType = 'member';
            targetName = user.username;
            result = await applyWarning(guild, 'member', user.id, type);
        } else {
            targetType = 'tribe';
            const tName = role ? role.name : str;
            targetName = tName;
            result = await applyWarning(guild, 'tribe', tName, type);
        }

        if (result.banned) {
            if (targetType === 'member' && user) {
                try {
                    await user.send({
                        embeds: [new EmbedBuilder()
                            .setTitle(`⛔ Has sido BANEADO de ${guild.name}`)
                            .setColor('Red')
                            .setDescription(`Has acumulado demasiadas advertencias.\nQuedas expulsado durante esta temporada.\n\n**Razón:** Límite de Warns alcanzado.`)
                            .setTimestamp()]
                    });
                } catch (e) { }

                try {
                    await guild.members.ban(user.id, { reason: `[SEASON-BAN] Acumulación de Warns` });
                    interaction.followUp(`🚨 **¡EXPULSADO!** El usuario ha sido baneado de la season.`);
                } catch (e) {
                    interaction.followUp(`⚠️ Warns máximos alcanzados, pero **no pude banearlo de Discord**.`);
                }
            } else {
                interaction.followUp(`🚨 **¡TRIBU BANEADA!** La tribu ha superado el límite de warns.`);
            }
        } 
        else if (result.success) {
            const tribes = loadTribes(guild.id);
            let updatedTribeData = null;
            let currentPoints = 0;

            if (targetType === 'member' && user) {
                for (const tName in tribes) {
                    const m = tribes[tName].members.find(mem => mem.discordId === user.id);
                    if (m) { updatedTribeData = tribes[tName]; currentPoints = m.warnings || 0; break; }
                }
            } else {
                updatedTribeData = tribes[targetName];
                currentPoints = updatedTribeData ? (updatedTribeData.warnings || 0) : 0;
            }

            if (updatedTribeData) {
                const desc = targetType === 'member' 
                    ? `👤 **${targetName}** ha recibido una advertencia (**${type.toUpperCase()}**).\n⚠️ **Warns Personales:** ${currentPoints}`
                    : `🛡️ **La Tribu** ha recibido una advertencia (**${type.toUpperCase()}**).\n⚠️ **Warns de Tribu:** ${currentPoints}`;
                
                await logToTribe(guild, updatedTribeData, '⚠️ Advertencia Recibida', desc, '#FFA500');
            }
            interaction.followUp(`✅ Warn aplicado. ${result.message}`);
        } 
        else {
            interaction.followUp(`❌ Error: ${result.message}`);
        }
    },
};
