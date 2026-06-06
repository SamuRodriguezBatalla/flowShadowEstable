const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const botVersion = '3.6.0 (Cross-Platform Edition)'; 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botinfo')
        .setDescription('🤖 Muestra la lista de comandos disponibles para usuarios y admins.'),

    async execute(interaction) {
        const sent = await interaction.reply({ content: 'Cargando información...', fetchReply: true });
        const ping = sent.createdTimestamp - interaction.createdTimestamp;

        const embed = new EmbedBuilder()
            .setColor('#00BFFF')
            .setTitle(`🤖 Ayuda de ${interaction.client.user.username}`)
            .setDescription('Sistema de gestión para Ark: Survival Ascended/Evolved.\nSoporta PC (RCON) y Consolas (Nitrado API).')
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .addFields(
                { 
                    name: '💻 Conexión de Servidores (Admins)', 
                    value: 
                    '`/setupark` - Conexión RCON potente (**Solo PC/Steam**).\n' +
                    '`/setupnitrado` - Conexión API (**Para Consolas PS5/Xbox**).\n' +
                    '`/setupstatus` - Crea un panel de estado auto-actualizable.\n' +
                    '`/unlinkark` - Desvincula el servidor actual.'
                },
                {
                    name: '🦖 Gestión de Tribus',
                    value: 
                    '`/tribu` - Menú principal (Info, Check-in, Reclutar, Votar...).\n' +
                    '`/infoplayer` - Ficha personal (ID, Warns, Kit).\n' +
                    '`/kit` - Marcar entrega de starter kits (Admins).\n' +
                    '`/coords` - Guardar coordenadas de bases o farmeo.'
                },
                {
                    name: '⚔️ Diplomacia & Economía',
                    value: 
                    '`/diplomacia` - Gestionar Alianzas y Guerras.\n' +
                    '`/mercado` - Publicar compra/venta de objetos.'
                },
                {
                    name: '🛡️ Moderación',
                    value: 
                    '`/warn` / `/unwarn` - Sistema de advertencias.\n' +
                    '`/permaban` - Ban permanente (Lista Negra).\n' +
                    '`/arkban` - Ban dentro del juego (Requiere RCON/PC).\n' +
                    '`/mute` - Silenciar usuario o tribu entera.'
                },
                {
                    name: '⚙️ Configuración Admin',
                    value: 
                    '`/setup` - Instalación de canales y roles.\n' +
                    '`/adminconfig` - Límites de tribu y alianzas.\n' +
                    '`/newseason` - Reinicio de temporada.\n' +
                    '`/fixroles` - Arreglar permisos de usuarios.'
                }
            )
            .setFooter({ text: `Versión ${botVersion} • FlowShadow` })
            .setTimestamp();

        await interaction.editReply({ content: null, embeds: [embed] });
    },
};