const { Events, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { loadGuildConfig, loadTribes, saveTribe, isPremium, getRegistrationState, updateRegistrationState } = require('../utils/dataManager');
const { logToTribe } = require('../utils/tribeLog');

// IMPORTAMOS LOS NUEVOS HANDLERS (OPTIMIZADOS)
const { handleVote } = require('../handlers/voteHandler');
const { handleJoinRequest } = require('../handlers/tribeHandler');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        
        // --- 1. COMANDOS DE CHAT ---
        if (interaction.isChatInputCommand()) {
            if (interaction.guild && !isPremium(interaction.guild.id)) {
                const safeCommands = ['soporte', 'botinfo', 'adminlicense', 'setup']; 
                // Aquí podrías filtrar comandos si no es premium
            }

            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;
            try { await command.execute(interaction); } 
            catch (error) {
                console.error(error);
                if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: '❌ Error ejecutando comando.', ephemeral: true });
            }
            return;
        }

        // --- 2. AUTOCOMPLETADO ---
        if (interaction.isAutocomplete()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (command) try { await command.autocomplete(interaction); } catch (e) {}
            return;
        }

        // --- 3. INTERACCIONES (BOTONES, MENÚS, MODALES) ---
        if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
            const id = interaction.customId;

            try {
                // ==================================================================
                // A) SISTEMAS NUEVOS (Usando Handlers para evitar bugs)
                // ==================================================================
                
                // 1. Solicitudes de Ingreso a Tribu (FIX RACE CONDITION)
                if (id.startsWith('join_')) {
                    await handleJoinRequest(interaction);
                    return;
                }
                
                // 2. Votos de Sugerencias (FIX RAM)
                if (id.startsWith('suggest_vote_')) {
                    await handleVote(interaction);
                    return;
                }

                // ==================================================================
                // B) SISTEMAS ANTIGUOS (Manteniendo funcionalidad)
                // ==================================================================

                // 3. CANCELAR REGISTRO (Usuario se arrepiente)
                if (id === 'reg_cancel_join') {
                    await interaction.deferUpdate();
                    const state = getRegistrationState(interaction.channel.id);
                    if (state && state.step === 10) {
                        // Volver al Paso 2
                        updateRegistrationState(interaction.channel.id, 2, undefined, null);
                        await interaction.channel.send(`🔄 **Solicitud Cancelada.**\n\n🛡️ Escribe **otro nombre de tribu**:`);
                        await interaction.editReply({ components: [] });
                    }
                    return;
                }

                // 4. MERCADO (Tickets de Compra/Venta)
                if (id.startsWith('market_contact_')) {
                    await interaction.deferReply({ ephemeral: true });
                    const sellerId = id.split('_')[2];
                    const buyerId = interaction.user.id;
                    
                    if (sellerId === buyerId) return interaction.editReply('❌ No puedes negociar contigo mismo.');
        
                    const config = loadGuildConfig(interaction.guild.id);
                    if (!config || !config.categories.market) return interaction.editReply('❌ Categoría Mercado no configurada.');
        
                    const originalEmbed = interaction.message.embeds[0];
                    const productName = originalEmbed.fields.find(f => f.name.includes('Artículo') || f.name.includes('Busco'))?.value || 'Item';
                    const type = originalEmbed.title.includes('VENTA') ? 'Venta' : 'Compra';
        
                    const channelName = `🤝・${type.substring(0,1)}-${productName.substring(0,5)}-${interaction.user.username.substring(0,5)}`.replace(/[^a-z0-9\-]/gi, '').toLowerCase();
        
                    try {
                        const tradeChannel = await interaction.guild.channels.create({
                            name: channelName,
                            type: ChannelType.GuildText,
                            parent: config.categories.market,
                            topic: `MARKET | ITEM:${productName} | SELLER:${sellerId} | MSG:${interaction.message.id} | CH:${interaction.channelId}`,
                            permissionOverwrites: [
                                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                                { id: sellerId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                                { id: buyerId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                                { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel] }
                            ]
                        });
        
                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('market_close_deal').setLabel('🔒 Cerrar Trato').setStyle(ButtonStyle.Danger)
                        );
        
                        await tradeChannel.send({
                            content: `<@${sellerId}> <@${buyerId}>`,
                            embeds: [new EmbedBuilder().setTitle('🤝 Negociación').setDescription(`Interesado en **${productName}**.\nHablad aquí.`).setColor('Gold')],
                            components: [row]
                        });
        
                        return interaction.editReply(`✅ Ticket creado: ${tradeChannel}`);
                    } catch (e) { return interaction.editReply('❌ Error creando canal.'); }
                }

                if (id === 'market_close_deal') {
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('market_result_success').setLabel('✅ Éxito').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('market_result_fail').setLabel('❌ Cancelado').setStyle(ButtonStyle.Secondary)
                    );
                    await interaction.reply({ content: '¿Resultado?', components: [row] });
                }

                if (id.startsWith('market_result_')) {
                    await interaction.deferUpdate();
                    const isSuccess = id === 'market_result_success';
                    const topic = interaction.channel.topic || '';
                    
                    const originMsgId = topic.match(/MSG:(\d+)/)?.[1];
                    const originChanId = topic.match(/CH:(\d+)/)?.[1];
                    
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`market_final_keep_${originChanId}_${originMsgId}`).setLabel('🔄 Mantener Anuncio').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId(`market_final_delete_${originChanId}_${originMsgId}`).setLabel('🛑 Borrar Anuncio').setStyle(ButtonStyle.Danger)
                    );
        
                    await interaction.editReply({ content: isSuccess ? '🎉 **¡Trato cerrado!**' : '⚠️ **No hubo trato.**', components: [row] });
                }

                if (id.startsWith('market_final_')) {
                    await interaction.deferUpdate();
                    const action = id.split('_')[2];
                    const originChanId = id.split('_')[3];
                    const originMsgId = id.split('_')[4];
                    
                    const originChan = interaction.guild.channels.cache.get(originChanId);
                    if (originChan) {
                        try {
                            const msg = await originChan.messages.fetch(originMsgId);
                            if (action === 'delete') await msg.delete();
                            else await msg.reply('🔄 Sigue disponible.');
                        } catch (e) {}
                    }
                    await interaction.channel.delete();
                }

                // 5. DIPLOMACIA (Alianzas)
                // [MEJORA] Actualizado para usar saveTribe y evitar borrar datos de otros
                if (id.startsWith('diplo_')) {
                    await interaction.deferUpdate(); 
                    const action = id.split('_')[1]; 
                    const requestingTribeName = id.split('_')[2]; 
                    const guild = interaction.guild;
                    const tribes = loadTribes(guild.id);
                    const config = loadGuildConfig(guild.id);
        
                    let responderTribeName = null;
                    let responderTribeData = null;
        
                    // Buscar quién está respondiendo
                    for (const [name, data] of Object.entries(tribes)) {
                        const member = data.members.find(m => m.discordId === interaction.user.id);
                        if (member) {
                            responderTribeName = name; responderTribeData = data;
                            if (member.rango !== 'Líder') return interaction.followUp({ content: '❌ Solo el Líder puede aceptar alianzas.', ephemeral: true });
                            break;
                        }
                    }
        
                    if (!responderTribeData) return interaction.followUp({ content: '❌ No perteneces a ninguna tribu.', ephemeral: true });
                    const requestingTribeData = tribes[requestingTribeName];
                    if (!requestingTribeData) return interaction.editReply({ content: '❌ La tribu solicitante ya no existe.', components: [] });
        
                    if (action === 'deny') {
                        const embed = new EmbedBuilder().setTitle('🕊️ Rechazada').setDescription(`**${responderTribeName}** rechazó la alianza.`).setColor('Red');
                        await interaction.editReply({ content: null, embeds: [embed], components: [] });
                        await logToTribe(guild, requestingTribeData, '❌ Rechazada', `**${responderTribeName}** denegó la alianza.`, 'Red');
                        return;
                    }
        
                    if (action === 'accept') {
                        const maxAlliances = config.limits?.max_alliances || 0;
                        if (maxAlliances > 0 && (responderTribeData.alliances?.length || 0) >= maxAlliances) return interaction.followUp({ content: '❌ Tu tribu ha alcanzado el límite de alianzas.', ephemeral: true });
        
                        const catTribes = config.categories.tribes;
                        const reqRole = guild.roles.cache.find(r => r.name === requestingTribeName);
                        const resRole = guild.roles.cache.find(r => r.name === responderTribeName);
                        const channelName = `🤝・${requestingTribeName.substring(0,6)}-${responderTribeName.substring(0,6)}`.toLowerCase().replace(/[^a-z0-9\-\u{1F91D}]/gu, '');
                        
                        try {
                            const allianceChannel = await guild.channels.create({
                                name: channelName, type: ChannelType.GuildText, parent: catTribes,
                                permissionOverwrites: [
                                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                                    { id: reqRole ? reqRole.id : guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                                    { id: resRole ? resRole.id : guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                                    { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel] }
                                ]
                            });
        
                            if (!requestingTribeData.alliances) requestingTribeData.alliances = [];
                            if (!responderTribeData.alliances) responderTribeData.alliances = [];
                            
                            // Evitar duplicados
                            if (!requestingTribeData.alliances.includes(responderTribeName)) requestingTribeData.alliances.push(responderTribeName);
                            if (!responderTribeData.alliances.includes(requestingTribeName)) responderTribeData.alliances.push(requestingTribeName);
        
                            if (!requestingTribeData.allianceChannels) requestingTribeData.allianceChannels = [];
                            requestingTribeData.allianceChannels.push({ with: responderTribeName, channelId: allianceChannel.id });
        
                            // [FIX] Guardado individual seguro
                            saveTribe(guild.id, requestingTribeName, requestingTribeData);
                            saveTribe(guild.id, responderTribeName, responderTribeData);
        
                            await allianceChannel.send(`🤝 **Alianza Formada**\nBienvenidos al canal compartido.`);
                            const embed = new EmbedBuilder().setTitle('🕊️ Aceptada').setDescription(`Ahora sois aliados de **${requestingTribeName}**.`).setColor('Green');
                            await interaction.editReply({ content: null, embeds: [embed], components: [] });
                            await logToTribe(guild, requestingTribeData, '✅ Aceptada', `**${responderTribeName}** aceptó la alianza. Canal: ${allianceChannel}`, 'Green');
                        } catch (e) { 
                            console.error(e);
                            return interaction.followUp({ content: '❌ Error creando canal de alianza.', ephemeral: true }); 
                        }
                    }
                    return;
                }

                // 6. TICKETS DE SOPORTE
                if (id === 'create_ticket') {
                    try {
                        await interaction.deferReply({ ephemeral: true });
                        const name = `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
                        if (interaction.guild.channels.cache.find(c => c.name === name)) return interaction.followUp('❌ Ya tienes un ticket abierto.');
                        
                        const ch = await interaction.guild.channels.create({
                            name: name, type: ChannelType.GuildText, parent: interaction.channel.parentId,
                            permissionOverwrites: [{ id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel] }]
                        });
                        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Cerrar').setStyle(ButtonStyle.Danger));
                        await ch.send({ content: `${interaction.user}`, embeds: [new EmbedBuilder().setTitle('Ticket de Soporte').setDescription('Describe tu problema detalladamente.').setColor('Green')], components: [row] });
                        return interaction.followUp(`✅ Ticket creado: ${ch}`);
                    } catch (e) { return interaction.followUp('❌ Error creando ticket.'); }
                }
        
                if (id === 'close_ticket') {
                    if (!interaction.channel.name.startsWith('ticket-')) return;
                    await interaction.reply('🔒 Cerrando ticket en 5 segundos...');
                    setTimeout(() => interaction.channel.delete().catch(()=>{}), 5000);
                }

                // 7. VOTACIÓN INTERNA DE TRIBU (Elegir Líder)
                if (interaction.isStringSelectMenu() && id.startsWith('tribe_vote_')) {
                    try {
                        const tribeName = id.split('_')[2];
                        const candidateId = interaction.values[0];
                        await interaction.deferReply({ ephemeral: true });
                        const tribes = loadTribes(interaction.guild.id);
                        const tData = tribes[tribeName];
                        if (!tData) return interaction.followUp('❌ Error: Tribu no encontrada.');
                        
                        if (!tData.votes) tData.votes = {};
                        tData.votes[interaction.user.id] = candidateId;
                        
                        // Verificar si hay mayoría
                        const votes = Object.values(tData.votes).filter(id => id === candidateId).length;
                        const majority = Math.floor(tData.members.length / 2) + 1;

                        if (votes >= majority) {
                            // Cambiar líder
                            tData.members.forEach(m => { if (m.rango === 'Líder') m.rango = 'Miembro'; });
                            const winner = tData.members.find(m => m.discordId === candidateId);
                            if (winner) winner.rango = 'Líder';
                            tData.votes = {}; // Resetear votos
                            
                            // [FIX] Guardado seguro
                            saveTribe(interaction.guild.id, tribeName, tData);
                            
                            interaction.channel.send(`👑 **Cambio de Mando:** El nuevo Líder es <@${candidateId}> (Mayoría alcanzada).`);
                            return interaction.deleteReply();
                        }
                        
                        // [FIX] Guardado seguro
                        saveTribe(interaction.guild.id, tribeName, tData);
                        return interaction.followUp(`✅ Voto registrado para <@${candidateId}>.`);
                    } catch (e) { console.error(e); }
                }

                // 8. SISTEMA DE REPORTES (MODAL)
                if (interaction.isModalSubmit() && id === 'report_modal') {
                    await interaction.deferReply({ ephemeral: true });
        
                    try {
                        const name = interaction.fields.getTextInputValue('report_name');
                        const reason = interaction.fields.getTextInputValue('report_reason');
                        const proof = interaction.fields.getTextInputValue('report_proof') || 'Sin pruebas adjuntas';
        
                        const config = loadGuildConfig(interaction.guild.id);
                        if (!config || !config.channels || !config.channels.reports) throw new Error('Canal de reportes no configurado.');
        
                        const reportChannel = interaction.guild.channels.cache.get(config.channels.reports);
                        if (!reportChannel) throw new Error('El canal de reportes ha sido borrado.');
        
                        const embed = new EmbedBuilder()
                            .setTitle('🚨 Nuevo Reporte de Jugador')
                            .setColor('Red')
                            .addFields(
                                { name: '👤 Reportante', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
                                { name: '🎯 Acusado / Tribu', value: name, inline: true },
                                { name: '📝 Motivo', value: reason, inline: false },
                                { name: '🔗 Pruebas', value: proof, inline: false }
                            )
                            .setTimestamp();
                        
                        await reportChannel.send({ embeds: [embed] });
                        await interaction.editReply('✅ **Reporte enviado.** La administración lo revisará.');
        
                    } catch (error) {
                        await interaction.editReply(`❌ Error: ${error.message}`);
                    }
                }

            } catch (error) {
                console.error(`Error en interacción ${id}:`, error);
                if (!interaction.replied) await interaction.reply({ content: '❌ Error interno procesando la solicitud.', ephemeral: true });
            }
        }
    },
};