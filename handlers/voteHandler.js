const { EmbedBuilder } = require('discord.js');
const { getVote, saveVote } = require('../utils/dataManager');

async function handleVote(interaction) {
    const messageId = interaction.message.id;
    const guildId = interaction.guild.id;
    
    // 1. Cargar voto desde SQLite (Disco)
    let voteData = getVote(messageId);

    // Inicializar si es la primera vez
    if (!voteData) {
        voteData = {
            message_id: messageId,
            guild_id: guildId,
            channel_id: interaction.channel.id,
            yes_count: 0,
            no_count: 0,
            voters: new Set()
        };
    } else {
        // Asegurarse de que voters sea un Set (al venir de JSON es un array)
        if (!(voteData.voters instanceof Set)) {
             voteData.voters = new Set(voteData.voters); 
        }
    }

    // 2. Verificar si ya votó
    if (voteData.voters.has(interaction.user.id)) {
        return interaction.reply({ content: '❌ Ya has votado en esta sugerencia.', ephemeral: true });
    }

    // 3. Contabilizar
    const type = interaction.customId.split('_')[2]; // 'yes' o 'no'
    if (type === 'yes') voteData.yes_count++;
    else voteData.no_count++;
    
    voteData.voters.add(interaction.user.id);

    // 4. Guardar en SQLite
    saveVote(messageId, guildId, voteData.channel_id, voteData.yes_count, voteData.no_count, voteData.voters);

    // 5. Actualizar visualmente el mensaje
    const originalEmbed = interaction.message.embeds[0];
    const embed = EmbedBuilder.from(originalEmbed);
    
    const fields = originalEmbed.fields ? [...originalEmbed.fields] : [];
    const voteFieldIndex = fields.findIndex(f => f.name === '📊 Resultados');
    const voteString = `✅ Sí: ${voteData.yes_count} | ❌ No: ${voteData.no_count}`;

    if (voteFieldIndex !== -1) {
        fields[voteFieldIndex].value = voteString;
    } else {
        fields.push({ name: '📊 Resultados', value: voteString, inline: false });
    }

    embed.setFields(fields);
    await interaction.update({ embeds: [embed] });
}

module.exports = { handleVote };