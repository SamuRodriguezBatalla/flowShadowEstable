const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { loadTribes, saveTribes, saveTribe, loadGuildConfig } = require('../utils/dataManager');
const { updateLog } = require('../utils/logger');
const { generateTribeHelpEmbed } = require('../utils/helpGenerator');
const { updateTribePanel } = require('../utils/tribePanel'); // <--- NUEVO IMPORT

// Función auxiliar para generar el embed de votación
function generateVoteEmbed(tribeData, tribeName, interactionClient) {
    const totalMembers = tribeData.members.length;
    const votesNeeded = Math.floor(totalMembers / 2) + 1;
    const votes = tribeData.votes || {};
    const voteCounts = {};

    Object.values(votes).forEach(v => voteCounts[v] = (voteCounts[v] || 0) + 1);

    const selectOptions = [];
    let voteStatusDescription = `Miembros Totales: **${totalMembers}** | Mayoría: **${votesNeeded}**\n\n`;

    tribeData.members.forEach(m => {
        const currentVotes = voteCounts[m.discordId] || 0;
        const percentage = Math.round((currentVotes / totalMembers) * 100);
        const bar = "█".repeat(Math.floor(percentage / 10));
        
        voteStatusDescription += `${m.rango === 'Líder' ? '👑' : '👤'} **${m.username}** (${currentVotes}) [${percentage}%]\n` +
                                 `┕ **[${bar}${' '.repeat(10 - bar.length)}]**\n`;

        selectOptions.push({
            label: `${m.username} (${currentVotes})`,
            value: m.discordId,
            description: m.rango === 'Líder' ? 'Líder Actual' : 'Miembro'
        });
    });

    const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle(`🗳️ Elecciones: ${tribeName}`)
        .setDescription(voteStatusDescription)
        .setFooter({ text: 'Tu voto es secreto.' });

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId(`tribe_vote_${tribeName}`).setPlaceholder('Vota aquí...').addOptions(selectOptions)
    );

    return { embed, actionRow: row };
}

const createData = () => {
    return new SlashCommandBuilder()
        .setName('tribu')
        .setDescription('Gestión de tu tribu.')
        .addSubcommand(s => s.setName('info').setDescription('Información de tu tribu.'))
        .addSubcommand(s => s.setName('checkin').setDescription('🕒 Renueva actividad para evitar borrado.'))
        .addSubcommand(s => s.setName('votar').setDescription('Inicia votación de líder.'))
        .addSubcommand(s => s.setName('reclutar').setDescription('Invita a un jugador a tu tribu.').addUserOption(o => o.setName('usuario').setDescription('Usuario a invitar').setRequired(true)))
        .addSubcommand(s => s.setName('ascender').setDescription('Traspasa liderazgo.').addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true)))
        .addSubcommand(s => s.setName('kick').setDescription('Expulsa miembro.').addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true)))
        .addSubcommand(s => s.setName('rename').setDescription('Cambia nombre tribu.').addStringOption(o => o.setName('nuevo_nombre').setDescription('Nuevo nombre').setRequired(true)))
        .addSubcommand(s => s.setName('updatehelp').setDescription('ADMIN: Actualiza paneles en canales.'));
};

