const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
// 1. Importamos saveTribe en lugar de saveTribes
const { loadTribes, saveTribe, loadGuildConfig } = require('../utils/dataManager');
const { logToTribe } = require('../utils/tribeLog');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('diplomacia')
        .setDescription('Gestión avanzada de relaciones, guerras y raids.')
        .addSubcommand(s => s.setName('alianza').setDescription('🕊️ Envía solicitud de alianza (Requiere aceptación).').addStringOption(o => o.setName('tribu_objetivo').setDescription('Nombre de la tribu').setAutocomplete(true).setRequired(true)))
        .addSubcommand(s => s.setName('romper_alianza').setDescription('💔 Romper una alianza existente y borrar el canal.').addStringOption(o => o.setName('tribu_objetivo').setDescription('Nombre de la tribu aliada').setAutocomplete(true).setRequired(true)))
        .addSubcommand(s => s.setName('guerra').setDescription('⚔️ Declara la guerra (Crea canal de conflicto).').addStringOption(o => o.setName('tribu_objetivo').setDescription('Nombre de la tribu').setAutocomplete(true).setRequired(true)))
        .addSubcommand(s => s.setName('paz').setDescription('🏳️ Proponer tratado de paz (Elimina guerra).').addStringOption(o => o.setName('tribu_objetivo').setDescription('Nombre de la tribu').setAutocomplete(true).setRequired(true)))
        .addSubcommand(s => s.setName('raideo').setDescription('🔥 ¡ALERTA DE RAID! Iniciar ataque.').addStringOption(o => o.setName('tribu_objetivo').setDescription('Nombre de la tribu').setAutocomplete(true).setRequired(true)))
        .addSubcommand(s => s.setName('fin_raid').setDescription('🏁 Reportar resultado de un raid.').addStringOption(o => o.setName('tribu_objetivo').setDescription('Nombre de la tribu atacada').setAutocomplete(true).setRequired(true))
            .addStringOption(o => o.setName('resultado').setDescription('¿Cómo fue?').setRequired(true).addChoices({ name: '✅ Éxito (Wipe/Loot)', value: 'exito' }, { name: '❌ Fallido (Retirada/Defensa)', value: 'fallido' }))),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const tribes = loadTribes(interaction.guild.id);
        const choices = Object.keys(tribes);
        const filtered = choices.filter(choice => choice.toLowerCase().includes(focusedValue.toLowerCase()));
        await interaction.respond(filtered.slice(0, 25).map(choice => ({ name: choice, value: choice })));
    },

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const targetName = interaction.options.getString('tribu_objetivo');
        const guild = interaction.guild;
        const config = loadGuildConfig(guild.id);
        let tribes = loadTribes(guild.id);

        // 1. Identificar mi tribu
        let myTribeName = null, myTribeData = null;
        for (const [name, data] of Object.entries(tribes)) {
            const member = data.members.find(m => m.discordId === interaction.user.id);
            if (member) {
                myTribeName = name; myTribeData = data;
                if (member.rango !== 'Líder') return interaction.reply({ content: '❌ Solo el Líder gestiona la diplomacia.', ephemeral: true });
                break;
            }
        }

        if (!myTribeData) return interaction.reply({ content: '❌ No tienes tribu.', ephemeral: true });
        
        // 2. Validar objetivo
        const targetTribeData = tribes[targetName];
        if (!targetTribeData) return interaction.reply({ content: '❌ La tribu objetivo no existe.', ephemeral: true });
        if (myTribeName === targetName) return interaction.reply({ content: '❌ No puedes interactuar contigo mismo.', ephemeral: true });

        await interaction.deferReply();

        // ==================================================================
        // 🕊️ ALIANZA (SOLICITUD) - (No guarda en DB, solo envía mensaje)
        // ==================================================================
        if (subcommand === 'alianza') {
            if (myTribeData.alliances?.includes(targetName)) return interaction.editReply('❌ Ya sois aliados.');

            const maxAlliances = config.limits?.max_alliances || 0;
            if (maxAlliances > 0 && (myTribeData.alliances?.length || 0) >= maxAlliances) return interaction.editReply('❌ Tu tribu ha alcanzado el límite de alianzas.');

            const targetChannel = guild.channels.cache.get(targetTribeData.channelId);
            if (!targetChannel) return interaction.editReply('❌ La tribu objetivo no tiene canal configurado.');

            const requestEmbed = new EmbedBuilder()
                .setTitle('🕊️ Solicitud de Alianza')
                .setDescription(`La tribu **${myTribeName}** propone una alianza oficial.`)
                .setColor('Blue')
                .setFooter({ text: 'El líder debe decidir.' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`diplo_accept_${myTribeName}`).setLabel('✅ Aceptar').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`diplo_deny_${myTribeName}`).setLabel('❌ Rechazar').setStyle(ButtonStyle.Danger)
            );

            await targetChannel.send({ content: `👑 Atención Líder de **${targetName}**:`, embeds: [requestEmbed], components: [row] });

            return interaction.editReply(`✅ **Solicitud Enviada.**\nEstado: ⏳ **Pendiente** de respuesta por **${targetName}**.`);
        }

        // ==================================================================
        // 💔 ROMPER ALIANZA (NUEVO)
        // ==================================================================
        if (subcommand === 'romper_alianza') {
            if (!myTribeData.alliances || !myTribeData.alliances.includes(targetName)) {
                return interaction.editReply(`❌ No tienes una alianza con **${targetName}**.`);
            }

            let deletedChannel = false;
            if (myTribeData.allianceChannels) {
                const entryIdx = myTribeData.allianceChannels.findIndex(x => x.with === targetName);
                
                if (entryIdx !== -1) {
                    const chId = myTribeData.allianceChannels[entryIdx].channelId;
                    const ch = guild.channels.cache.get(chId);
                    if (ch) { 
                        await ch.delete('Alianza rota').catch(()=>{}); 
                        deletedChannel = true; 
                    }
                    myTribeData.allianceChannels.splice(entryIdx, 1);
                }
            }

            // Actualizar arrays
            myTribeData.alliances = myTribeData.alliances.filter(t => t !== targetName);
            
            if (targetTribeData.alliances) {
                targetTribeData.alliances = targetTribeData.alliances.filter(t => t !== myTribeName);
            }
            
            if (targetTribeData.allianceChannels) {
                targetTribeData.allianceChannels = targetTribeData.allianceChannels.filter(x => x.with !== myTribeName);
            }

            // ⚠️ AQUÍ ESTÁ EL CAMBIO: Guardamos las dos tribus por separado
            saveTribe(guild.id, myTribeName, myTribeData);
            saveTribe(guild.id, targetName, targetTribeData);

            await logToTribe(guild, targetTribeData, '💔 Alianza Rota', `La tribu **${myTribeName}** ha roto la alianza.\nEl canal compartido ha sido eliminado.`, 'Red');
            await logToTribe(guild, myTribeData, '💔 Alianza Rota', `Habéis roto la alianza con **${targetName}**.`, 'Red');

            return interaction.editReply(`✅ Has roto la alianza con **${targetName}**. ${deletedChannel ? '(Canal eliminado)' : ''}`);
        }

        // ==================================================================
        // ⚔️ GUERRA (DECLARACIÓN Y CANAL)
        // ==================================================================
        if (subcommand === 'guerra') {
            if (!myTribeData.wars) myTribeData.wars = [];
            if (myTribeData.wars.includes(targetName)) return interaction.editReply('❌ Ya estáis en guerra con ellos.');

            const catTribes = config.categories.tribes;
            const myRole = guild.roles.cache.find(r => r.name === myTribeName);
            const targetRole = guild.roles.cache.find(r => r.name === targetName);

            if (!myRole || !targetRole) return interaction.editReply('❌ Error buscando roles de tribu.');

            const channelName = `⚔️・${myTribeName.substring(0,6)}vs${targetName.substring(0,6)}`.toLowerCase().replace(/[^a-z0-9\-\u{2694}]/gu, '');
            let warChannel = null;

            try {
                warChannel = await guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText,
                    parent: catTribes,
                    topic: `Zona de Guerra: ${myTribeName} vs ${targetName}`,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: myRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                        { id: targetRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                        { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel] }
                    ]
                });
            } catch (e) { console.error(e); }

            myTribeData.wars.push(targetName);
            if (!targetTribeData.wars) targetTribeData.wars = [];
            targetTribeData.wars.push(myTribeName);
            
            if (!myTribeData.warChannels) myTribeData.warChannels = [];
            if (warChannel) myTribeData.warChannels.push({ with: targetName, channelId: warChannel.id });

            // ⚠️ CAMBIO: Guardamos ambas tribus por separado
            saveTribe(guild.id, myTribeName, myTribeData);
            saveTribe(guild.id, targetName, targetTribeData);

            if (warChannel) await warChannel.send(`⚔️ **GUERRA DECLARADA**\n**${myTribeName}** 🆚 **${targetName}**\nQue gane el mejor.`);
            
            await logToTribe(guild, targetTribeData, '⚔️ Declaración de Guerra', `🚨 **${myTribeName}** os ha declarado la GUERRA.\nSe ha abierto un canal de conflicto: ${warChannel}`, '#8B0000');
            await logToTribe(guild, myTribeData, '⚔️ Guerra Iniciada', `Habéis declarado la guerra a **${targetName}**.\nCanal de conflicto: ${warChannel}`, '#8B0000');

            const alertChannel = config.channels.log ? guild.channels.cache.get(config.channels.log) : null;
            if (alertChannel) await alertChannel.send(`🔥 **CONFLICTO:** La tribu **${myTribeName}** ha declarado la guerra a **${targetName}**.`);

            return interaction.editReply(`⚔️ Guerra declarada correctamente.`);
        }

        // ==================================================================
        // 🏳️ PAZ (RETIRAR GUERRA)
        // ==================================================================
        if (subcommand === 'paz') {
            if (!myTribeData.wars || !myTribeData.wars.includes(targetName)) return interaction.editReply('❌ No estáis en guerra con esa tribu.');

            myTribeData.wars = myTribeData.wars.filter(t => t !== targetName);
            if (targetTribeData.wars) targetTribeData.wars = targetTribeData.wars.filter(t => t !== myTribeName);

            let deletedChannel = false;
            if (myTribeData.warChannels) {
                const entryIdx = myTribeData.warChannels.findIndex(x => x.with === targetName);
                if (entryIdx !== -1) {
                    const chId = myTribeData.warChannels[entryIdx].channelId;
                    const ch = guild.channels.cache.get(chId);
                    if (ch) { await ch.delete('Tratado de Paz').catch(()=>{}); deletedChannel = true; }
                    myTribeData.warChannels.splice(entryIdx, 1);
                }
            }
            if (targetTribeData.warChannels) {
                targetTribeData.warChannels = targetTribeData.warChannels.filter(x => x.with !== myTribeName);
            }

            // ⚠️ CAMBIO: Guardamos ambas tribus por separado
            saveTribe(guild.id, myTribeName, myTribeData);
            saveTribe(guild.id, targetName, targetTribeData);

            await logToTribe(guild, targetTribeData, '🏳️ Tratado de Paz', `**${myTribeName}** ha retirado la declaración de guerra.`, '#FFFFFF');
            await logToTribe(guild, myTribeData, '🏳️ Paz Firmada', `Habéis finalizado la guerra con **${targetName}**.`, '#FFFFFF');

            return interaction.editReply(`🏳️ Se ha firmado la paz con **${targetName}**. ${deletedChannel ? '(Canal borrado)' : ''}`);
        }

        // ==================================================================
        // 🔥 RAIDEO (INICIO) - (No requiere cambios de DB)
        // ==================================================================
        if (subcommand === 'raideo') {
            const alertChannel = config.channels.log ? guild.channels.cache.get(config.channels.log) : interaction.channel;
            const embed = new EmbedBuilder().setTitle('🔥 ¡ALERTA DE RAID! 🔥').setColor('#FF4500').setDescription(`🚨 **${myTribeName}** está atacando a **${targetName}**.`).setImage('https://media.giphy.com/media/3o7TKGMslz2YfhkuwU/giphy.gif');
            if (alertChannel) await alertChannel.send({ content: '@here', embeds: [embed] });

            await logToTribe(guild, targetTribeData, '🚨 ¡ESTÁIS SIENDO RAIDEADOS!', `La tribu **${myTribeName}** ha iniciado un ataque.\n¡Todos a defender!`, '#FF0000');
            await logToTribe(guild, myTribeData, '🔥 Raid Iniciado', `Ataque a **${targetName}** en curso.`, '#FF4500');

            return interaction.editReply(`🔥 Raid declarado a **${targetName}**. Todo el servidor ha sido alertado.`);
        }

        // ==================================================================
        // 🏁 FIN RAID (REPORTE) - (No requiere cambios de DB)
        // ==================================================================
        if (subcommand === 'fin_raid') {
            const result = interaction.options.getString('resultado');
            const isSuccess = result === 'exito';

            const color = isSuccess ? '#00FF00' : '#808080';
            const title = isSuccess ? '✅ Raid Exitoso' : '❌ Raid Fallido / Retirada';
            const descMy = isSuccess ? `Habéis wipeado/rooteado a **${targetName}**.` : `No se logró el objetivo contra **${targetName}**.`;
            const descTarget = isSuccess ? `**${myTribeName}** ha declarado el raid como **EXITOSO** (Daños graves).` : `**${myTribeName}** se ha retirado o ha fallado el ataque.`;

            await logToTribe(guild, myTribeData, title, descMy, color);
            await logToTribe(guild, targetTribeData, '🏁 Fin del Ataque', descTarget, color);

            return interaction.editReply(`🏁 Reporte de raid enviado: **${isSuccess ? 'Éxito' : 'Fallido'}**.`);
        }
    }
};
