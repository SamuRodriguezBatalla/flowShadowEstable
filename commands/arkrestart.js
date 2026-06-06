const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { sendRconCommand } = require('../utils/rconManager');
const { getAllServers } = require('../utils/serverManager'); //
const { restartNitrado } = require('../utils/nitradoManager'); //

module.exports = {
    data: new SlashCommandBuilder()
        .setName('arkrestart')
        .setDescription('🔄 Reinicio Seguro de TODOS los servidores (RCON y Nitrado).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // 1. Botón de confirmación (Igual que antes)
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_restart').setLabel('🔴 SÍ, REINICIAR CLUSTER').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cancel_restart').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
        );

        const msg = await interaction.reply({ 
            content: '⚠️ **¿Estás seguro de reiniciar TODO el cluster?**\n- **PC (RCON):** Guardará mundo y ejecutará DoExit.\n- **Consola (Nitrado):** Enviará orden de reinicio forzado a la API.',
            components: [row],
            fetchReply: true
        });

        const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 15000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) return i.reply({ content: 'No puedes usar esto.', ephemeral: true });

            if (i.customId === 'cancel_restart') {
                await i.update({ content: '✅ Reinicio cancelado.', components: [] });
                return;
            }

            if (i.customId === 'confirm_restart') {
                await i.update({ content: '🔄 **Iniciando protocolo de reinicio global...**', components: [] });

                const servers = getAllServers(interaction.guild.id);
                let log = '';

                // Iteramos por cada servidor para aplicar el método correcto
                for (const server of servers) {
                    const sName = server.name || server.server_name;
                    
                    try {
                        if (server.type === 'RCON') {
                            // Protocolo PC
                            await sendRconCommand(interaction.guild.id, 'SaveWorld', sName);
                            // Esperamos un poco para asegurar guardado (importante en Ark)
                            await new Promise(r => setTimeout(r, 2000)); 
                            const res = await sendRconCommand(interaction.guild.id, 'DoExit', sName);
                            log += `💻 **${sName}:** ${res.success ? '✅ DoExit enviado' : '❌ Error RCON'}\n`;
                        } 
                        else if (server.type === 'NITRADO') {
                            // Protocolo Consola
                            const res = await restartNitrado(interaction.guild.id, 'Reinicio programado por Discord');
                            log += `🎮 **${sName}:** ${res.success ? '✅ Reiniciando (API)' : `❌ Error: ${res.message}`}\n`;
                        }
                    } catch (e) {
                        log += `⚠️ **${sName}:** Error inesperado: ${e.message}\n`;
                    }
                }

                await interaction.followUp(`🏁 **Informe de Reinicio:**\n\n${log}`);
            }
        });
    },
};