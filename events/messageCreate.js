const { Events, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
// AÑADIDO: 'saveTribes' y 'findOpenRegistration' en los imports
const { loadGuildConfig, getRegistrationState, initRegistrationState, loadTribes, saveTribes, findOpenRegistration } = require('../utils/dataManager');

const warningCooldowns = new Set();

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot || !message.guild) return;

        const config = loadGuildConfig(message.guild.id);
        if (!config) return;

        const member = message.member;
        if (!member) return;

        // ==================================================================
        // 🔥 PUNTO 1: INMUNIDAD DE ADMINS
        // ==================================================================
        // Definimos quién es inmune a las restricciones
        const isImmune = 
            member.id === message.guild.ownerId ||
            member.permissions.has(PermissionFlagsBits.Administrator) ||
            (config.roles.admin && member.roles.cache.has(config.roles.admin)) ||
            (config.roles.staff && member.roles.cache.has(config.roles.staff));

        // ==================================================================
        // ⏱️ PUNTO 2: CHECK-IN PASIVO (ACTUALIZAR TRIBU AL HABLAR)
        // ==================================================================
        // Esto se ejecuta para todos (incluso admins) si tienen tribu
        const tribes = loadTribes(message.guild.id);
        let tribeModified = false;
        
        for (const tName in tribes) {
            const tribe = tribes[tName];
            // Buscamos si el autor del mensaje está en esta tribu
            if (tribe.members.some(m => m.discordId === message.author.id)) {
                // Actualizar solo si ha pasado más de 1 hora desde la última vez (para no saturar la base de datos)
                const now = Date.now();
                if (now - (tribe.lastActive || 0) > 3600000) { 
                    tribe.lastActive = now;
                    tribeModified = true;
                    // console.log(`[Actividad] Tribu ${tName} actualizada por mensaje de ${message.author.tag}.`);
                }
                break; 
            }
        }
        if (tribeModified) saveTribes(message.guild.id, tribes);

        // 🛑 SI ES INMUNE, PARAMOS AQUÍ (El bot no le restringirá nada)
        if (isImmune) return;


        // ==================================================================
        // 3. PORTERO / REGISTRO AUTOMÁTICO (Para usuarios normales)
        // ==================================================================
        const unverifiedRole = config.roles.unverified ? message.guild.roles.cache.get(config.roles.unverified) : null;
        const survivorRole = config.roles.survivor ? message.guild.roles.cache.get(config.roles.survivor) : null;

        // Necesita registro si tiene rol 'No Verificado' O si le falta el rol 'Superviviente'
        const needsRegistration = (unverifiedRole && member.roles.cache.has(unverifiedRole.id)) || 
                                  (survivorRole && !member.roles.cache.has(survivorRole.id));

        if (needsRegistration) {
            // Permitir hablar en canales específicos (Bienvenida, Soporte, etc.)
            if (message.channel.id === config.channels.welcome) return;
            if (config.channels.support && message.channel.id === config.channels.support) return;

            // Verificar si el usuario está hablando DENTRO de su propio canal de registro
            const currentState = getRegistrationState(message.channel.id);
            if (currentState && currentState.user_id === message.author.id) {
                // Dejar pasar mensaje (es parte del proceso de registro)
                const { handleRegistrationStep } = require('../utils/registrationHandler');
                await handleRegistrationStep(message, currentState);
                return;
            }

            // --- BLOQUEO Y REDIRECCIÓN ---
            // 1. Borrar mensaje no autorizado
            try { await message.delete(); } catch(e) {}

            // Evitar spam de alertas (1 cada 10 seg)
            if (warningCooldowns.has(message.author.id)) return;
            warningCooldowns.add(message.author.id);
            setTimeout(() => warningCooldowns.delete(message.author.id), 10000);

            // 2. Buscar si ya tiene un canal abierto en otro lado
            const openReg = findOpenRegistration(message.author.id);

            if (openReg) {
                const channel = message.guild.channels.cache.get(openReg.channel_id);
                const msg = await message.channel.send({ 
                    content: `${message.author}, ⛔ **No puedes hablar aquí.**\nTermina tu registro en tu canal privado: ${channel || 'Busca en la lista de canales'}` 
                });
                setTimeout(() => msg.delete().catch(()=>{}), 5000);
            } else {
                // 3. Si no tiene canal, CREAR UNO NUEVO
                const catPrivate = config.categories.private_registration;
                const channelName = `registro-${message.author.username}`.toLowerCase().replace(/[^a-z0-9]/g, '');

                try {
                    const newChannel = await message.guild.channels.create({
                        name: channelName,
                        type: ChannelType.GuildText,
                        parent: catPrivate,
                        permissionOverwrites: [
                            { id: message.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                            { id: message.author.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                            { id: message.client.user.id, allow: [PermissionFlagsBits.ViewChannel] }
                        ]
                    });

                    initRegistrationState(newChannel.id, message.author.id);
                    await newChannel.send(`👋 Hola ${message.author}.\nEste es tu canal privado.\n**Escribe tu ID de Plataforma (Steam/Xbox/PS)** para comenzar el registro.`);
                    
                    const msg = await message.channel.send({ 
                        content: `${message.author}, ⛔ **Debes registrarte para hablar.**\nTe he creado un canal privado: ${newChannel}` 
                    });
                    setTimeout(() => msg.delete().catch(()=>{}), 5000);
                } catch (e) { 
                    console.error("Error creando canal auto-registro:", e); 
                }
            }
        }
    },
};