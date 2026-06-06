const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { loadTribes, loadGuildConfig } = require('../utils/dataManager'); // <--- NUEVO
const { BAN_THRESHOLD } = require('../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('infoplayer')
        .setDescription('Ficha de superviviente.')
        .addUserOption(o => o.setName('usuario').setDescription('Usuario (vacío = tú)')),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const config = loadGuildConfig(guildId);
        if (!config) return interaction.reply({ content: '❌ Bot no configurado.', flags: MessageFlags.Ephemeral });

        // Permisos: Admin o Rol Superviviente
        const survivorRole = interaction.guild.roles.cache.get(config.roles.survivor);
        const hasPerm = interaction.member.roles.cache.has(config.roles.survivor) || interaction.member.permissions.has('Administrator');

        if (!hasPerm) return interaction.reply({ content: '❌ Necesitas rol Superviviente.', flags: MessageFlags.Ephemeral });

        const target = interaction.options.getUser('usuario') || interaction.user;
        const tribes = loadTribes(guildId);
        
        let memberData = null, tribeName = null, tribeData = null;

        for (const tName in tribes) {
            const m = tribes[tName].members.find(mem => mem.discordId === target.id);
            if (m) { memberData = m; tribeName = tName; tribeData = tribes[tName]; break; }
        }

        if (!memberData) return interaction.reply({ content: `❌ ${target} no está registrado.`, flags: MessageFlags.Ephemeral });

        const pWarns = memberData.warnings || 0;
        const tWarns = tribeData.warnings || 0;
        const total = pWarns + tWarns;
        
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`📂 Ficha: ${memberData.username}`)
            .setThumbnail(target.displayAvatarURL())
            .addFields(
                { name: '🆔 ID Play', value: `\`${memberData.idPlay}\``, inline: true },
                { name: '🛡️ Tribu', value: tribeName, inline: true },
                { name: '📦 Kit', value: memberData.hasKit ? '✅' : '❌', inline: true },
                { name: '⚠️ Warns', value: `P: ${pWarns} | T: ${tWarns}`, inline: true },
                { name: '📉 Total', value: `**${total}** / ${BAN_THRESHOLD}`, inline: true }
            );

        interaction.reply({ embeds: [embed] });
    },
};