module.exports = {
    createData,
    data: createData(),
    generateVoteEmbed,

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const config = loadGuildConfig(guildId);
        
        if (!config) return interaction.reply({ content: '❌ Bot no configurado.', flags: MessageFlags.Ephemeral });

        let tribes = loadTribes(guildId);
        const subcommand = interaction.options.getSubcommand();
        const executorId = interaction.user.id;
        const isServerAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        // Buscar tribu del usuario
        let myTribeName = null, myTribeData = null;
        for (const tName in tribes) {
            if (tribes[tName].members.some(m => m.discordId === executorId)) {
                myTribeName = tName;
                myTribeData = tribes[tName];
                break;
            }
        }

        // --- COMANDO CHECKIN ---
        if (subcommand === 'checkin') {
            if (!myTribeData) return interaction.reply({ content: '❌ No tienes tribu.', flags: MessageFlags.Ephemeral });
            
            const now = Date.now();
            const lastActive = myTribeData.lastActive || 0;
            const timeDiff = now - lastActive;
            const NOTIFICATION_COOLDOWN = 12 * 60 * 60 * 1000; 

            myTribeData.lastActive = now;
            saveTribe(guildId, myTribeName, myTribeData);

            // Actualizar panel para refrescar warns/info si hace falta
            await updateTribePanel(interaction.guild, myTribeName);

            if (config.channels.checkin_log && timeDiff > NOTIFICATION_COOLDOWN) {
                const ch = interaction.guild.channels.cache.get(config.channels.checkin_log);
                if (ch) {
                    if (myTribeData.lastCheckinMsgId) {
                        try {
                            const oldMsg = await ch.messages.fetch(myTribeData.lastCheckinMsgId).catch(() => null);
                            if (oldMsg) await oldMsg.delete();
                        } catch (e) {}
                    }
                    const sentMsg = await ch.send({
                        embeds: [new EmbedBuilder()
                            .setAuthor({ name: `Check-in Manual: ${myTribeName}`, iconURL: interaction.user.displayAvatarURL() })
                            .setDescription(`✅ La tribu **${myTribeName}** ha confirmado su asistencia.\n⏰ **Hora:** <t:${Math.floor(now / 1000)}:R>`)
                            .setColor('Green')
                            .setTimestamp()
                        ]
                    }).catch(console.error);

                    if (sentMsg) {
                        myTribeData.lastCheckinMsgId = sentMsg.id;
                        saveTribe(guildId, myTribeName, myTribeData);
                    }
                }
                return interaction.reply({ content: `✅ **Check-in completado.**`, flags: MessageFlags.Ephemeral });
            } else {
                return interaction.reply({ content: `✅ **Check-in completado.** (Sin log público por cooldown).`, flags: MessageFlags.Ephemeral });
            }
        }

        // --- COMANDO UPDATEHELP (ADMIN) - ACTUALIZA PANELES ---
        if (subcommand === 'updatehelp') {
            if (!isServerAdmin) return interaction.reply({ content: '❌ Solo admins.', flags: MessageFlags.Ephemeral });
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            let count = 0;
            
            for (const tName in tribes) {
                // Actualiza o crea el panel dinámico en cada canal
                await updateTribePanel(interaction.guild, tName);
                count++;
            }
            return interaction.editReply(`✅ Paneles actualizados en ${count} tribus.`);
        }

        if (!myTribeData && !isServerAdmin) return interaction.reply({ content: '❌ No tienes tribu.', flags: MessageFlags.Ephemeral });

        const myMember = myTribeData ? myTribeData.members.find(m => m.discordId === executorId) : null;
        const isLeader = myMember?.rango === 'Líder';

        // --- COMANDO RECLUTAR ---
        if (subcommand === 'reclutar') {
            if (!isLeader && !isServerAdmin) return interaction.reply({ content: '❌ Solo el Líder puede reclutar.', flags: MessageFlags.Ephemeral });

            const maxMembers = config.limits?.max_tribe_members || 0;
            if (maxMembers > 0 && myTribeData.members.length >= maxMembers) {
                return interaction.reply({ content: `❌ Tu tribu está llena (${myTribeData.members.length}/${maxMembers}).`, flags: MessageFlags.Ephemeral });
            }

            const targetUser = interaction.options.getUser('usuario');
            if (targetUser.bot) return interaction.reply({ content: '❌ No bots.', flags: MessageFlags.Ephemeral });
            if (targetUser.id === executorId) return interaction.reply({ content: '❌ Ya estás dentro.', flags: MessageFlags.Ephemeral });

            // Verificar No Verificado
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            if (!targetMember) return interaction.reply({ content: '❌ Usuario no encontrado.', flags: MessageFlags.Ephemeral });
            if (config.roles.unverified && targetMember.roles.cache.has(config.roles.unverified)) {
                return interaction.reply({ content: `❌ **${targetUser.tag}** es No Verificado.`, flags: MessageFlags.Ephemeral });
            }

            await interaction.deferReply();

            const inviteEmbed = new EmbedBuilder()
                .setTitle('📨 Invitación de Tribu')
                .setDescription(`Hola ${targetUser}, el líder de **${myTribeName}** te invita a unirte.`)
                .setFooter({ text: 'Si aceptas, saldrás de tu tribu actual automáticamente.' })
                .setColor('Gold');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('accept_invite').setLabel('✅ Aceptar').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('reject_invite').setLabel('❌ Rechazar').setStyle(ButtonStyle.Danger)
            );

            const msg = await interaction.editReply({ content: `${targetUser}`, embeds: [inviteEmbed], components: [row] });

            const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

            collector.on('collect', async i => {
                if (i.user.id !== targetUser.id) return i.reply({ content: '⛔ No es para ti.', flags: MessageFlags.Ephemeral });

                if (i.customId === 'reject_invite') {
                    await i.update({ content: `❌ **${targetUser.username}** rechazó.`, embeds: [], components: [] });
                    return;
                }

                if (i.customId === 'accept_invite') {
                    tribes = loadTribes(guildId); 
                    const freshTribe = tribes[myTribeName];
                    
                    if (!freshTribe) return i.update({ content: '❌ Tribu no existe.', embeds: [], components: [] });
                    if (maxMembers > 0 && freshTribe.members.length >= maxMembers) return i.update({ content: '❌ Tribu llena.', embeds: [], components: [] });

                    // SALIDA TRIBU ANTERIOR
                    let oldTribeName = null;
                    for (const tName in tribes) {
                        if (tribes[tName].members.some(m => m.discordId === targetUser.id)) {
                            oldTribeName = tName;
                            break;
                        }
                    }

                    if (oldTribeName) {
                        const oldTribe = tribes[oldTribeName];
                        const memberIdx = oldTribe.members.findIndex(m => m.discordId === targetUser.id);
                        const wasLeader = oldTribe.members[memberIdx].rango === 'Líder';

                        oldTribe.members.splice(memberIdx, 1);

                        const oldRole = interaction.guild.roles.cache.find(r => r.name === oldTribeName);
                        const leaderRole = interaction.guild.roles.cache.get(config.roles.leader);
                        
                        if (oldRole) await targetMember.roles.remove(oldRole).catch(()=>{});
                        if (wasLeader && leaderRole) await targetMember.roles.remove(leaderRole).catch(()=>{});

                        if (oldTribe.members.length === 0) {
                            if (oldTribe.channelId) await interaction.guild.channels.delete(oldTribe.channelId).catch(()=>{});
                            if (oldRole) await oldRole.delete().catch(()=>{});
                            delete tribes[oldTribeName];
                        } else {
                            if (wasLeader) {
                                if (oldTribe.members.length === 1) {
                                    const survivor = oldTribe.members[0];
                                    survivor.rango = 'Líder';
                                    const survivorObj = await interaction.guild.members.fetch(survivor.discordId).catch(()=>{});
                                    if (survivorObj && leaderRole) await survivorObj.roles.add(leaderRole).catch(()=>{});
                                    
                                    const ch = interaction.guild.channels.cache.get(oldTribe.channelId);
                                    if (ch) ch.send(`👑 **${survivor.username}** es el nuevo Líder.`);
                                } else {
                                    const ch = interaction.guild.channels.cache.get(oldTribe.channelId);
                                    if (ch) {
                                        const { embed, actionRow } = generateVoteEmbed(oldTribe, oldTribeName, interaction.client);
                                        await ch.send({ content: `⚠️ Votación automática por nuevo líder.`, embeds: [embed], components: [actionRow] });
                                    }
                                }
                            }
                            // ACTUALIZAR PANEL TRIBU ANTIGUA (Si sigue existiendo)
                            await updateTribePanel(interaction.guild, oldTribeName);
                        }
                    }

                    // INGRESO NUEVA TRIBU
                    freshTribe.members.push({
                        username: targetUser.username,
                        idPlay: 'Reclutado', 
                        discordId: targetUser.id,
                        hasKit: false,
                        warnings: 0,
                        rango: 'Miembro'
                    });

                    const tribeRole = interaction.guild.roles.cache.find(r => r.name === myTribeName);
                    const survivorRole = interaction.guild.roles.cache.get(config.roles.survivor);
                    
                    if (tribeRole) await targetMember.roles.add(tribeRole).catch(()=>{});
                    if (survivorRole) await targetMember.roles.add(survivorRole).catch(()=>{});

                    saveTribes(guildId, tribes);
                    await updateLog(interaction.guild, interaction.client);

                    if (freshTribe.channelId) {
                        const ch = interaction.guild.channels.cache.get(freshTribe.channelId);
                        if (ch) ch.send(`👋 ¡Bienvenido **${targetUser.username}**!`);
                    }

                    // ACTUALIZAR PANEL TRIBU NUEVA
                    await updateTribePanel(interaction.guild, myTribeName);

                    await i.update({ content: `✅ **${targetUser.username}** unido a **${myTribeName}**.`, embeds: [], components: [] });
                }
            });
            return;
        }

        // --- INFO ---
        if (subcommand === 'info') {
            const list = myTribeData.members.map(m => `${m.rango === 'Líder' ? '👑' : '👤'} **${m.username}**`).join('\n');
            return interaction.reply({ content: `🛡️ **Tribu: ${myTribeName}**\n\n${list}` });
        }

        // --- VOTAR ---
        if (subcommand === 'votar') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const ch = interaction.guild.channels.cache.get(myTribeData.channelId);
            if (!ch) return interaction.followUp('❌ Canal no encontrado.');
            
            const { embed, actionRow } = generateVoteEmbed(myTribeData, myTribeName);
            await ch.send({ content: `🗳️ **Votación iniciada**`, embeds: [embed], components: [actionRow] });
            return interaction.followUp('✅ Votación lanzada.');
        }

        // --- ASCENDER / KICK ---
        if (['ascender', 'kick'].includes(subcommand)) {
            if (!isLeader && !isServerAdmin) return interaction.reply({ content: '❌ Solo Líder.', flags: MessageFlags.Ephemeral });
            
            const targetUser = interaction.options.getUser('usuario');
            const targetIdx = myTribeData.members.findIndex(m => m.discordId === targetUser.id);
            if (targetIdx === -1) return interaction.reply({ content: '❌ Usuario no está en tribu.', flags: MessageFlags.Ephemeral });

            const leaderRole = interaction.guild.roles.cache.get(config.roles.leader);

            if (subcommand === 'ascender') {
                myTribeData.members.forEach(m => {
                    if (m.rango === 'Líder') {
                        m.rango = 'Miembro';
                        const old = interaction.guild.members.cache.get(m.discordId);
                        if (old && leaderRole) old.roles.remove(leaderRole).catch(() => {});
                    }
                });
                myTribeData.members[targetIdx].rango = 'Líder';
                const nev = interaction.guild.members.cache.get(targetUser.id);
                if (nev && leaderRole) nev.roles.add(leaderRole).catch(() => {});
                
                saveTribes(guildId, tribes);
                await updateLog(interaction.guild, interaction.client);
                
                // ACTUALIZAR PANEL
                await updateTribePanel(interaction.guild, myTribeName);
                
                return interaction.reply(`👑 **${targetUser}** es el nuevo Líder.`);
            }

            if (subcommand === 'kick') {
                if (targetUser.id === executorId) return interaction.reply({ content: '❌ No te auto-expulses.', flags: MessageFlags.Ephemeral });
                const mem = interaction.guild.members.cache.get(targetUser.id);
                if (mem) {
                    const tRole = interaction.guild.roles.cache.find(r => r.name === myTribeName);
                    if (tRole) await mem.roles.remove(tRole).catch(() => {});
                    if (leaderRole) await mem.roles.remove(leaderRole).catch(() => {});
                }
                myTribeData.members.splice(targetIdx, 1);
                saveTribes(guildId, tribes);
                await updateLog(interaction.guild, interaction.client);
                
                // ACTUALIZAR PANEL
                await updateTribePanel(interaction.guild, myTribeName);

                return interaction.reply(`👢 **${targetUser.tag}** expulsado.`);
            }
        }
        
        // --- RENAME ---
        if (subcommand === 'rename') {
            if (!isLeader && !isServerAdmin) return interaction.reply({ content: '❌ Solo Líder.', flags: MessageFlags.Ephemeral });
            await interaction.deferReply();
            const newName = interaction.options.getString('nuevo_nombre');
            if (tribes[newName]) return interaction.followUp('❌ Nombre ocupado.');

            const oldName = myTribeName;
            const role = interaction.guild.roles.cache.find(r => r.name === oldName);
            const ch = interaction.guild.channels.cache.get(myTribeData.channelId);

            if (role) await role.setName(newName).catch(console.error);
            if (ch) await ch.setName(newName).catch(console.error);

            tribes[newName] = myTribeData;
            delete tribes[oldName];
            saveTribes(guildId, tribes);
            await updateLog(interaction.guild, interaction.client);
            
            // ACTUALIZAR PANEL (Con nuevo nombre)
            await updateTribePanel(interaction.guild, newName);

            return interaction.followUp(`✅ Tribu renombrada a **${newName}**.`);
        }
    },
};
