const { Events, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { loadTribes, saveTribes, loadGuildConfig, getAllPremiumGuilds, updateLastAlert, getGameBans, removeGameBan, getRegistrationState } = require('../utils/dataManager');
const { updateLog } = require('../utils/logger');
const { sendGlobalCommand } = require('../utils/serverManager'); 
const { updateStatusPanels } = require('../utils/statusUpdater');
// 👇 NUEVA IMPORTACIÓN PARA EL LOG DE RCON
const { checkServerLogs } = require('../utils/serverLogWatcher');

const MAINTENANCE_INTERVAL = 5 * 60 * 1000; // 5 Minutos
const MAX_REGISTRATION_AGE = 60 * 60 * 1000; // 1 Hora

let isSyncing = false;

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`✅ Bot Online: ${client.user.tag} - Sistema Híbrido V17.`);
        
        // Ejecución inicial al encender
        runMaintenance(client);
        
        // Bucle infinito (cada 5 minutos)
        setInterval(() => runMaintenance(client), MAINTENANCE_INTERVAL);
    },
};

async function runMaintenance(client) {
    if (isSyncing) return;
    isSyncing = true;

    // Iterar sobre todos los servidores donde está el bot
    for (const guild of client.guilds.cache.values()) {
        try {
            const config = loadGuildConfig(guild.id);
            if (!config) continue;

            // A) AUTO-ROL (Asignar rol a quienes no lo tengan)
            await autoAssignRoles(guild, config);

            // B) MANTENIMIENTO TRIBUS (Avisos y borrado por inactividad)
            await checkTribes(guild, config, client);

            // C) LIMPIEZA DE REGISTROS (Canales abandonados)
            await checkRegistrationTimeouts(guild, config);

            // D) BANEOS TEMPORALES ARK (Desbaneo automático)
            await checkGameBans(guild);

            // F) LOG DE MANTENIMIENTO (Consola)
            console.log(`📡 [${guild.name}] Mantenimiento completado.`);

        } catch (e) {
            console.error(`Error mantenimiento en ${guild.name}:`, e.message);
        }
    }
    
    // G) ACTUALIZAR PANELES DE ESTADO (Global)
    await updateStatusPanels(client);
    
    // H) SISTEMA DE PAGOS (Licencias)
    await checkPayments(client);

    // ==================================================================
    // 🔥 I) NUEVO: REVISIÓN DE LOGS DEL SERVIDOR (RCON)
    // ==================================================================
    // Busca comandos admin ejecutados dentro del juego y los envía a Discord
    await checkServerLogs(client);
    
    isSyncing = false;
}

// --- 1. AUTO-ASSIGN ROLES ---
async function autoAssignRoles(guild, config) {
    const unverifiedRole = guild.roles.cache.get(config.roles.unverified);
    if (!unverifiedRole) return;

    try {
        let members = guild.members.cache;
        try { members = await guild.members.fetch({ time: 5000 }); } catch (e) {}

        const targets = members.filter(m => {
            if (m.user.bot) return false;
            if (m.permissions.has(PermissionFlagsBits.Administrator)) return false; 
            
            const hasSys = [config.roles.unverified, config.roles.survivor, config.roles.leader].some(id => m.roles.cache.has(id));
            return !hasSys;
        });

        if (targets.size > 0) {
            for (const [id, member] of targets) {
                await member.roles.add(unverifiedRole).catch(() => {});
                await new Promise(r => setTimeout(r, 500));
            }
        }
    } catch (e) {}
}

