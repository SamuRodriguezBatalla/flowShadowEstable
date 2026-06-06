const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { loadTribes } = require('../utils/dataManager');
const { logToTribe } = require('../utils/tribeLog');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('🔊 Quita el aislamiento (Unmute) a un usuario o tribu.')
        .addUserOption(o => o.setName('usuario').setDescription('Usuario a desmutear'))
        .addRoleOption(o => o.setName('rol_tribu').setDescription('Rol de la tribu'))
        .addStringOption(o => o.setName('nombre_tribu').setDescription('Nombre manual de tribu').setAutocomplete(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const tribes = loadTribes(interaction.guild.id);
        const choices = Object.keys(tribes);
        const filtered = choices.filter(choice => choice.toLowerCase().includes(focusedValue.toLowerCase()));
        await interaction.respond(filtered.slice(0, 25).map(choice => ({ name: choice, value: choice })));
    },

    async execute(interaction) {
        const user = interaction.options.getUser('usuario');
        const role = interaction.options.getRole('rol_tribu');
        const str = interaction.options.getString('nombre_tribu');
        const guild = interaction.guild;

        if ([user, role, str].filter(i => i !== null).length !== 1) {
            return interaction.reply({ content: '❌ Elige solo UNO: usuario, rol o nombre de tribu.', ephemeral: true });
        }

        await interaction.deferReply();

        const tribes = loadTribes(guild.id);
        let successCount = 0;
        let targetTribeData = null;
        let targetTribeName = null;

        // --- CASO 1: USUARIO ---
        if (user) {
            try {
                const member = await guild.members.fetch(user.id);
                
                // Quitar Timeout (Ponerlo a null)
                await member.timeout(null, `Unmute por ${interaction.user.tag}`);
                
                // Buscar tribu para avisar
                for (const tName in tribes) {
                    if (tribes[tName].members.some(m => m.discordId === user.id)) {
                        targetTribeData = tribes[tName];
                        targetTribeName = tName;
                        break;
                    }
                }

                if (targetTribeData) {
                    await logToTribe(guild, targetTribeData, '🔊 Sanción Retirada', 
                        `👤 **${user.username}** ya puede hablar de nuevo.`, 
                        '#00FF00' // Verde
                    );
                }

                return interaction.editReply(`✅ **${user.tag}** ha sido desmuteado.`);

            } catch (e) {
                return interaction.editReply(`❌ No se pudo desmutear a ${user.tag}.`);
            }
        }

        // --- CASO 2: TRIBU ---
        else {
            targetTribeName = role ? role.name : str;
            targetTribeData = tribes[targetTribeName];

            if (!targetTribeData) {
                return interaction.editReply(`❌ La tribu **${targetTribeName}** no existe.`);
            }

            await interaction.editReply(`⏳ Retirando silencio a **${targetTribeName}**...`);

            for (const memberData of targetTribeData.members) {
                try {
                    const member = await guild.members.fetch(memberData.discordId).catch(() => null);
                    if (member && member.isCommunicationDisabled()) {
                        await member.timeout(null, `Unmute Grupal por ${interaction.user.tag}`);
                        successCount++;
                    }
                } catch (e) {}
            }

            // Aviso al canal
            await logToTribe(guild, targetTribeData, '🔊 Tribu Desmuteada', 
                `✅ El silencio grupal ha sido levantado. Ya podéis hablar.`, 
                '#00FF00'
            );

            return interaction.editReply(`✅ Se ha retirado el mute a **${successCount}** miembros de **${targetTribeName}**.`);
        }
    },
};
