const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// 🔒 TU ID REAL (Ponte la tuya)
const OWNER_ID = '749826568477474888'; 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setupsoporte')
        .setDescription('🔒 ADMIN: Despliega el servidor de soporte con Sistema de Tickets y Cobros.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: '⛔ Solo el creador puede usar esto.', ephemeral: true });
        }

        await interaction.deferReply();
        const guild = interaction.guild;

        const NAMES = {
            roles: { dev: '👑 Desarrollador', client: 'Cliente' },
            categories: { info: '📢 CENTRO DE INFORMACIÓN', support: '🆘 SOPORTE TÉCNICO', admin: '🔐 ADMINISTRACIÓN' },
            channels: { 
                welcome: '👋・bienvenida', prices: '💸・precios', bugs: '🐛・reporte-bugs', help: 'sos・ayuda', 
                logs: 'logs-errores', 
                alerts: '🔔・alertas-pagos' // <--- TU CANAL PRIVADO DE COBROS
            }
        };

        try {
            // Roles
            let devRole = guild.roles.cache.find(r => r.name === NAMES.roles.dev);
            if (!devRole) devRole = await guild.roles.create({ name: NAMES.roles.dev, color: '#FF0000', hoist: true });
            
            // Categorías
            const catInfo = await guild.channels.create({ name: NAMES.categories.info, type: ChannelType.GuildCategory });
            const catSupport = await guild.channels.create({ name: NAMES.categories.support, type: ChannelType.GuildCategory });
            
            // Categoría Admin (Privada)
            const catAdmin = await guild.channels.create({ 
                name: NAMES.categories.admin, type: ChannelType.GuildCategory,
                permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: devRole.id, allow: [PermissionFlagsBits.ViewChannel] }]
            });

            // Canales Info
            const chWelcome = await guild.channels.create({ name: NAMES.channels.welcome, parent: catInfo.id });
            await chWelcome.send({ embeds: [new EmbedBuilder().setTitle('👋 Bienvenido').setDescription('Soporte Oficial.').setColor('Blue')] });

            const chPrices = await guild.channels.create({ name: NAMES.channels.prices, parent: catInfo.id });
            await chPrices.send({ embeds: [new EmbedBuilder().setTitle('💸 Servicios').setDescription('Consulta precios por Ticket.').setColor('Gold')] });

            // Canal Ayuda con Botón
            const chHelp = await guild.channels.create({ name: NAMES.channels.help, parent: catSupport.id });
            const ticketButton = new ButtonBuilder().setCustomId('create_ticket').setLabel('📩 Abrir Ticket').setStyle(ButtonStyle.Primary).setEmoji('🎫');
            const row = new ActionRowBuilder().addComponents(ticketButton);

            await chHelp.send({
                embeds: [new EmbedBuilder().setTitle('🆘 Atención al Cliente').setDescription('Pulsa el botón para abrir ticket.').setColor('Green')],
                components: [row]
            });

            // Canales Admin
            await guild.channels.create({ name: NAMES.channels.logs, parent: catAdmin.id });
            
            // CANAL DE ALERTAS DE PAGO (Solo tú lo ves)
            const chAlerts = await guild.channels.create({ name: NAMES.channels.alerts, parent: catAdmin.id });
            await chAlerts.send('💰 **Centro de Facturación:** Aquí recibirás avisos cada 30 días de clientes que deben renovar.');

            await interaction.editReply('✅ **Sede de Soporte Lista.** Canal de alertas de pago creado.');

        } catch (error) {
            console.error(error);
            await interaction.editReply(`❌ Error: ${error.message}`);
        }
    },
};