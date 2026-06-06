const { Rcon } = require('rcon-client');
const { getArkServers } = require('./dataManager');

async function sendRconCommand(guildId, command, specificServerName = null) {
    const servers = getArkServers(guildId); 
    
    if (!servers || servers.length === 0) {
        return { success: false, message: '❌ No hay servidores Ark configurados. Usa `/setupark`.' };
    }

    const targets = specificServerName 
        ? servers.filter(s => s.name === specificServerName) 
        : servers;

    if (targets.length === 0) return { success: false, message: '❌ Servidor no encontrado.' };

    // OPTIMIZACIÓN: Promise.allSettled
    const promises = targets.map(async (server) => {
        try {
            const rcon = new Rcon({
                host: server.ip,
                port: server.port,
                password: server.password,
                timeout: 3000 // Timeout corto para no congelar el bot
            });

            await rcon.connect();
            const response = await rcon.send(command);
            await rcon.end();

            return { server: server.name, success: true, response: response };
        } catch (error) {
            console.error(`Error RCON [${server.name}]:`, error.message);
            return { server: server.name, success: false, message: error.message };
        }
    });

    const resultsRaw = await Promise.allSettled(promises);
    const results = resultsRaw.map(r => r.value); 

    const successCount = results.filter(r => r.success).length;
    const totalResponse = results.map(r => `**${r.server}:** ${r.success ? (r.response || '✅') : `❌ (${r.message})`}`).join('\n');

    return { 
        success: successCount > 0, 
        message: totalResponse,
        rawResults: results 
    };
}

module.exports = { sendRconCommand };