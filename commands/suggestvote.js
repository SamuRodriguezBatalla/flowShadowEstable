const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { loadGuildConfig } = require('../utils/dataManager');

// Global map para almacenar votos activos: { 'guildId:messageId': { yes: 0, no: 0, voters: Set<userId>, ... } }
// Lo usaremos a través de client.suggestVotes
const activeVotes = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('suggestvote')
        .setDescription('🗳️ Inicia una votación de Sí/No para una sugerencia del servidor.')
        .addStringOption(option => 
            option.setName('sugerencia')
                .setDescription('Texto detallado de la sugerencia a votar.')
                .setRequired(true)),
    
    async execute(interaction) {
        const guildId = interaction.guild.id;
        const config = loadGuildConfig(guildId);
        
        // 1. Permiso: Verificar rol Superviviente
        const survivorRoleId = config?.roles?.survivor;
        if (!survivorRoleId || !interaction.member.roles.cache.has(survivorRoleId)) {
            return interaction.reply({ 
                content: `❌ Solo los **Supervivientes** pueden iniciar votaciones.`, 
                flags: MessageFlags.Ephemeral 
            });
        }

        const suggestion = interaction.options.getString('sugerencia');
        const voteDuration = 1000 * 60 * 60 * 24; // Duración de 24 horas

        await interaction.deferReply();

        // 2. Crear Componentes (Botones)
        const yesButton = new ButtonBuilder()
            .setCustomId('suggest_vote_yes') // ID ÚNICO
            .setLabel('Sí')
            .setStyle(ButtonStyle.Success);
        
        const noButton = new ButtonBuilder()
            .setCustomId('suggest_vote_no') // ID ÚNICO
            .setLabel('No')
            .setStyle(ButtonStyle.Danger);

        const actionRow = new ActionRowBuilder().addComponents(yesButton, noButton);

        // 3. Crear Embed
        const embed = new EmbedBuilder()
            .setTitle('🗳️ Votación de Sugerencia')
            .setDescription(`**Sugerencia:** ${suggestion}\n\n`)
            .addFields(
                { name: '👤 Iniciada por', value: `${interaction.user.tag}`, inline: true },
                { name: '⏱️ Finaliza', value: `<t:${Math.floor((Date.now() + voteDuration) / 1000)}:R>`, inline: true },
                { name: '📊 Resultados', value: 'Sí: 0 | No: 0', inline: false }
            )
            .setColor('#3498DB');

        // 4. Enviar Mensaje
        const voteMessage = await interaction.editReply({ 
            embeds: [embed], 
            components: [actionRow],
            fetchReply: true
        });

        // 5. Almacenar Estado del Voto (Usamos el cliente para que sea accesible al handler)
        const voteId = `${guildId}:${voteMessage.id}`;
        
        if (!interaction.client.suggestVotes) {
             interaction.client.suggestVotes = new Map();
        }

        interaction.client.suggestVotes.set(voteId, {
            yes: 0,
            no: 0,
            voters: new Set(),
            suggestion: suggestion,
            timestamp: Date.now()
        });

        // 6. Configurar el temporizador de finalización
        setTimeout(() => {
            handleVoteEnd(voteMessage, voteId);
        }, voteDuration);
    }
};

// Función para finalizar la votación (debe estar fuera de module.exports)
async function handleVoteEnd(message, voteId) {
    // Usamos el cliente para acceder a la data global
    const data = message.client.suggestVotes?.get(voteId);
    if (!data) return;

    message.client.suggestVotes.delete(voteId); // Eliminar de la memoria

    const totalVotes = data.yes + data.no;
    const resultColor = data.yes > data.no ? '#2ECC71' : (data.no > data.yes ? '#E74C3C' : '#F1C40F');
    const resultText = data.yes > data.no ? '✅ APROBADA' : (data.no > data.yes ? '❌ RECHAZADA' : '⚖️ EMPATE');

    const updatedEmbed = EmbedBuilder.from(message.embeds[0])
        .setTitle(`🛑 VOTACIÓN FINALIZADA: ${resultText}`)
        .setColor(resultColor)
        .setFields(
            { name: 'Resultado Final', value: `Sí: **${data.yes}** (${((data.yes / totalVotes) * 100).toFixed(1) || 0}%) \nNo: **${data.no}** (${((data.no / totalVotes) * 100).toFixed(1) || 0}%)`, inline: false },
            { name: 'Participación', value: `${totalVotes} votos registrados`, inline: true }
        )
        .setFooter({ text: 'Votación expirada' })
        .setTimestamp();

    await message.edit({ embeds: [updatedEmbed], components: [] }).catch(console.error);
}