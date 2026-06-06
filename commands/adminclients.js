const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getAllPremiumGuilds } = require('../utils/dataManager');
require('dotenv').config();

// 🔒 TU ID REAL
const OWNER_ID = process.env.OWNER_ID; 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('adminclients')
        .setDescription('🔒 ADMIN: Muestra la tabla de clientes y su estado.'),

    async execute(interaction) {
        // 1. SEGURIDAD: Solo tú puedes ver esto
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: '⛔ Acceso denegado.', ephemeral: true });
        }

        // 2. OBTENER DATOS
        const clients = getAllPremiumGuilds(); 

        if (!clients || clients.length === 0) {
            return interaction.reply({ content: '📂 La base de datos de clientes está vacía.', ephemeral: true });
        }

        // 3. CONSTRUIR LA TABLA MEJORADA
        // Ajustamos el header para incluir la columna de Servidor
        let tableHeader = "CLIENTE          | SERVIDOR         | TIPO      | DÍAS\n";
        let separator   = "------------------------------------------------------\n";
        let tableBody   = "";

        const now = Date.now();
        let totalIncomeEstimado = 0; 

        clients.forEach(client => {
            // A. Cálculo de días activos
            const daysActive = Math.floor((now - client.added_at) / (1000 * 60 * 60 * 24));
            
            // B. Formateo de Cliente (Cortar a 15 chars y rellenar espacios)
            const clientName = (client.client_name || "Desconocido").substring(0, 15).padEnd(16, ' ');
            
            // C. Obtener Nombre del Servidor (NUEVO)
            const guildObj = interaction.client.guilds.cache.get(client.guild_id);
            // Si el bot está dentro, usa el nombre. Si no, pone "Bot Fuera"
            const rawServerName = guildObj ? guildObj.name : "❌ (Bot Fuera)";
            const serverName = rawServerName.substring(0, 15).padEnd(16, ' ');

            // D. Tipo de Licencia
            const type = client.is_unlimited === 1 ? "♾️ VIP " : "📅 Mes ";
            
            // E. Contador visual de ingresos (solo mensuales)
            if (client.is_unlimited === 0) totalIncomeEstimado++;

            const days = `${daysActive}d`.padEnd(4, ' ');
            
            // F. Construir fila
            tableBody += `${clientName} | ${serverName} | ${type} | ${days}\n`;
        });

        // Recorte de seguridad por si tienes muchísimos clientes
        if (tableBody.length > 3500) {
            tableBody = tableBody.substring(0, 3500) + "\n... (Lista truncada, hay demasiados clientes)";
        }

        // 4. ENVIAR EMBED
        const embed = new EmbedBuilder()
            .setTitle('📂 Cartera de Clientes FlowShadow')
            .setColor('Gold')
            .setDescription(`\`\`\`text\n${tableHeader}${separator}${tableBody}\`\`\``)
            .addFields(
                { name: '📊 Resumen', value: `Total Clientes: **${clients.length}**\nDe pago mensual: **${totalIncomeEstimado}**`, inline: true },
                { name: '🧠 Estado', value: 'Base de datos local (SQLite)', inline: true }
            )
            .setFooter({ text: 'Informe de Administración' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
