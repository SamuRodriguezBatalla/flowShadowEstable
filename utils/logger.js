const { EmbedBuilder } = require('discord.js');
const { loadTribes, loadGuildConfig } = require('./dataManager');
const { BAN_THRESHOLD } = require('./constants');

async function updateLog(guild, client) {
    const config = loadGuildConfig(guild.id);
    if (!config || !config.channels.log) return;

    const logChannel = guild.channels.cache.get(config.channels.log);
    if (!logChannel) return;

    const tribes = loadTribes(guild.id);
    const sorted = Object.keys(tribes).sort();
    const embeds = [];
    const ITEMS = 25;

    // Generar páginas de logs
    for (let i = 0; i < Math.ceil(sorted.length / ITEMS); i++) {
        const embed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setTitle(`📜 Registro Tribus | Pág ${i+1}`)
            .setTimestamp();
            
        const chunk = sorted.slice(i*ITEMS, (i+1)*ITEMS);

        for (const tName of chunk) {
            const t = tribes[tName];
            const tWarns = t.warnings || 0;
            
            const list = t.members.map(m => {
                const tot = (m.warnings||0) + tWarns;
                const risk = tot >= BAN_THRESHOLD ? '🚨' : '';
                // 👇 AQUÍ ESTÁ EL CAMBIO: AÑADIDO ESTADO DEL KIT
                const kitStatus = m.hasKit ? '✅' : '❌';
                
                return `> ${m.rango==='Líder'?'👑':'👤'} **${m.username}** | Kit: ${kitStatus} | Warns: ${tot} ${risk}`;
            }).join('\n');
            
            embed.addFields({ name: `🛡️ ${tName} (Warns: ${tWarns})`, value: list || 'Vacía', inline: false });
        }
        embeds.push(embed);
    }

    // Lógica de envío (Borrar anterior y enviar nuevo)
    try {
        const msgs = await logChannel.messages.fetch({ limit: 10 });
        const myMsgs = msgs.filter(m => m.author.id === client.user.id);
        if (myMsgs.size > 0) await logChannel.bulkDelete(myMsgs);

        if (embeds.length > 0) {
            for (const embed of embeds) await logChannel.send({ embeds: [embed] });
        } else {
            await logChannel.send({ 
                embeds: [new EmbedBuilder()
                    .setTitle('📜 Registro de Tribus')
                    .setDescription('*La base de datos está vacía actualmente.*')
                    .setColor('Grey')
                ]
            });
        }
    } catch (e) { console.error("Error en updateLog:", e.message); }
}

module.exports = { updateLog };
