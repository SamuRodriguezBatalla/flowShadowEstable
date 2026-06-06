const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ayudanitrado')
        .setDescription('🆘 Te enseña cómo conseguir tu Token para conectar el servidor.'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🔑 Cómo conseguir tu Token de Nitrado')
            .setColor('#F7C600') // Color amarillo Nitrado
            .setDescription('Para que el bot pueda reiniciar o ver tu servidor de consola, necesitas un **Token**.\n\n' +
                '**Paso 1:** Haz clic en el botón de abajo para ir a Nitrado.\n' +
                '**Paso 2:** Inicia sesión si no lo has hecho.\n' +
                '**Paso 3:** En "Create new token", ponle nombre (Ej: `Bot`) y marca todas las casillas.\n' +
                '**Paso 4:** Copia el código largo que aparece.\n' +
                '**Paso 5:** Vuelve aquí y usa el comando:\n`/setupnitrado token: TU_CÓDIGO_AQUÍ`')
            .setImage('https://i.imgur.com/EjemploDeDondeClicar.png'); // <--- Opcional: Pon una foto tuya indicando dónde es

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('🔗 Ir a Generar Token')
                .setStyle(ButtonStyle.Link)
                .setURL('https://server.nitrado.net/usa/developer/tokens') 
        );

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    },
};