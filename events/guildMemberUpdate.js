const { Events } = require('discord.js');
const { loadGuildConfig, loadTribes, saveTribes } = require('../utils/dataManager');
const { iniciarRegistro } = require('./guildMemberAdd');
const { updateLog } = require('../utils/logger');

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember) {
        if (newMember.user.bot) return;

        const guild = newMember.guild;
        const config = loadGuildConfig(guild.id);
        if (!config) return;

        const unverifiedRole = config.roles.unverified; // ID del rol

        // ==================================================================
        // 1. DETECTOR DE ROL "NO VERIFICADO" (MANUAL O AUTOMÁTICO)
        // ==================================================================
        // Si ANTES no tenía el rol y AHORA SÍ lo tiene...
        if (!oldMember.roles.cache.has(unverifiedRole) && newMember.roles.cache.has(unverifiedRole)) {
            console.log(`👀 [Update] ${newMember.user.tag} recibió el rol 'No Verificado'. Iniciando registro...`);
            try {
                // Forzamos el inicio del registro inmediatamente
                await iniciarRegistro(newMember);
            } catch (e) {
                console.error(`Error en registro manual de ${newMember.user.tag}:`, e);
            }
            return;
        }

        // ==================================================================
        // 2. SINCRONIZACIÓN: SI PIERDE UN ROL DE TRIBU
        // ==================================================================
        // Esto detecta si le quitas un rol de tribu manualmente para borrarlo de la base de datos
        const lostRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));
        
        if (lostRoles.size > 0) {
            let tribes = loadTribes(guild.id);
            let modified = false;

            for (const [id, role] of lostRoles) {
                const tName = role.name;
                if (tribes[tName]) {
                    const idx = tribes[tName].members.findIndex(m => m.discordId === newMember.id);
                    if (idx !== -1) {
                        console.log(`📉 ${newMember.user.tag} perdió el rol de tribu '${tName}'. Actualizando DB...`);
                        tribes[tName].members.splice(idx, 1);
                        modified = true;

                        // Si la tribu se queda vacía, borrar todo
                        if (tribes[tName].members.length === 0) {
                            if (tribes[tName].channelId) {
                                guild.channels.cache.get(tribes[tName].channelId)?.delete().catch(()=>{});
                            }
                            guild.roles.cache.find(r => r.name === tName)?.delete().catch(()=>{});
                            delete tribes[tName];
                        }
                    }
                }
            }
            if (modified) {
                saveTribes(guild.id, tribes);
                updateLog(guild, newMember.client);
            }
        }
    },
};