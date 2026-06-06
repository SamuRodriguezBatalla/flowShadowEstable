const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { addGameBan, loadTribes, addPermanentBan } = require('../utils/dataManager');
const { sendGlobalCommand } = require('../utils/serverManager'); // <--- CAMBIO
const { logToTribe } = require('../utils/tribeLog');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('arkban')
        .setDescription('🦖 Baneo dentro del servidor de Ark (PC/Consola).')
        .addUserOption(o => o.setName('usuario_discord').setDescription('Usuario de Discord').setRequired(true))
        .addStringOption(o => o.setName('id_ark').setDescription('ID del juego').setRequired(true))
        .addStringOption(o => o.setName('tipo').setDescription('Tipo de Baneo').setRequired(true)
            .addChoices(
                { name: '🕒 Por Horas', value: 'horas' },
                { name: '🍂 Por Season', value: 'season' },
                { name: '⛔ Permanente', value: 'perm' }
            ))
        .addStringOption(o => o.setName('razon').setDescription('Motivo').setRequired(true))
        .addIntegerOption(o => o.setName('duracion').setDescription('Horas (Solo si es por horas)'))
        .addBooleanOption(o => o.setName('ban_discord').setDescription('¿Banear de Discord?'))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        await interaction.deferReply();

        const userDiscord = interaction.options.getUser('usuario_discord');
        const arkId = interaction.options.getString('id_ark');
        const type = interaction.options.getString('tipo');
        const reason = interaction.options.getString('razon');
        const hours = interaction.options.getInteger('duracion') || 0;
        const banFromDiscord = interaction.options.getBoolean('ban_discord') || false;
        const guild = interaction.guild;

        if (type === 'horas' && hours <= 0) return interaction.editReply('❌ Duración inválida.');

        // 1. EJECUTAR BAN EN CLUSTER (RCON + NITRADO)
        const result = await sendGlobalCommand(guild.id, `BanPlayer "${arkId}"`);
        
        // 2. GUARDAR EN DB
        addGameBan(guild.id, userDiscord.id, arkId, type, hours, reason, interaction.user.id);

        // 3. NOTIFICACIONES
        const tribes = loadTribes(guild.id);
        let targetTribe = null;
        for (const tName in tribes) {
            if (tribes[tName].members.some(m => m.discordId === userDiscord.id)) {
                targetTribe = tribes[tName]; break;
            }
        }

        const typeText = type === 'horas' ? `${hours} Horas` : (type === 'season' ? 'Esta Season' : 'Permanente');
        const desc = `🚫 **JUGADOR BANEADO DE ARK**\n👤 **Jugador:** ${userDiscord.tag}\n🆔 **ID:** ${arkId}\n⏱️ **Duración:** ${typeText}\n📝 **Razón:** ${reason}`;

        if (targetTribe) await logToTribe(guild, targetTribe, '🦖 Miembro Baneado en Ark', desc, 'Red');
        try { await userDiscord.send({ embeds: [new EmbedBuilder().setTitle('🦖 Baneado de Ark').setColor('Red').setDescription(desc)] }); } catch (e) {}

        // 4. DISCORD BAN
        let discordStatus = 'No aplicado.';
        if (banFromDiscord) {
            try {
                if (type === 'perm') addPermanentBan(guild.id, userDiscord.id, `[Ark Perm] ${reason}`, interaction.user.id);
                await guild.members.ban(userDiscord.id, { reason: `[ARK-BAN] ${reason}` });
                discordStatus = '✅ Baneado de Discord.';
            } catch (e) { discordStatus = '⚠️ Error permisos Discord.'; }
        }

        const embed = new EmbedBuilder()
            .setTitle('🦖 Ark Ban Ejecutado')
            .setColor('DarkRed')
            .addFields(
                { name: 'Target', value: `${userDiscord.tag} (${arkId})`, inline: true },
                { name: 'Tipo', value: typeText, inline: true },
                { name: 'Resultados Servidores', value: result.message.substring(0, 1000) },
                { name: 'Discord', value: discordStatus }
            );

        await interaction.editReply({ embeds: [embed] });
    }
};