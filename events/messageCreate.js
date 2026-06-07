const { Events, ChannelType, PermissionFlagsBits } = require('discord.js');
const { loadGuildConfig, getRegistrationState, initRegistrationState, loadTribes, saveTribe, findOpenRegistration, shouldNotifyUnverified } = require('../utils/dataManager');

// Solo para la protección de canales ajenos (10s en RAM está bien aquí)
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
        const tribes = loadTribes(message.guild.id);
        for (const tName in tribes) {
            const tribe = tribes[tName];
            if (tribe.members.some(m => m.discordId === message.author.id)) {
                const now = Date.now();
                if (now - (tribe.lastActive || 0) > 3600000) {
                    tribe.lastActive = now;
                    saveTribe(message.guild.id, tName, tribe); // ✅ saveTribe individual, no saveTribes
                }
                break;
            }
        }

        // Si es admin/staff, no aplicamos ninguna restricción
        if (isImmune) return;

        // ==================================================================
        // 3. GESTIÓN DE CANALES DE REGISTRO PRIVADOS
        // ==================================================================
        const currentState = getRegistrationState(message.channel.id);
        if (currentState && currentState.user_id === message.author.id) {
            const { handleRegistrationStep } = require('../utils/registrationHandler');
            await handleRegistrationStep(message, currentState);
            return;
        }

        // ==================================================================
        // 4. PROTECCIÓN DE CANALES DE REGISTRO AJENOS
        // ==================================================================
        const isPrivateRegCategory =
            config.categories.private_registration &&
            message.channel.parentId === config.categories.private_registration;

        if (isPrivateRegCategory) {
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
        const unverifiedRole = config.roles.unverified
            ? message.guild.roles.cache.get(config.roles.unverified)
            : null;

        if (unverifiedRole && member.roles.cache.has(unverifiedRole.id)) {
            const openReg = findOpenRegistration(message.author.id);

            // shouldNotifyUnverified devuelve true máximo una vez cada 24h (persistido en SQLite)
            const debeAvisar = shouldNotifyUnverified(message.author.id, message.guild.id);

            if (!openReg) {
                // No tiene canal de registro: crearlo en segundo plano
                const catPrivate = config.categories.private_registration;
                if (catPrivate) {
                    const suffix = message.author.id.slice(-4);
                    const cleanName = message.author.username
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, '')
                        .substring(0, 10);

                    const yaExiste = message.guild.channels.cache.find(
                        c => c.name.includes('registro') && c.name.includes(suffix)
                    );

                    if (!yaExiste) {
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

                            if (debeAvisar) {
                                const hint = await message.channel.send({
                                    content: `${message.author} 👋 ¡Hola! Puedes hablar libremente, pero si quieres unirte a una tribu, completa tu registro aquí: ${newChannel}`
                                });
                                setTimeout(() => hint.delete().catch(() => {}), 15000);
                            }
                        } catch (e) {
                            console.error('Error creando canal de registro silencioso:', e.message);
                        }
                    } else if (debeAvisar) {
                        // Tiene canal por nombre pero no en DB (edge case): recordárselo
                        const hint = await message.channel.send({
                            content: `${message.author} 👋 Si quieres unirte al servidor, completa tu registro en ${yaExiste}`
                        });
                        setTimeout(() => hint.delete().catch(() => {}), 15000);
                    }
                }
            } else if (debeAvisar) {
                // Tiene canal de registro abierto pero no lo ha completado: recordárselo
                const regChannel = message.guild.channels.cache.get(openReg.channel_id);
                if (regChannel) {
                    const hint = await message.channel.send({
                        content: `${message.author} 👋 Recuerda que tienes tu registro pendiente en ${regChannel} ¡Complétalo para unirte a una tribu!`
                    });
                    setTimeout(() => hint.delete().catch(() => {}), 15000);
                }
            }

            // ✅ El mensaje del usuario NO se borra. Puede hablar con normalidad.
            return;
        }
    },
};