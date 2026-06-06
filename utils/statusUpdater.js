const { EmbedBuilder } = require('discord.js');
const { getStatusPanel } = require('./dataManager');
const { getGlobalStatus } = require('./serverManager'); // <--- USAMOS EL NUEVO GESTOR

async function updateStatusPanels(client) {
    for (const guild of client.guilds.cache.values()) {
        try {
            // 1. Verificar configuración
            const panelData = getStatusPanel(guild.id);
            if (!panelData) continue;

            const channel = await guild.channels.fetch(panelData.channel_id).catch(() => null);
            if (!channel) continue;

            const message = await channel.messages.fetch(panelData.message_id).catch(() => null);
            if (!message) continue;

            // 2. Obtener datos UNIFICADOS (RCON + Nitrado)
            const serversStatus = await getGlobalStatus(guild.id);
            
            if (serversStatus.length === 0) {
                await message.edit({ embeds: [new EmbedBuilder().setTitle('📡 Estado').setDescription('❌ No hay servidores vinculados (/setupark o /setupnitrado).').setColor('Red')] });
                continue;
            }

            // 3. Construir Embed
            const embed = new EmbedBuilder()
                .setTitle('🦕 Estado del Cluster Ark (Cross-Platform)')
                .setColor('#00BFFF')
                .setThumbnail(guild.iconURL())
                .setFooter({ text: 'Actualizado automáticamente • FlowShadow' })
                .setTimestamp();

            let totalOnline = 0;

            for (const s of serversStatus) {
                let statusIcon = s.online ? '🟢' : '🔴';
                let statusText = s.online ? 'En Línea' : 'Offline';
                let playersText = 'Sin jugadores';
                let typeIcon = s.type === 'RCON' ? '💻' : '🎮'; // Icono PC vs Consola

                if (s.online) {
                    totalOnline += s.playerCount;
                    if (s.playerCount > 0) {
                        const displayNames = s.playerList.slice(0, 10).map(name => `👤 ${name}`);
                        playersText = displayNames.join('\n');
                        if (s.playerCount > 10) playersText += `\n... y ${s.playerCount - 10} más`;
                    }
                } else {
                    playersText = '-';
                }

                embed.addFields({
                    name: `${statusIcon} ${s.name} [${typeIcon}]`,
                    value: `**Estado:** ${statusText}\n**Jugadores:** ${s.playerCount}\n\n${playersText}`,
                    inline: true
                });
            }

            embed.setDescription(`🌍 **Jugadores Totales en Cluster:** ${totalOnline}`);

            await message.edit({ embeds: [embed] });

        } catch (e) {
            console.error(`Error actualizando status en ${guild.name}:`, e.message);
        }
    }
}

module.exports = { updateStatusPanels };