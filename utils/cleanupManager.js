const { EmbedBuilder } = require('discord.js');
const { loadGuildConfig, deleteRegistrationState } = require('./dataManager');
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'database.sqlite');
const db = new Database(dbPath);

// Configuración: Tiempo máximo de inactividad (ej: 30 minutos)
const MAX_INACTIVITY_MS = 30 * 60 * 1000; 

async function checkInactiveRegistrations(client) {
    // Buscar registros que lleven mucho tiempo sin actualizarse
    // (timestamp se actualiza cada vez que el usuario avanza un paso)
    const cutoffTime = Date.now() - MAX_INACTIVITY_MS;
    const oldRegistrations = db.prepare('SELECT * FROM pending_registrations WHERE timestamp < ?').all(cutoffTime);

    for (const reg of oldRegistrations) {
        try {
            const channel = await client.channels.fetch(reg.channel_id).catch(() => null);
            
            if (channel) {
                const guild = channel.guild;
                const member = await guild.members.fetch(reg.user_id).catch(() => null);
                const config = loadGuildConfig(guild.id);

                // Notificar al usuario (MD)
                if (member) {
                    try {
                        await member.send(`⚠️ **Registro Cerrado por Inactividad**\nTu canal de registro en **${guild.name}** se ha cerrado porque pasaron 30 minutos sin actividad.\n\n💡 **Para abrirlo de nuevo:** Simplemente escribe cualquier cosa en un canal de texto del servidor.`);
                    } catch (e) {
                        // Si tiene MD bloqueados, intentamos loguear en canal de errores
                        if (config && config.channels.error_log) {
                            const errChan = guild.channels.cache.get(config.channels.error_log);
                            if (errChan) await errChan.send(`⚠️ Usuario <@${reg.user_id}> cerrado por inactividad (MD bloqueados).`);
                        }
                    }
                }

                // Borrar canal
                await channel.delete('Limpieza por inactividad');
            }

            // Borrar de DB
            deleteRegistrationState(reg.channel_id);

        } catch (error) {
            console.error(`Error limpiando registro ${reg.channel_id}:`, error);
        }
    }
}

function startCleanupTask(client) {
    // Ejecutar cada 5 minutos
    setInterval(() => checkInactiveRegistrations(client), 5 * 60 * 1000);
    console.log("🧹 Sistema de limpieza de registros iniciado.");
}

module.exports = { startCleanupTask };