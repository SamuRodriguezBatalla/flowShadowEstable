const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// 👇 PON AQUÍ TU INVITACIÓN PERMANENTE DE DISCORD
const SUPPORT_INVITE_LINK = 'https://discord.gg/pBPRS64GKq';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('soporte')
        .setDescription('🔗 Obtiene el enlace al servidor de soporte oficial del bot FlowShadow (Solo Admins).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🛠️ Soporte Oficial BotArk')
            .setDescription('¿Tienes problemas con el bot o dudas sobre la configuración?\nÚnete a nuestro servidor oficial para recibir ayuda directa del desarrollador.')
            .setColor('#0099ff')
            .setThumbnail(interaction.client.user.displayAvatarURL());

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Entrar al Soporte')
                .setStyle(ButtonStyle.Link)
                .setURL(SUPPORT_INVITE_LINK)
        );

        await interaction.reply({ 
            embeds: [embed], 
            components: [row],
            ephemeral: true // Solo lo ve el admin que ejecutó el comando
        });
    },
};