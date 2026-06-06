const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { loadTribes } = require('../utils/dataManager');
const { logToTribe } = require('../utils/tribeLog');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('🔇 Aisla temporalmente (Timeout) a un usuario o tribu.')
        .addIntegerOption(o => o.setName('horas').setDescription('Duración del muteo en horas').setRequired(true).setMinValue(1).setMaxValue(670)) // Max 28 días aprox
        .addStringOption(o => o.setName('razon').setDescription('Motivo del muteo').setRequired(true))
        .addUserOption(o => o.setName('usuario').setDescription('Usuario a mutear'))
        .addRoleOption(o => o.setName('rol_tribu').setDescription('Rol de la tribu a mutear'))
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
        const hours = interaction.options.getInteger('horas');
        const reason = interaction.options.getString('razon');
        const user = interaction.options.getUser('usuario');
        const role = interaction.options.getRole('rol_tribu');
        const str = interaction.options.getString('nombre_tribu');
        const guild = interaction.guild;

        // Validación: Solo un objetivo
        if ([user, role, str].filter(i => i !== null).length !== 1) {
            return interaction.reply({ content: '❌ Elige solo UNO: usuario, rol o nombre de tribu.', ephemeral: true });
        }

        await interaction.deferReply();

        const durationMs = hours * 60 * 60 * 1000;
        const tribes = loadTribes(guild.id);
        let successCount = 0;
        let failCount = 0;
        let targetTribeData = null;
        let targetTribeName = null;

        // --- CASO 1: USUARIO INDIVIDUAL ---
        if (user) {
            try {
                const member = await guild.members.fetch(user.id);
                
                // Aplicar Timeout
                if (member.isCommunicationDisabled()) {
                    return interaction.editReply(`⚠️ **${user.tag}** ya está muteado.`);
                }
                
                await member.timeout(durationMs, `[MUTE Bot] ${reason}`);
                successCount++;

                // Buscar si tiene tribu para avisar
                for (const tName in tribes) {
                    if (tribes[tName].members.some(m => m.discordId === user.id)) {
                        targetTribeData = tribes[tName];
                        targetTribeName = tName;
                        break;
                    }
                }

                // Avisar a la tribu
                if (targetTribeData) {
                    await logToTribe(guild, targetTribeData, '🔇 Miembro Muteado', 
                        `👤 **${user.username}** ha sido silenciado por **${hours} horas**.\n📝 **Razón:** ${reason}`, 
                        '#808080' // Gris
                    );
                }

                // Avisar al usuario por MD
                await user.send(`🔇 Has sido muteado en **${guild.name}** por ${hours}h.\n**Razón:** ${reason}`).catch(()=>{});

                return interaction.editReply(`✅ **${user.tag}** ha sido muteado por ${hours} horas.`);

            } catch (e) {
                console.error(e);
                return interaction.editReply(`❌ No se pudo mutear a ${user.tag}. (¿Es admin o tiene un rol superior al mío?)`);
            }
        }

        // --- CASO 2: TRIBU COMPLETA ---
        else {
            targetTribeName = role ? role.name : str;
            targetTribeData = tribes[targetTribeName];

            if (!targetTribeData) {
                return interaction.editReply(`❌ La tribu **${targetTribeName}** no está registrada en la base de datos.`);
            }

            await interaction.editReply(`⏳ Procesando muteo masivo para la tribu **${targetTribeName}**...`);

            // Iterar miembros
            for (const memberData of targetTribeData.members) {
                try {
                    const member = await guild.members.fetch(memberData.discordId).catch(() => null);
                    if (member) {
                        // Solo mutear si no lo está ya y si es posible
                        if (!member.isCommunicationDisabled() && member.moderatable) {
                            await member.timeout(durationMs, `[MUTE TRIBU] ${reason}`);
                            successCount++;
                            // MD individual opcional (puede causar rate limit si son muchos, mejor solo aviso grupal)
                        } else {
                            failCount++;
                        }
                    }
                } catch (e) {
                    failCount++;
                }
            }

            // Aviso al canal de la tribu
            await logToTribe(guild, targetTribeData, '🔇 Tribu Silenciada', 
                `🚨 **SANCIÓN GRUPAL**\nTodos los miembros han sido silenciados por **${hours} horas**.\n📝 **Razón:** ${reason}`, 
                '#000000' // Negro
            );

            const embed = new EmbedBuilder()
                .setTitle(`🔇 Muteo Masivo: ${targetTribeName}`)
                .setColor('Grey')
                .setDescription(`Se ha aplicado timeout a la tribu.`)
                .addFields(
                    { name: '✅ Muteados', value: `${successCount}`, inline: true },
                    { name: '⚠️ Fallidos', value: `${failCount} (Admins/Bots/Ya muteados)`, inline: true },
                    { name: '⏱️ Duración', value: `${hours} horas`, inline: true }
                );

            return interaction.editReply({ content: null, embeds: [embed] });
        }
    },
};
