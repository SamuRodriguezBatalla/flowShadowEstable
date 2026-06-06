const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require('discord.js');
const { addPermanentBan } = require('../utils/dataManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('permaban')
        .setDescription('⛔ BAN PERMANENTE: Banea y añade a la Lista Negra (Resiste Wipes).')
        .addStringOption(option => option.setName('razon').setDescription('Motivo del baneo permanente.').setRequired(true))
        .addUserOption(option => option.setName('usuario').setDescription('El usuario a banear (si está en el server).'))
        .addStringOption(option => option.setName('id_usuario').setDescription('ID del usuario (si ya no está en el server).'))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        const reason = interaction.options.getString('razon');
        const user = interaction.options.getUser('usuario');
        const userIdStr = interaction.options.getString('id_usuario');
        const guildId = interaction.guild.id;

        let targetId = user ? user.id : userIdStr;

        if (!targetId) return interaction.reply({ content: '❌ Debes especificar un Usuario o una ID.', flags: MessageFlags.Ephemeral });
        if (targetId === interaction.user.id) return interaction.reply({ content: '❌ No te puedes banear a ti mismo.', flags: MessageFlags.Ephemeral });

        await interaction.deferReply();

        try {
            // 1. Guardar en DB (Persistencia ante Wipes)
            addPermanentBan(guildId, targetId, reason, interaction.user.id);

            let dmStatus = '❌ MD no enviado.';
            
            // 2. Intentar MD ANTES del ban
            try {
                const memberObj = await interaction.guild.members.fetch(targetId).catch(() => null);
                if (memberObj) {
                    await memberObj.send({
                        embeds: [new EmbedBuilder()
                            .setTitle(`⛔ Has sido BANEADO PERMANENTEMENTE de ${interaction.guild.name}`)
                            .setColor('DarkRed')
                            .setDescription(`Has sido expulsado y añadido a la lista negra.\n\n**Razón:** ${reason}\n**Admin:** ${interaction.user.tag}`)
                            .setTimestamp()]
                    });
                    dmStatus = '✅ Usuario avisado por MD.';
                }
            } catch (e) {
                dmStatus = '⚠️ MD cerrado o usuario fuera.';
            }

            // 3. Ejecutar Ban en Discord
            let discordBanStatus = '✅ Expulsado de Discord.';
            try {
                await interaction.guild.members.ban(targetId, { reason: `[PERMABAN] ${reason}` });
            } catch (e) {
                discordBanStatus = '⚠️ No se pudo banear nativamente, pero está en la Lista Negra.';
            }

            const embed = new EmbedBuilder()
                .setTitle('⛔ PERMABAN EJECUTADO')
                .setColor('DarkRed')
                .setDescription(`El usuario <@${targetId}> ha sido fulminado.`)
                .addFields(
                    { name: '📝 Razón', value: reason, inline: true },
                    { name: '📨 Privado', value: dmStatus, inline: true },
                    { name: '🤖 Estado', value: discordBanStatus, inline: false }
                )
                .setFooter({ text: `Admin: ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Error al procesar el Permaban.');
        }
    },
};
