const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
// AÑADIDO: saveTribe en los imports
const { loadTribes, saveTribe, updateRegistrationState, deleteRegistrationState, loadGuildConfig } = require('./dataManager');
const { updateLog } = require('./logger');
const { updateTribePanel } = require('./tribePanel');

/**
 * Maneja los pasos del chat de registro (1, 2, 3, etc.)
 */
async function handleRegistrationStep(message, state) {
    const content = message.content.trim();
    const lowerContent = content.toLowerCase();
    const guild = message.guild;
    const config = loadGuildConfig(guild.id);

    // 🛑 PASO 10: ESTADO DE ESPERA (CONGELADO)
    if (state.step === 10) {
        try { await message.delete(); } catch(e){}
        return;
    }

    // ▶️ PASO 1: RECIBIR ID PLATAFORMA
    if (state.step === 1) {
        updateRegistrationState(message.channel.id, 2, content, undefined);
        await message.channel.send(`✅ ID Guardado: **${content}**\n\n🛡️ Ahora escribe el **nombre de tu Tribu**:\n*(Si la tribu ya existe, te preguntaré si quieres unirte)*.`);
        return;
    }

    // ▶️ PASO 2: RECIBIR NOMBRE DE TRIBU
    if (state.step === 2) {
        const tribes = loadTribes(guild.id);
        const inputTribe = content; 

        const existingTribeKey = Object.keys(tribes).find(k => k.toLowerCase() === inputTribe.toLowerCase());

        // A) LA TRIBU YA EXISTE
        if (existingTribeKey) {
            updateRegistrationState(message.channel.id, 3, undefined, existingTribeKey);
            await message.channel.send(`ℹ️ La tribu **${existingTribeKey}** ya existe.\n¿Quieres solicitar unirte a ella? (Escribe **Si** o **No**)`);
            return;
        } 
        
        // B) LA TRIBU ES NUEVA -> Ir a Confirmación (Paso 4)
        else {
            updateRegistrationState(message.channel.id, 4, undefined, inputTribe);
            await sendConfirmationSummary(message.channel, state.data_id, inputTribe, "Crear Nueva Tribu");
            return;
        }
    }

    // ▶️ PASO 3: DECISIÓN ¿UNIRSE A EXISTENTE?
    if (state.step === 3) {
        const yesWords = ['si', 'yes', 's', 'y'];
        const noWords = ['no', 'n'];

        // USUARIO DICE SÍ (Quiere unirse)
        if (yesWords.includes(lowerContent)) {
            const tribes = loadTribes(guild.id);
            const targetTribe = tribes[state.data_tribe];
            const maxMembers = config.limits?.max_tribe_members || 0;

            if (!targetTribe) {
                await message.channel.send(`❌ Error: La tribu **${state.data_tribe}** ha dejado de existir. Escribe otro nombre.`);
                updateRegistrationState(message.channel.id, 2, undefined, null);
                return;
            }

            if (maxMembers > 0 && targetTribe.members.length >= maxMembers) {
                await message.channel.send(`❌ La tribu **${state.data_tribe}** está llena (${targetTribe.members.length}/${maxMembers}).\n🔄 Por favor, escribe otro nombre.`);
                updateRegistrationState(message.channel.id, 2, undefined, null);
                return;
            }

            // Enviar solicitud al canal de la tribu
            const tribeChannel = guild.channels.cache.get(targetTribe.channelId);
            
            if (!tribeChannel) {
                await message.channel.send(`⚠️ La tribu **${state.data_tribe}** no tiene canal configurado. Contacta a un admin.`);
                return;
            }

            const requestEmbed = new EmbedBuilder()
                .setTitle('📨 Solicitud de Ingreso')
                .setColor('Blue')
                .setDescription(`El usuario **${message.author.tag}** (ID: ${state.data_id}) solicita unirse a vuestra tribu.`)
                .addFields({ name: 'Acción Requerida', value: 'Cualquier miembro de la tribu puede aceptar o rechazar.' })
                .setTimestamp();

            const rowTribe = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`join_accept_${message.author.id}_${message.channel.id}`).setLabel('✅ Aceptar').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`join_deny_${message.author.id}_${message.channel.id}`).setLabel('❌ Rechazar').setStyle(ButtonStyle.Danger)
            );

            await tribeChannel.send({ content: '@here', embeds: [requestEmbed], components: [rowTribe] });

            updateRegistrationState(message.channel.id, 10, undefined, undefined);

            const cancelRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('reg_cancel_join').setLabel('Cancelar Solicitud').setStyle(ButtonStyle.Secondary)
            );

            await message.channel.send({ 
                content: `⏳ **Solicitud enviada a ${state.data_tribe}.**\nTu canal permanecerá abierto hasta que respondan.\nSi te has equivocado, pulsa cancelar.`,
                components: [cancelRow] 
            });
            return;
        }

        // USUARIO DICE NO
        else if (noWords.includes(lowerContent)) {
            await message.channel.send(`🔄 Vale. Escribe **otro nombre de tribu**:`);
            updateRegistrationState(message.channel.id, 2, undefined, null);
            return;
        } else {
            await message.channel.send(`⚠️ Respuesta no válida. Escribe **Si** o **No**.`);
            return;
        }
    }

    // ▶️ PASO 4: CONFIRMACIÓN DE CREACIÓN
    if (state.step === 4) {
        const yesWords = ['si', 'yes', 's', 'y', 'correcto', 'confirmar'];
        const noWords = ['no', 'n', 'mal', 'error', 'corregir'];

        if (yesWords.includes(lowerContent)) {
            // CREAR TRIBU Y FINALIZAR (Nueva tribu = true)
            await finalizarRegistro(message.member, message.channel, state.data_id, state.data_tribe, config, true);
        } 
        else if (noWords.includes(lowerContent)) {
            await message.channel.send(`❓ ¿Qué dato es incorrecto? Escribe **id** o **tribu**:`);
            updateRegistrationState(message.channel.id, 5, undefined, undefined);
        }
        else {
            if (lowerContent.includes('id')) {
                await message.channel.send(`✏️ Escribe tu nuevo **ID de Plataforma**:`);
                updateRegistrationState(message.channel.id, 1, null, undefined);
            } else if (lowerContent.includes('tribu')) {
                await message.channel.send(`✏️ Escribe el nuevo **nombre de Tribu**:`);
                updateRegistrationState(message.channel.id, 2, undefined, null);
            } else {
                await message.channel.send(`⚠️ Escribe **Si** para confirmar o **No** para corregir.`);
            }
        }
        return;
    }

    // ▶️ PASO 5: SELECCIÓN DE CORRECCIÓN
    if (state.step === 5) {
        if (lowerContent.includes('id') || lowerContent.includes('plataforma')) {
            await message.channel.send(`✏️ Escribe tu nuevo **ID de Plataforma**:`);
            updateRegistrationState(message.channel.id, 1, null, undefined);
        } else if (lowerContent.includes('tribu') || lowerContent.includes('nombre')) {
            await message.channel.send(`✏️ Escribe el nuevo **nombre de Tribu**:`);
            updateRegistrationState(message.channel.id, 2, undefined, null);
        } else {
            await message.channel.send(`⚠️ Opción no reconocida. Escribe "id" o "tribu".`);
        }
        return;
    }
}

