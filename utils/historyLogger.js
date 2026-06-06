const { EmbedBuilder } = require('discord.js');
const { loadSeasonHistory } = require('./dataManager'); // <--- Importar del DB Manager

function logHistoricalData(guildId, seasonNumber) {
    // 1. Cargar desde SQLite en lugar de fs
    const tribes = loadSeasonHistory(guildId, seasonNumber);

    if (!tribes) {
        return null;
    }

    const sortedTribes = Object.keys(tribes).sort((a, b) => a.localeCompare(b));
    const ITEMS_PER_PAGE = 25;
    const totalPages = Math.ceil(sortedTribes.length / ITEMS_PER_PAGE) || 1;
    const embeds = [];

    for (let i = 0; i < totalPages; i++) {
        const embed = new EmbedBuilder()
            .setColor('#4B0082')
            .setTitle(`📜 REGISTRO ARCHIVADO (DB) | SEASON ${seasonNumber}`)
            .setDescription('Datos recuperados de la base de datos histórica.')
            .setFooter({ text: `Página ${i + 1} de ${totalPages}` })
            .setTimestamp();

        const start = i * ITEMS_PER_PAGE;
        const currentTribes = sortedTribes.slice(start, start + ITEMS_PER_PAGE);

        for (const tName of currentTribes) {
            const tData = tribes[tName];
            const memberList = tData.members.map(m => {
                const rankIcon = m.rango === 'Líder' ? '👑' : '👤';
                return `> ${rankIcon} **${m.username}** (ID: ${m.idPlay})`;
            }).join('\n');

            embed.addFields({ 
                name: `🛡️ ${tName} (${tData.warnings || 0})`, 
                value: memberList || "> *Sin miembros*", 
                inline: true 
            });
        }
        embeds.push(embed);
    }
    return embeds;
}

module.exports = { logHistoricalData };