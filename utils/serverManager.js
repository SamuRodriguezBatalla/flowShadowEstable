const { getArkServers, getNitradoServers } = require('./dataManager');
const { sendRconCommand } = require('./rconManager');
const { sendNitradoCommand, getNitradoPlayers } = require('./nitradoManager');

/**
 * Obtiene una lista unificada de TODOS los servidores (RCON + Nitrado)
 */
function getAllServers(guildId) {
    const rconServers = getArkServers(guildId).map(s => ({ ...s, type: 'RCON' }));
    const nitradoServers = getNitradoServers(guildId).map(s => ({ ...s, type: 'NITRADO' }));
    return [...rconServers, ...nitradoServers];
}

/**
 * Envía un comando al servidor elegido (o a todos si targetName es null)
 */
async function sendGlobalCommand(guildId, command, targetName = null) {
    const allServers = getAllServers(guildId);
    if (allServers.length === 0) return { success: false, message: 'No hay servidores configurados.' };

    const targets = targetName 
        ? allServers.filter(s => (s.server_name === targetName || s.name === targetName))
        : allServers;

    if (targets.length === 0) return { success: false, message: `Servidor "${targetName}" no encontrado.` };

    const results = [];

    await Promise.all(targets.map(async (server) => {
        let res;
        try {
            if (server.type === 'RCON') {
                res = await sendRconCommand(guildId, command, server.name); 
                if(res.rawResults && res.rawResults[0]) res = res.rawResults[0];
            } 
            else if (server.type === 'NITRADO') {
                const nitradoRes = await sendNitradoCommand(guildId, command);
                
                // Feedback honesto de la API
                let statusMsg = 'Error API';
                if (nitradoRes.success) {
                    statusMsg = '📨 Enviado a la cola (Sin confirmación visual)'; 
                } else {
                    statusMsg = nitradoRes.message;
                }
                
                res = { 
                    server: server.server_name, 
                    success: nitradoRes.success, 
                    response: statusMsg 
                };
            }
        } catch (e) {
            res = { server: server.name || server.server_name, success: false, message: e.message };
        }
        results.push(res);
    }));

    const output = results.map(r => `**[${r.server || 'Server'}]:** ${r.success ? '✅ ' + (r.response || 'Ok') : '❌ ' + (r.message || 'Error')}`).join('\n');
    
    // MEJORA: Calculamos si hubo éxito global (al menos 1 servidor funcionó)
    const globalSuccess = results.some(r => r.success);

    return { success: globalSuccess, message: output, results: results };
}

/**
 * Obtiene estado y jugadores de TODOS los servidores unificados.
 */
async function getGlobalStatus(guildId) {
    const allServers = getAllServers(guildId);
    const combinedData = [];

    await Promise.all(allServers.map(async (server) => {
        const serverName = server.name || server.server_name;
        let data = {
            name: serverName,
            type: server.type,
            online: false,
            playerCount: 0,
            playerList: [] 
        };

        try {
            if (server.type === 'RCON') {
                const res = await sendRconCommand(guildId, 'ListPlayers', serverName);
                if (res.success && res.rawResults && res.rawResults[0]) {
                    data.online = true;
                    const responseText = res.rawResults[0].response || "";
                    
                    if (responseText.includes("No Players Connected")) {
                        data.playerCount = 0;
                    } else {
                        const lines = responseText.split('\n').filter(l => l.includes(','));
                        data.playerCount = lines.length;
                        data.playerList = lines.map(line => {
                            const parts = line.split(',');
                            return parts[0].split('.')[1]?.trim() || parts[0].trim();
                        });
                    }
                }
            } 
            else if (server.type === 'NITRADO') {
                const res = await getNitradoPlayers(guildId);
                if (res.success) {
                    data.online = res.status === 'started';
                    data.playerCount = res.players || 0; 
                    if (res.playerList && Array.isArray(res.playerList)) {
                        data.playerList = res.playerList.map(p => p.name);
                    }
                }
            }
        } catch (e) {
            console.error(`Error status ${serverName}:`, e.message);
        }
        
        combinedData.push(data);
    }));

    return combinedData;
}

module.exports = { getAllServers, sendGlobalCommand, getGlobalStatus };