async function sendConfirmationSummary(channel, id, tribe, title) {
    const summaryEmbed = new EmbedBuilder()
        .setTitle(`📋 ${title}`)
        .setColor('Gold')
        .setDescription(`Verifica que tus datos sean correctos.`)
        .addFields(
            { name: '🎮 ID Plataforma', value: id || '?', inline: true },
            { name: '🛡️ Tribu', value: tribe, inline: true }
        )
        .setFooter({ text: 'Escribe "si" para confirmar o "no" para corregir.' });
    await channel.send({ embeds: [summaryEmbed] });
}

/**
 * Finaliza el registro, asigna roles, crea canal de tribu (si es nueva) y da la bienvenida.
 */
async function finalizarRegistro(member, channel, idPlay, tName, config, isNewTribe) {
    try { deleteRegistrationState(channel.id); } catch(e) {}
    
    await channel.send(`✅ **¡Registro Completado!** Procesando...`);

    const guild = member.guild;
    
    // 1. Cargar datos
    let tribes = loadTribes(guild.id);
    let tData = tribes[tName];
    let tRole = guild.roles.cache.find(r => r.name === tName);

    // 2. Si es nueva tribu, crear infraestructura
    if (isNewTribe || !tData) {
        if (!tRole) tRole = await guild.roles.create({ name: tName, color: 'Random', reason: 'Registro BotArk' });
        
        let tCatId = config.categories.tribes;
        
        const tChan = await guild.channels.create({ 
            name: tName, 
            type: ChannelType.GuildText, 
            parent: tCatId, 
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }, 
                { id: tRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }, 
                { id: member.client.user.id, allow: [PermissionFlagsBits.ViewChannel] }
            ] 
        });
        
        tData = { 
            members: [], 
            warnings: 0, 
            channelId: tChan.id, 
            instructionMessageId: null, 
            lastActive: Date.now(), 
            alliances: [], 
            allianceChannels: [] 
        };
        // No guardamos en el objeto gigante 'tribes' para evitar race condition
        // Lo guardaremos individualmente abajo
        
        await channel.send(`✅ Tribu **${tName}** creada correctamente.`);
    }

    // 3. Gestión de Roles Discord
    const rank = (tData.members.length === 0) ? 'Líder' : 'Miembro';
    
    if (tRole) await member.roles.add(tRole).catch(()=>{});
    
    const survivorRole = guild.roles.cache.get(config.roles.survivor);
    if (survivorRole) await member.roles.add(survivorRole).catch(()=>{});
    
    const unverifiedRole = guild.roles.cache.get(config.roles.unverified);
    if (unverifiedRole) await member.roles.remove(unverifiedRole).catch(()=>{});
    
    if (rank === 'Líder') { 
        const lRole = guild.roles.cache.get(config.roles.leader); 
        if (lRole) await member.roles.add(lRole).catch(()=>{}); 
    }

    // 4. Actualizar Objeto de la Tribu
    tData.members.push({ 
        username: member.user.username, 
        idPlay: idPlay, 
        discordId: member.id, 
        hasKit: false, 
        warnings: 0, 
        rango: rank 
    });
    
    // 5. [CRÍTICO] GUARDADO SEGURO
    saveTribe(guild.id, tName, tData); 
    
    // 6. Logs y Paneles
    await updateLog(guild, member.client);
    await updateTribePanel(guild, tName);

    // 7. Bienvenida
    const welcomeChan = guild.channels.cache.get(config.channels.welcome);
    if (welcomeChan) {
        try {
            const welcomeEmbed = new EmbedBuilder()
                .setColor('#9B59B6') 
                .setTitle(`🦖 Nuevo Superviviente Registrado`)
                .setDescription(`¡Bienvenido a **${guild.name}**, **${member.user.username}**!`)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .addFields(
                    { name: '👤 Superviviente', value: `${member}`, inline: true },
                    { name: '🎮 ID Plataforma', value: `\`${idPlay}\``, inline: true },
                    { name: '🛡️ Tribu', value: `**${tName}**`, inline: true }
                )
                .setFooter({ text: `${member.client.user.username} • Sistema de Acceso`, iconURL: guild.iconURL() })
                .setTimestamp();
            
            await welcomeChan.send({ content: `¡Hola ${member}!`, embeds: [welcomeEmbed] });
        } catch (e) {
            console.error("Error enviando bienvenida:", e);
        }
    }

    // 8. Limpieza
    await channel.send(`👋 **Todo listo.** Cerrando canal...`);
    setTimeout(async () => { try { if (channel) await channel.delete(); } catch (e) {} }, 5000);
}

module.exports = { handleRegistrationStep, finalizarRegistro };