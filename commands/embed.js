const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('📢 Crea y envía un mensaje Embed personalizado.')
        .addStringOption(option => 
            option.setName('descripcion')
                .setDescription('El texto principal del mensaje (Soporta saltos de línea con \\n).')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('titulo')
                .setDescription('Título del mensaje (Opcional).'))
        .addStringOption(option => 
            option.setName('color')
                .setDescription('Color (Hex: #FF0000 o Nombre: Blue, Red, Gold).'))
        .addChannelOption(option => 
            option.setName('canal')
                .setDescription('Canal donde enviar el mensaje (Opcional, por defecto: aquí).')
                .addChannelTypes(ChannelType.GuildText))
        .addAttachmentOption(option => 
            option.setName('imagen')
                .setDescription('Adjuntar una imagen grande (Banner).'))
        .addAttachmentOption(option => 
            option.setName('thumbnail')
                .setDescription('Adjuntar una imagen pequeña (Miniatura derecha).'))
        .addStringOption(option => 
            option.setName('footer')
                .setDescription('Texto pequeño al pie del mensaje.'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // 1. Obtener datos
        const description = interaction.options.getString('descripcion');
        const title = interaction.options.getString('titulo');
        const colorInput = interaction.options.getString('color') || '#9D00FF'; // Morado FlowShadow por defecto
        const channel = interaction.options.getChannel('canal') || interaction.channel;
        const image = interaction.options.getAttachment('imagen');
        const thumbnail = interaction.options.getAttachment('thumbnail');
        const footerText = interaction.options.getString('footer');

        // Procesar saltos de línea literales si el usuario escribe \n
        const processedDescription = description.replace(/\\n/g, '\n');

        // 2. Construir el Embed
        const embed = new EmbedBuilder()
            .setDescription(processedDescription)
            .setColor(colorInput);

        if (title) embed.setTitle(title);
        if (image) embed.setImage(image.url);
        if (thumbnail) embed.setThumbnail(thumbnail.url);
        if (footerText) embed.setFooter({ text: footerText });
        
        // Añadir timestamp (fecha/hora) siempre queda profesional
        embed.setTimestamp();

        // 3. Enviar
        try {
            await channel.send({ embeds: [embed] });

            // Confirmación silenciosa para el admin
            await interaction.reply({ 
                content: `✅ Mensaje enviado correctamente al canal ${channel}.`, 
                ephemeral: true 
            });

        } catch (error) {
            console.error(error);
            await interaction.reply({ 
                content: `❌ Error al enviar el mensaje. Verifica que tengo permisos en ese canal.\nError: ${error.message}`, 
                ephemeral: true 
            });
        }
    },
};