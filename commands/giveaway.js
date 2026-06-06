const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('🎉 Inicia un sorteo rápido.')
        .addStringOption(o => o.setName('premio').setRequired(true).setDescription('Qué se sortea'))
        .addIntegerOption(o => o.setName('minutos').setRequired(true).setDescription('Duración en minutos'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const prize = interaction.options.getString('premio');
        const duration = interaction.options.getInteger('minutos');
        const endTime = Date.now() + (duration * 60 * 1000);

        const embed = new EmbedBuilder()
            .setTitle('🎉 ¡SORTEO!')
            .setDescription(`**Premio:** ${prize}\n\nReacciona con 🎉 para participar.\n\n⏱️ **Termina:** <t:${Math.floor(endTime / 1000)}:R>`)
            .setColor('Gold');

        const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
        await msg.react('🎉');

        // Temporizador
        setTimeout(async () => {
            try {
                const fetchedMsg = await interaction.channel.messages.fetch(msg.id);
                const reactions = fetchedMsg.reactions.cache.get('🎉');
                const users = await reactions.users.fetch();
                const validUsers = users.filter(u => !u.bot);

                if (validUsers.size === 0) {
                    return interaction.followUp('😢 Nadie participó en el sorteo.');
                }

                const winner = validUsers.random();
                
                const winEmbed = new EmbedBuilder()
                    .setTitle('🎉 ¡TENEMOS GANADOR!')
                    .setDescription(`Enhorabuena ${winner}, has ganado **${prize}**!`)
                    .setColor('Green');
                
                await interaction.followUp({ content: `${winner}`, embeds: [winEmbed] });

            } catch (e) { console.error("Error sorteo:", e); }
        }, duration * 60 * 1000);
    },
};
