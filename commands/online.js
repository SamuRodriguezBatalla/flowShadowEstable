const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getGlobalStatus } = require('../utils/serverManager'); //
const { loadTribes } = require('../utils/dataManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('online')
        .setDescription('🦖 Muestra jugadores conectados en todo el cluster (PC y Consola).'),

    async execute(interaction) {
        await interaction.deferReply();
        
        // Usamos la función híbrida
        const serversStatus = await getGlobalStatus(interaction.guild.id);
        const tribes = loadTribes(interaction.guild.id);
        
        const embed = new EmbedBuilder().setTitle('🌍 Estado del Cluster').setColor('Green').setTimestamp();
        
        let totalPlayers = 0;
        let hasServers = false;

        for (const server of serversStatus) {
            hasServers = true;
            let serverContent = "";
            
            if (!server.online) {
                serverContent = "🔴 *Offline / Sin conexión*";
            } else {
                if (server.playerCount === 0) {
                    serverContent = "*Nadie conectado.*";
                } else {
                    totalPlayers += server.playerCount;
                    // Procesar lista de jugadores
                    for (const playerName of server.playerList) {
                        let discordTag = "❓";
                        let tribeTag = "";

                        for (const tName in tribes) {
                            // Búsqueda flexible por nombre o ID
                            const m = tribes[tName].members.find(x => 
                                x.idPlay === playerName || x.username === playerName
                            );
                            if (m) {
                                discordTag = `<@${m.discordId}>`;
                                tribeTag = `[${tName}]`;
                                break;
                            }
                        }
                        serverContent += `👤 **${playerName}** ${tribeTag} ${discordTag}\n`;
                    }
                }
            }
            
            const typeEmoji = server.type === 'RCON' ? '💻' : '🎮';
            embed.addFields({ name: `${typeEmoji} ${server.name}`, value: serverContent.substring(0, 1024), inline: false });
        }

        if (!hasServers) return interaction.editReply("❌ No hay servidores configurados.");

        embed.setDescription(`**Total Online:** ${totalPlayers} supervivientes.`);
        await interaction.editReply({ embeds: [embed] });
    },
};