// --- 2. CHECK TRIBES (MANTENIMIENTO BASES) ---
async function checkTribes(guild, config, client) {
    let tribes = loadTribes(guild.id);
    let modified = false;
    const now = Date.now();
    
    const MS_TO_WARN = 6 * 24 * 60 * 60 * 1000; // 6 días
    const MS_TO_DELETE = 7 * 24 * 60 * 60 * 1000; // 7 días
    
    const toDelete = [];
    const logChannel = config.channels.checkin_log ? guild.channels.cache.get(config.channels.checkin_log) : null;

    for (const [tName, tData] of Object.entries(tribes)) {
        const diff = now - (tData.lastActive || 0);
        
        // Aviso a los 6 días
        if (tData.channelId && diff >= MS_TO_WARN && diff < MS_TO_WARN + MAINTENANCE_INTERVAL) {
            const ch = guild.channels.cache.get(tData.channelId);
            if (ch) {
                ch.send({ 
                    content: '@here', 
                    embeds: [new EmbedBuilder()
                        .setTitle('⚠️ AVISO DE INACTIVIDAD')
                        .setDescription('Vuestra base está a punto de ser borrada por inactividad.\nUsad `/tribu checkin` o hablad por aquí antes de 24 horas.')
                        .setColor('Red')
                    ] 
                }).catch(()=>{});
            }
            
            const leader = tData.members.find(m => m.rango === 'Líder');
            if (leader) {
                try {
                    const u = await guild.client.users.fetch(leader.discordId);
                    await u.send(`⚠️ **URGENTE:** Tu tribu **${tName}** en **${guild.name}** va a ser eliminada mañana por inactividad. Entra y haz check-in.`);
                } catch(e){}
            }
        }
        
        // Borrado a los 7 días
        if (diff > MS_TO_DELETE) {
            toDelete.push(tName);
        }
    }

    for (const tName of toDelete) {
        const t = tribes[tName];
        if (t.channelId) guild.channels.cache.get(t.channelId)?.delete('Inactividad tribu').catch(()=>{});
        const role = guild.roles.cache.find(r => r.name === tName);
        if (role) role.delete().catch(()=>{});
        
        if (logChannel) {
            logChannel.send({ 
                embeds: [new EmbedBuilder().setDescription(`💀 **${tName}** eliminada por inactividad (7 días sin check-in).`).setColor('Red')] 
            }).catch(()=>{});
        }
        
        delete tribes[tName];
        modified = true;
    }

    if (modified) { 
        saveTribes(guild.id, tribes); 
        await updateLog(guild, client); 
    }
}

// --- 3. RECOLECTOR DE BASURA (REGISTROS) ---
async function checkRegistrationTimeouts(guild, config) {
    const privateCatId = config.categories.private_registration;
    if (!privateCatId) return;

    const category = guild.channels.cache.get(privateCatId);
    if (!category) return;

    const now = Date.now();
    const regChannels = category.children.cache.filter(c => 
        c.type === ChannelType.GuildText && 
        c.name.includes('registro')
    );

    for (const [id, channel] of regChannels) {
        const state = getRegistrationState(channel.id);
        if (state && state.step === 10) continue; // Si está esperando aceptación, NO borrar

        const lastMessage = channel.lastMessageId 
            ? await channel.messages.fetch(channel.lastMessageId).catch(() => null) 
            : null;
        
        const lastActivity = lastMessage ? lastMessage.createdTimestamp : channel.createdTimestamp;
        
        if (now - lastActivity > MAX_REGISTRATION_AGE) {
            // ... lógica de borrado y aviso ...
            let userId = null;
            if (state) userId = state.user_id;
            else if (channel.topic && channel.topic.includes('USER:')) {
                const match = channel.topic.match(/USER:(\d+)/);
                if (match) userId = match[1];
            }

            if (userId) {
                const member = await guild.members.fetch(userId).catch(() => null);
                if (member) {
                    try {
                        await member.send({
                            embeds: [new EmbedBuilder()
                                .setTitle('⏳ Registro Cancelado')
                                .setColor('Red')
                                .setDescription('Tu canal de registro se ha cerrado automáticamente tras **1 hora** sin actividad.')
                                .setFooter({ text: guild.name })
                            ]
                        });
                    } catch (e) { }
                }
            }
            await channel.delete('Limpieza automática por inactividad').catch(()=>{});
        }
    }
}

// --- 4. CHECK GAME BANS (DESBANEO AUTOMÁTICO) ---
async function checkGameBans(guild) {
    const bans = getGameBans(guild.id);
    const now = Date.now();

    for (const ban of bans) {
        if (ban.ban_type === 'horas' && ban.unban_time > 0 && now >= ban.unban_time) {
            const result = await sendGlobalCommand(guild.id, `UnbanPlayer "${ban.ark_id}"`);
            
            if (result.success) {
                removeGameBan(guild.id, ban.ark_id);
                if (ban.discord_id) {
                    try {
                        const user = await guild.client.users.fetch(ban.discord_id);
                        await user.send('🦖 Tu baneo temporal de Ark ha finalizado.');
                    } catch (e) {}
                }
            }
        }
    }
}

// --- 5. CHECK PAYMENTS ---
async function checkPayments(client) {
    try {
        const alertChannel = client.channels.cache.find(c => c.name === '🔔・alertas-pagos');
        if (!alertChannel) return;
        
        const premiumGuilds = getAllPremiumGuilds();
        const now = Date.now();
        
        for (const pg of premiumGuilds) {
            if (pg.is_unlimited === 1) continue; 
            
            const days = Math.floor((now - pg.added_at) / 86400000);
            if (days > 0 && days % 30 === 0 && (now - pg.last_alert > 86400000)) {
                await alertChannel.send(`💰 **COBRO PENDIENTE:** Cliente ${pg.client_name} - ${days} días.`);
                updateLastAlert(pg.guild_id);
            }
        }
    } catch (e) {}
}