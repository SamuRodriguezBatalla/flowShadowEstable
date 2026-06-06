const axios = require('axios');
const { getNitradoConfig } = require('./dataManager');

const NITRADO_API_URL = 'https://api.nitrado.net';

/**
 * Ejecuta un comando o consulta a Nitrado
 * @param {string} guildId - ID del servidor de Discord
 * @param {string} endpoint - Endpoint de la API (ej: '/services/{id}/gameservers')
 * @param {string} method - 'GET' o 'POST'
 * @param {object} data - Datos para POST
 */
async function callNitrado(guildId, endpoint, method = 'GET', data = {}) {
    const config = getNitradoConfig(guildId);
    if (!config) return { success: false, message: '❌ Nitrado no configurado. Usa /setupnitrado.' };

    try {
        // Reemplazar {id} por el ID real del servicio
        const finalUrl = `${NITRADO_API_URL}${endpoint.replace('{id}', config.serviceId)}`;

        const response = await axios({
            method: method,
            url: finalUrl,
            headers: {
                'Authorization': `Bearer ${config.token}`,
                'Content-Type': 'application/json'
            },
            data: data
        });

        return { success: true, data: response.data.data };
    } catch (error) {
        if (error.response && error.response.status === 429) {
            console.warn(`⚠️ Rate Limit Nitrado en ${guildId}. Pausando peticiones...`);
            return { success: false, message: '⏳ **API Saturada (429).** Intenta de nuevo en unos segundos.' };
        }
        console.error('Error Nitrado:', error.response?.data || error.message);
        const errorMsg = error.response?.data?.message || error.message;
        return { success: false, message: `❌ Error API: ${errorMsg}` };
    }
}

async function sendNitradoCommand(guildId, command) {
    // NOTA: La API de Nitrado es limitada para comandos custom en consola.
    // Usualmente permite acciones predefinidas (restart, stop, ban list).
    // Para enviar comandos raw, se usa el endpoint de RCON web si está disponible para el juego.
    
    // Ejemplo para enviar comando POST a la consola virtual (varía según juego ARK:SE vs ASA)
    return await callNitrado(guildId, '/services/{id}/gameservers/games/ark/admin_command', 'POST', { command: command });
}

async function getNitradoPlayers(guildId) {
    const res = await callNitrado(guildId, '/services/{id}/gameservers');
    if (!res.success) return res;
    
    // Nitrado devuelve info de jugadores en la respuesta del gameserver
    const server = res.data.gameserver;
    return {
        success: true,
        status: server.status,
        players: server.query.player_current,
        maxPlayers: server.query.player_max,
        playerList: server.query.players || [] // A veces viene vacío dependiendo de la configuración de privacidad
    };
}

async function restartNitrado(guildId, message) {
    return await callNitrado(guildId, '/services/{id}/gameservers/restart', 'POST', { message: message });
}

module.exports = { callNitrado, sendNitradoCommand, getNitradoPlayers, restartNitrado };