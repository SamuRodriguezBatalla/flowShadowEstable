const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.GuildBanRemove,
    async execute(ban) {
        // ban contiene: { user, guild, reason }
        const { user, guild } = ban;

        console.log(`🔓 [Evento] Desbaneo detectado: ${user.tag} en ${guild.name}`);

        try {
            const embed = new EmbedBuilder()
                .setTitle('🕊️ Has sido Desbaneado')
                .setColor('#00FF00') // Verde brillante
                .setDescription(`Tu veto en el servidor **${guild.name}** ha sido revocado.`)
                .addFields(
                    { name: '📝 Estado', value: 'Ya puedes intentar unirte de nuevo.', inline: false },
                    { name: '📅 Fecha', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                )
                .setFooter({ text: 'Sistema de Notificación Automática' })
                .setTimestamp();

            await user.send({ embeds: [embed] });
            console.log(`✅ MD enviado a ${user.tag} confirmando desbaneo.`);
            
        } catch (error) {
            // El error 50007 es "Cannot send messages to this user" (MD cerrado o sin server común)
            if (error.code === 50007) {
                console.log(`⚠️ No se pudo enviar MD a ${user.tag} (MD cerrados o sin servidor en común).`);
            } else {
                console.error(`❌ Error enviando MD de desbaneo: ${error.message}`);
            }
        }
    },
};
