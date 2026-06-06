const { EmbedBuilder } = require('discord.js');
const { loadTribes, saveTribe, getRegistrationState, loadGuildConfig, updateRegistrationState } = require('../utils/dataManager');
const { finalizarRegistro } = require('../utils/registrationHandler');

async function handleJoinRequest(interaction) {
    // 1. Cargar Configuración DINÁMICA del servidor actual
    const config = loadGuildConfig(interaction.guild.id);
    if (!config) return interaction.reply({ content: '❌ El servidor no está configurado. Usa /setup.', ephemeral: true });

    await interaction.deferUpdate();
    
    const parts = interaction.customId.split('_');
    const action = parts[1]; // accept / deny
    const targetUserId = parts[2];
    const regChannelId = parts[3];

    const guild = interaction.guild;
    const regChannel = guild.channels.cache.get(regChannelId);

    // Validaciones
    if (!regChannel) return interaction.followUp({ content: '❌ El canal de registro ya no existe (usuario se fue o borró canal).', ephemeral: true });
    
    const state = getRegistrationState(regChannelId);
    if (!state || state.step !== 10) return interaction.followUp({ content: '❌ Esta solicitud ha expirado o ya fue procesada.', ephemeral: true });

    // --- ACEPTAR ---
    if (action === 'accept') {
        const targetMember = await guild.members.fetch(targetUserId).catch(() => null);
        
        if (targetMember) {
            // [FIX] Cargar solo la tribu necesaria para evitar borrar datos de otros
            const tribes = loadTribes(guild.id);
            const tribeName = state.data_tribe;
            const targetTribe = tribes[tribeName];

            if (targetTribe) {
                // Finalizar registro (esto mueve roles y crea logs)
                await finalizarRegistro(targetMember, regChannel, state.data_id, state.data_tribe, config, false);
            } else {
                 return interaction.followUp({ content: '❌ La tribu ya no existe en la base de datos.', ephemeral: true });
            }
        } else {
             return interaction.followUp({ content: '❌ El usuario ya no está en el servidor.', ephemeral: true });
        }

        const embed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor('Green')
            .setTitle('✅ Solicitud Aceptada')
            .setDescription(`**${interaction.user.username}** ha aceptado a <@${targetUserId}>.`);
        
        await interaction.editReply({ components: [], embeds: [embed] });
    }

    // --- RECHAZAR ---
    if (action === 'deny') {
        // Devolver al usuario al paso de "Elegir Nombre"
        updateRegistrationState(regChannelId, 2, undefined, null);
        
        await regChannel.send(`❌ **Solicitud Rechazada.**\nLa tribu **${state.data_tribe}** ha denegado tu ingreso.\n\n🛡️ Por favor, escribe **otro nombre de tribu** para crear una nueva o unirte a otra.`);

        const embed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor('Red')
            .setTitle('❌ Solicitud Rechazada')
            .setDescription(`**${interaction.user.username}** ha rechazado a <@${targetUserId}>.`);
        
        await interaction.editReply({ components: [], embeds: [embed] });
    }
}

module.exports = { handleJoinRequest };