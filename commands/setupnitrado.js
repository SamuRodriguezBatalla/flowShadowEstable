const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
// 👇 AÑADIMOS 'deleteNitradoConfig' a los imports
const { saveNitradoConfig, addNitradoServer, getNitradoServers, deleteNitradoConfig } = require('../utils/dataManager');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setupnitrado')
        .setDescription('Gestión de la conexión con Nitrado.')
        // 👇 SUBCOMANDO 1: VINCULAR (La lógica original)
        .addSubcommand(s => s
            .setName('vincular')
            .setDescription('🔗 Conecta tu cuenta usando el Token API.')
            .addStringOption(o => o.setName('token').setDescription('Tu Token API').setRequired(true)))
        // 👇 SUBCOMANDO 2: DESVINCULAR (Nuevo)
        .addSubcommand(s => s
            .setName('desvincular')
            .setDescription('🔌 Borra los datos de conexión con Nitrado.'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Detectamos qué subcomando se usó
        const subcommand = interaction.options.getSubcommand();

        // ======================================================
        // 🔌 CASO DESVINCULAR
        // ======================================================
        if (subcommand === 'desvincular') {
            await interaction.deferReply({ ephemeral: true });
            
            // Borramos la config de la base de datos
            deleteNitradoConfig(interaction.guild.id);
            
            return interaction.editReply('🔌 **Desvinculación completada.**\nSe han borrado el Token y los datos de la cuenta Nitrado de este servidor.');
        }

        // ======================================================
        // 🔗 CASO VINCULAR (Tu código original adaptado)
        // ======================================================
        if (subcommand === 'vincular') {
            await interaction.deferReply({ ephemeral: true });
            const token = interaction.options.getString('token');
            const guildId = interaction.guild.id;

            try {
                // 1. Obtener servicios de la cuenta
                const res = await axios.get('https://api.nitrado.net/services', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                const services = res.data.data.services;
                if (!services || services.length === 0) {
                    return interaction.editReply('❌ Token válido, pero no hay servidores en esta cuenta.');
                }

                // 2. Filtrar solo los que sean juegos (Gameservers)
                const gameServers = services.filter(s => s.type === 'gameserver');

                if (gameServers.length === 0) return interaction.editReply('❌ No se encontraron servidores de juego activos.');

                // 3. Guardar Token Global
                saveNitradoConfig(guildId, token, services[0].username);

                // 4. Guardar cada servidor encontrado en la DB
                let msg = `✅ **¡Conexión Exitosa!**\n👤 Usuario: ${services[0].username}\n\n**Servidores detectados y vinculados:**\n`;
                
                for (const s of gameServers) {
                    const sName = s.details.name || `Ark-${s.id}`;
                    addNitradoServer(guildId, sName, s.id);
                    msg += `🦖 **${sName}** (ID: ${s.id})\n`;
                }

                msg += `\nAhora puedes usar comandos como \`/arkrestart\` o \`/online\` seleccionando el mapa específico.`;

                return interaction.editReply(msg);

            } catch (error) {
                console.error(error);
                return interaction.editReply('❌ Token inválido o error de conexión con Nitrado.');
            }
        }
    },
};
