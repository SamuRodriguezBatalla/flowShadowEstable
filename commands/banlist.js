const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getPermabanList, getGameBans } = require('../utils/dataManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('banlist')
        .setDescription('📜 Muestra listas de baneados (Discord y Ark).')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const guildId = interaction.guild.id;

        // 1. BANS DISCORD
        const discordBans = getPermabanList(guildId);
        let discordText = discordBans.length > 0 ? '' : '*Ninguno.*';
        for (const ban of discordBans.slice(0, 10)) {
            let userTag = ban.discord_id;
            try { 
                const u = await interaction.client.users.fetch(ban.discord_id).catch(()=>null);
                if(u) userTag = u.tag;
            } catch(e){}
            discordText += `🔴 **${userTag}** - ${ban.reason}\n`;
        }
        if (discordBans.length > 10) discordText += `... y ${discordBans.length - 10} más.\n`;

        // 2. BANS ARK
        const gameBans = getGameBans(guildId);
        let gameText = gameBans.length > 0 ? '' : '*Ninguno.*';
        for (const ban of gameBans.slice(0, 10)) {
            const typeIcon = ban.ban_type === 'perm' ? '⛔' : (ban.ban_type === 'season' ? '🍂' : '⏱️');
            gameText += `${typeIcon} **ID:** \`${ban.ark_id}\` (<@${ban.discord_id || '?'}>) - ${ban.reason}\n`;
        }
        if (gameBans.length > 10) gameText += `... y ${gameBans.length - 10} más.`;

        const embed = new EmbedBuilder()
            .setTitle('📜 Registro de Sanciones')
            .setColor('DarkRed')
            .addFields(
                { name: `🛡️ Discord Blacklist (${discordBans.length})`, value: discordText },
                { name: `🦖 Ark Game Bans (${gameBans.length})`, value: gameText }
            )
            .setFooter({ text: 'Leyenda Ark: ⛔ Perm | 🍂 Season | ⏱️ Horas' });

        await interaction.editReply({ embeds: [embed] });
    },
};
