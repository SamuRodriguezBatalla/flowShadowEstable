const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { iniciarRegistro } = require('../events/guildMemberAdd'); 

async function sincronizarRegistros(guild, config) {
    const unverifiedRole = guild.roles.cache.get(config.roles.unverified);
    
    if (!unverifiedRole) return;

    // 1. CARGA DE MIEMBROS ROBUSTA (Corregido el Timeout)
    let members = guild.members.cache; // Usar caché como respaldo
    try {
        // Intentamos un fetch completo con timeout de 30s. Si falla, pasamos al catch.
        members = await guild.members.fetch({ time: 30000, force: true });
        console.log(`✅ [Sync] Miembros obtenidos por fetch: ${members.size}`);
    } catch (e) {
        if (e.code === 'GuildMembersTimeout') {
            console.warn(`⚠️ [Sync] GuildMembersTimeout (Error 400). Usando ${members.size} miembros de caché.`);
        } else {
            console.error(`❌ [Sync] Error inesperado al obtener miembros: ${e.message}`);
            return; 
        }
    }
    
    // 2. Carga de canales (SOLUCIÓN AL FALLO DE 'undefined')
    const [channelsCollection] = await Promise.all([
        // El resultado de guild.channels.fetch() es el primer elemento (índice 0)
        guild.channels.fetch(),
        Promise.resolve() // Placeholder para Promise.all
    ]);
    const channels = channelsCollection; // Asignamos la colección de canales a la variable 'channels'

    // 3. FILTRADO DE OBJETIVOS
    const targets = members.filter(m => m.roles.cache.has(unverifiedRole.id) && !m.user.bot);
    
    if (targets.size === 0) return;

    // Ahora 'channels' es una Collection y podemos usar .filter()
    const textChannels = channels.filter(c => c.type === ChannelType.GuildText);
    let channelsCreated = 0;
    
    console.log(`⚡ [Sync] Procesando ${targets.size} usuarios (Modo Turbo)...`);

    // 4. Procesamiento en Lotes
    const targetArray = [...targets.values()];
    const BATCH_SIZE = 5; 

    for (let i = 0; i < targetArray.length; i += BATCH_SIZE) {
        const batch = targetArray.slice(i, i + BATCH_SIZE);
        
        await Promise.all(batch.map(async (member) => {
            const suffix = member.id.slice(-4);

            const hasChannel = textChannels.some(c => {
                if (c.topic && c.topic.includes(member.id)) return true;
                if (c.name.includes('registro') && c.name.includes(suffix)) return true;
                return false;
            });

            if (!hasChannel) {
                console.log(`✨ [Sync] Creando canal para ${member.user.tag}`);
                try {
                    await iniciarRegistro(member);
                    channelsCreated++;
                } catch (e) {
                    console.error(`❌ Error canal ${member.user.tag}: ${e.message}`);
                }
            }
        }));

        if (i + BATCH_SIZE < targetArray.length) {
            await new Promise(r => setTimeout(r, 500));
        }
    }

    if (channelsCreated > 0) console.log(`✅ [Sync] ${channelsCreated} canales creados.`);
}

module.exports = { sincronizarRegistros };