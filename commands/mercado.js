const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mercado')
        .setDescription('Publica ofertas de compra o venta.')
        .addSubcommand(s => s.setName('venta').setDescription('Vender un objeto/dino.')
            .addStringOption(o => o.setName('articulo').setDescription('Qué vendes').setRequired(true))
            .addStringOption(o => o.setName('precio').setDescription('Precio (ej: 500 Lingotes)').setRequired(true))
            .addStringOption(o => o.setName('descripcion').setDescription('Detalles extra').setRequired(false))
            .addAttachmentOption(o => o.setName('foto').setDescription('Foto').setRequired(false)))
        .addSubcommand(s => s.setName('compra').setDescription('Buscar un objeto/dino.')
            .addStringOption(o => o.setName('articulo').setDescription('Qué buscas').setRequired(true))
            .addStringOption(o => o.setName('oferta').setDescription('Qué ofreces').setRequired(true))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const item = interaction.options.getString('articulo');
        const price = interaction.options.getString('precio') || interaction.options.getString('oferta');
        const desc = interaction.options.getString('descripcion') || 'Sin descripción.';
        const img = interaction.options.getAttachment('foto');

        await interaction.deferReply();

        const embed = new EmbedBuilder()
            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        if (sub === 'venta') {
            embed.setTitle('📦 OFERTA DE VENTA')
            embed.setColor('#00FF00')
            embed.addFields(
                { name: '🏷️ Artículo', value: item, inline: true },
                { name: '💰 Precio', value: price, inline: true },
                { name: '📝 Detalles', value: desc, inline: false }
            );
        } else {
            embed.setTitle('🔍 SOLICITUD DE COMPRA')
            embed.setColor('#3498DB')
            embed.addFields(
                { name: '🔎 Busco', value: item, inline: true },
                { name: '💵 Pago', value: price, inline: true }
            );
        }

        if (img) embed.setImage(img.url);

        // BOTÓN INTERACTIVO CON ID DEL VENDEDOR
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`market_contact_${interaction.user.id}`) // Guardamos ID del vendedor
                .setLabel('📩 Contactar / Negociar')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🤝')
        );

        await interaction.editReply({ content: `📢 **Mercado Ark:**`, embeds: [embed], components: [row] });
    },
};
