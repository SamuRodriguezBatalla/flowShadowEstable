const { sendRconCommand } = require('./rconManager');
const { loadGuildConfig, getArkServers } = require('./dataManager');
const { EmbedBuilder } = require('discord.js');

// Almacenamos la última línea leída para no repetir logs
const lastLogCache = new Map(); 

async function checkServerLogs(client) {
    for (const guild of client.guilds.cache.values()) {
        const config = loadGuildConfig(guild.id);
        if (!config || !config.channels.admin_log) continue;

        const logChannel = guild.channels.cache.get(config.channels.admin_log);
        if (!logChannel) continue;

        // Solo funciona para servidores RCON (PC)
        const servers = getArkServers(guild.id);
        
        for (const server of servers) {
            try {
                // Pedimos los últimos logs del juego
                const result = await sendRconCommand(guild.id, 'GetGameLog', server.name);
                
                if (result.success && result.rawResults && result.rawResults[0]) {
                    const fullLog = result.rawResults[0].response;
                    if (!fullLog) continue;

                    const lines = fullLog.split('\n');
                    const cacheKey = `${guild.id}-${server.name}`;
                    const lastKnownLine = lastLogCache.get(cacheKey);

                    let newLines = [];
                    
                    // Lógica simple para detectar líneas nuevas
                    if (!lastKnownLine) {
                        // Primera vez: tomamos solo las últimas 3 para no spamear
                        newLines = lines.slice(-3);
                    } else {
                        // Buscamos desde dónde es nuevo
                        const lastIndex = lines.lastIndexOf(lastKnownLine);
                        if (lastIndex !== -1) {
                            newLines = lines.slice(lastIndex + 1);
                        } else {
                            // Si el log rotó completamente, tomamos todo (o los últimos 5)
                            newLines = lines.slice(-5);
                        }
                    }

                    // Guardamos la última línea para la próxima vez
                    if (lines.length > 0) lastLogCache.set(cacheKey, lines[lines.length - 1]);

                    // FILTRADO: Buscamos solo comandos de Admin
                    // Ark suele loguearlos como "AdminCmd: <comando>"
                    const adminActions = newLines.filter(line => 
                        line.includes('AdminCmd') || 
                        line.includes('SERVER:') || 
                        line.includes('Tribe') // Opcional: logs de tribu
                    );

                    if (adminActions.length > 0) {
                        // Limpieza de formato
                        const cleanActions = adminActions.map(l => l.trim()).join('\n');
                        
                        if (cleanActions.length > 0) {
                            const embed = new EmbedBuilder()
                                .setTitle(`🖥️ Log Servidor: ${server.name}`)
                                .setColor('#2b2d31') // Gris oscuro
                                .setDescription(`\`\`\`log\n${cleanActions.substring(0, 4000)}\n\`\`\``)
                                .setTimestamp();

                            await logChannel.send({ embeds: [embed] });
                        }
                    }
                }
            } catch (e) {
                // Ignoramos errores de conexión para no saturar la consola
                // console.error(`Error log watcher ${server.name}: ${e.message}`);
            }
        }
    }
}

module.exports = { checkServerLogs };