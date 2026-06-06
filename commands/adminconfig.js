const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { loadGuildConfig, saveGuildConfig } = require('../utils/dataManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('adminconfig')
        .setDescription('⚙️ Configuración avanzada del servidor (Límites y Reglas).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(s => s.setName('limite_tribu')
            .setDescription('Establece el número máximo de jugadores por tribu.')
            .addIntegerOption(o => o.setName('cantidad').setDescription('Número máximo (0 = Sin límite)').setRequired(true)))
        .addSubcommand(s => s.setName('limite_alianza')
            .setDescription('Establece el número máximo de alianzas por tribu.')
            .addIntegerOption(o => o.setName('cantidad').setDescription('Número máximo (0 = Sin límite)').setRequired(true))),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const config = loadGuildConfig(guildId);
        
        if (!config) return interaction.reply({ content: '❌ Ejecuta /setup primero.', ephemeral: true });

        // Inicializar objeto de límites si no existe
        if (!config.limits) config.limits = { max_tribe_members: 0, max_alliances: 0 };

        const sub = interaction.options.getSubcommand();
        const amount = interaction.options.getInteger('cantidad');

        if (sub === 'limite_tribu') {
            config.limits.max_tribe_members = amount;
            saveGuildConfig(guildId, config);
            
            return interaction.reply({ 
                embeds: [new EmbedBuilder()
                    .setColor('Green')
                    .setTitle('⚙️ Límite Actualizado')
                    .setDescription(`👥 **Máximo de Miembros por Tribu:** ${amount === 0 ? '∞ (Ilimitado)' : amount}`)
                ]
            });
        }

        if (sub === 'limite_alianza') {
            config.limits.max_alliances = amount;
            saveGuildConfig(guildId, config);

            return interaction.reply({ 
                embeds: [new EmbedBuilder()
                    .setColor('Green')
                    .setTitle('⚙️ Límite Actualizado')
                    .setDescription(`🤝 **Máximo de Alianzas por Tribu:** ${amount === 0 ? '∞ (Ilimitado)' : amount}`)
                ]
            });
        }
    }
};
