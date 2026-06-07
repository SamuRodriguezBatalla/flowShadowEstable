const { Events, ChannelType, PermissionFlagsBits } = require('discord.js');
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
        const isImmune =
            member.id === message.guild.ownerId ||
            member.permissions.has(PermissionFlagsBits.Administrator) ||
            (config.roles.admin && member.roles.cache.has(config.roles.admin)) ||
            (config.roles.staff && member.roles.cache.has(config.roles.staff));

        // ==================================================================
        // ⏱️ PUNTO 2: CHECK-IN PASIVO (ACTUALIZAR TRIBU AL HABLAR)
        // ==================================================================
        // Solo para miembros con tribu, independientemente de si son verificados o no
        const tribes = loadTribes(message.guild.id);
        let tribeModified = false;

        for (const tName in tribes) {
            const tribe = tribes[tName];
            if (tribe.members.some(m => m.discordId === message.author.id)) {
                const now = Date.now();
                if (now - (tribe.lastActive || 0) > 3600000) {
                    tribe.lastActive = now;
                    tribeModified = true;
                }
                break;
            }
        }
        if (tribeModified) saveTribes(message.guild.id, tribes);

        // Si es admin/staff, no aplicamos ninguna restricción
        if (isImmune) return;

        // ==================================================================
        // 3. GESTIÓN DE CANALES DE REGISTRO PRIVADOS
        // ==================================================================
        // Si el mensaje está en el canal privado de registro del propio usuario,
        // lo procesamos y salimos (esto funciona igual que antes)
        const currentState = getRegistrationState(message.channel.id);
        if (currentState && currentState.user_id === message.author.id) {
            const { handleRegistrationStep } = require('../utils/registrationHandler');
            await handleRegistrationStep(message, currentState);
            return;
        }

        // ==================================================================
        // 4. PROTECCIÓN DE CANALES DE REGISTRO AJENOS
        // ==================================================================
        // Si el canal es un canal de registro privado (está en la categoría
        // de registro privado), nadie que no sea el dueño puede escribir ahí.
        const isPrivateRegCategory =
            config.categories.private_registration &&
            message.channel.parentId === config.categories.private_registration;

        if (isPrivateRegCategory) {
            // Estás en un canal de registro que no es tuyo: borrar mensaje y avisar
            try { await message.delete(); } catch (e) {}

            if (!warningCooldowns.has(message.author.id)) {
                warningCooldowns.add(message.author.id);
                setTimeout(() => warningCooldowns.delete(message.author.id), 10000);

                const warn = await message.channel.send({
                    content: `${message.author} ⛔ Este es el canal de registro de otro usuario.`
                });
                setTimeout(() => warn.delete().catch(() => {}), 5000);
            }
            return;
        }

        // ==================================================================
        // 5. USUARIOS NO VERIFICADOS EN CANALES PÚBLICOS → PERMITIDO
        // ==================================================================
        // A partir de aquí, si el usuario tiene rol "No Verificado" pero está
        // escribiendo en un canal público normal, lo DEJAMOS hablar.
        // Solo comprobamos si tiene canal de registro abierto para recordárselo
        // sin borrarle el mensaje.
        const unverifiedRole = config.roles.unverified
            ? message.guild.roles.cache.get(config.roles.unverified)
            : null;

        if (unverifiedRole && member.roles.cache.has(unverifiedRole.id)) {
            // El usuario no está verificado, está hablando en un canal público.
            // Lo permitimos, pero si no tiene canal de registro abierto lo creamos
            // en silencio para que pueda registrarse cuando quiera.

            const openReg = findOpenRegistration(message.author.id);

            if (!openReg) {
                // No tiene canal abierto: crear uno en segundo plano
                // (sin bloquear ni borrar su mensaje)
                const catPrivate = config.categories.private_registration;
                if (catPrivate) {
                    const suffix = message.author.id.slice(-4);
                    const cleanName = message.author.username
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, '')
                        .substring(0, 10);

                    // Verificar que no exista ya por nombre
                    const yaExiste = message.guild.channels.cache.find(
                        c => c.name.includes('registro') && c.name.includes(suffix)
                    );

                    if (!yaExiste && !warningCooldowns.has(message.author.id + '_reg')) {
                        warningCooldowns.add(message.author.id + '_reg');
                        setTimeout(() => warningCooldowns.delete(message.author.id + '_reg'), 60000);

                        try {
                            const newChannel = await message.guild.channels.create({
                                name: `registro-${cleanName}-${suffix}`,
                                type: ChannelType.GuildText,
                                parent: catPrivate,
                                topic: `REGISTRO_ACTIVO | USER:${message.author.id} | STEP:1`,
                                permissionOverwrites: [
                                    { id: message.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                                    { id: message.author.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                                    { id: message.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                                ]
                            });

                            initRegistrationState(newChannel.id, message.author.id);

                            // Avisamos una sola vez de forma discreta (sin borrar el mensaje)
                            if (!warningCooldowns.has(message.author.id)) {
                                warningCooldowns.add(message.author.id);
                                setTimeout(() => warningCooldowns.delete(message.author.id), 30000);

                                const hint = await message.channel.send({
                                    content: `${message.author} 👋 ¡Hola! Puedes hablar libremente, pero si quieres unirte a una tribu, completa tu registro aquí: ${newChannel}`
                                });
                                // El aviso desaparece solo tras 15 segundos para no ensuciar el chat
                                setTimeout(() => hint.delete().catch(() => {}), 15000);
                            }
                        } catch (e) {
                            console.error('Error creando canal de registro silencioso:', e.message);
                        }
                    } else if (yaExiste && !warningCooldowns.has(message.author.id)) {
                        // Tiene canal pero no está en la DB (edge case): recordárselo una vez
                        warningCooldowns.add(message.author.id);
                        setTimeout(() => warningCooldowns.delete(message.author.id), 30000);

                        const hint = await message.channel.send({
                            content: `${message.author} 👋 Si quieres unirte al servidor, completa tu registro en ${yaExiste}`
                        });
                        setTimeout(() => hint.delete().catch(() => {}), 15000);
                    }
                }
            }

            // ✅ El mensaje del usuario NO se borra. Puede hablar con normalidad.
            return;
        }
    },
};