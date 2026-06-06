const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { removeGameBan, getGameBans } = require('../utils/dataManager');
const { sendGlobalCommand } = require('../utils/serverManager'); //

module.exports = {
    data: new SlashCommandBuilder()
        .setName('arkunban')
        .setDescription('🦖 Quita un baneo del servidor de Ark (PC y Consola).')
        .addStringOption(o => o.setName('id_ark').setDescription('ID del juego a desbanear').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        await interaction.deferReply();
        const arkId = interaction.options.getString('id_ark');
        const guildId = interaction.guild.id;

        // 1. Ejecutar Unban en TODOS los servidores (Cluster Híbrido)
        const result = await sendGlobalCommand(guildId, `UnbanPlayer "${arkId}"`);

        // 2. Buscar si teníamos registrado ese ban para avisar al usuario
        const bans = getGameBans(guildId);
        const banInfo = bans.find(b => b.ark_id === arkId);
        
        // 3. Eliminar de la base de datos si al menos un server respondió bien
        if (result.success) {
            removeGameBan(guildId, arkId);
        }

        // 4. Notificaciones
        let notifStatus = '';
        if (banInfo && banInfo.discord_id && result.success) {
            try {
                const user = await interaction.client.users.fetch(banInfo.discord_id);
                await user.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('🦖 Baneo de Ark Revocado')
                        .setColor('Green')
                        .setDescription(`Un administrador ha levantado tu baneo en el servidor de Ark de **${interaction.guild.name}**.`)
                        .setTimestamp()]
                });
                notifStatus = ' (Usuario notificado)';
            } catch (e) {}
        }

        const embed = new EmbedBuilder()
            .setTitle('🦖 Jugador Desbaneado en Ark')
            .setColor(result.success ? 'Green' : 'Red')
            .setDescription(`Gestión del ID \`${arkId}\` finalizada.${notifStatus}`)
            .addFields({ name: '🤖 Informe Servidores', value: result.message.substring(0, 1024) });

        await interaction.editReply({ embeds: [embed] });
    },
};