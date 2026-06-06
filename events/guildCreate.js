const { Events, EmbedBuilder, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// 👇 ENLACE DE SOPORTE (Configura esto con tu link real)
const SUPPORT_INVITE_LINK = 'https://discord.gg/pBPRS64GKq';

module.exports = {
    name: Events.GuildCreate,
    async execute(guild) {
        // 1. Buscar el mejor canal de texto para enviar el mensaje (System o General)
        let channel = guild.systemChannel;
        
        if (!channel) {
            channel = guild.channels.cache.find(c => 
                c.type === ChannelType.GuildText && 
                c.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages)
            );
        }

        // 2. Obtener Avatar en Alta Calidad
        const botAvatarUrl = guild.client.user.displayAvatarURL({ size: 1024, forceStatic: false });

        // 3. Botón de Soporte Técnico
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('🛠️ Soporte Técnico')
                .setStyle(ButtonStyle.Link)
                .setURL(SUPPORT_INVITE_LINK)
        );

        // 4. EMBED MAESTRO: MANUAL DE CAPACIDADES COMPLETO
        const welcomeEmbed = new EmbedBuilder()
            .setColor('#9D00FF') // Morado Premium FlowShadow
            .setTitle(`✅ SISTEMA FLOWSHADOW INSTALADO EN: ${guild.name.toUpperCase()}`)
            .setDescription(`**Gracias por adquirir la licencia de FlowShadow.**
            A continuación se detalla la **lista completa de comandos** y capacidades del sistema.
            
            ⚠️ **Primer paso obligatorio:** Ejecuta \`/setup\` para crear la estructura base.`)
            .setThumbnail(botAvatarUrl)
            .addFields(
                { 
                    name: '⚙️ 1. Configuración y Estructura (Admins)', 
                    value: `\`setup\` - Crea roles, categorías y canales esenciales.
                    \`setupark\` - Vincula servidor PC (RCON).
                    \`setupnitrado\` - Vincula servidor Consola (API).
                    \`setupstatus\` - Crea el panel de estado en vivo.
                    \`adminconfig\` - **Configura límites:** Máx. miembros por tribu y Máx. alianzas.
                    \`syncchannels\` - Repara canales de registro perdidos.
                    \`fixroles\` - Asigna rol "No Verificado" a usuarios sin rol.
                    \`unlinkark\` / \`setupnitrado desvincular\` - Borra datos de conexión.`
                },
                { 
                    name: '🛡️ 2. Moderación y Sanciones (Staff)', 
                    value: `\`warn\` / \`unwarn\` - Sistema de advertencias (acumulables).
                    \`mute\` / \`unmute\` - Silencia a un usuario o **tribu entera** en Discord.
                    \`kick\` - Expulsa a un jugador del servidor de Ark.
                    \`arkban\` / \`arkunban\` - Baneo de Ark (Temporal/Perm/Season).
                    \`permaban\` / \`unpermaban\` - **Lista Negra:** Ban permanente de Discord + Ark.
                    \`banlist\` - Muestra la lista de baneados activos.
                    \`checkid\` - **Anti-Multicuentas:** Detecta IDs de juego duplicadas.
                    \`setid\` / \`editid\` - Modifica manualmente la ID registrada de un usuario.
                    \`createprotected\` - Crea roles inmunes al Wipe.`
                },
                { 
                    name: '🦖 3. Gestión del Servidor y Wipes', 
                    value: `\`arkrestart\` - Reinicio seguro (SaveWorld + DoExit / API Restart).
                    \`arkbroadcast\` - Mensaje global en pantalla a todos los servidores.
                    \`rcon\` / \`console\` - Ejecuta comandos de administrador (Cheats) desde Discord.
                    \`newseason\` - **Nueva Temporada:** Archiva tribus, borra canales, limpia warns.
                    \`fullwipe\` - **Reinicio Total:** Borra todo y vuelve a Season 0.
                    \`historycheck\` - Consulta datos de tribus de seasons pasadas.
                    \`nuke\` - Borra y recrea un canal de texto.
                    \`clear\` - Borra mensajes masivamente.`
                },
                { 
                    name: '🏕️ 4. Sistema de Tribus (Jugadores)', 
                    value: `\`tribu info\` - Ver estado de la tribu.
                    \`tribu checkin\` - **Vital:** Renueva la base (evita borrado automático en 7 días).
                    \`tribu votar\` - Elecciones democráticas para cambiar de líder.
                    \`tribu reclutar\` - Invitar miembros (crea roles y permisos).
                    \`tribu kick\` / \`ascender\` / \`rename\` - Gestión de líder.
                    \`tribeinfo\` - Ver ficha pública de otra tribu.
                    \`coords\` - Guardar/Listar coordenadas privadas de la tribu.`
                },
                { 
                    name: '⚔️ 5. Diplomacia y Economía', 
                    value: `\`diplomacia alianza\` - Crea canal compartido entre tribus.
                    \`diplomacia guerra\` / \`paz\` - Gestiona conflictos y canales de guerra.
                    \`diplomacia raideo\` - Alerta global de ataque en curso.
                    \`mercado\` - Sistema de compra/venta con tickets de negociación.
                    \`giveaway\` - Sistema de sorteos automáticos.`
                },
                { 
                    name: '👤 6. Utilidades Generales', 
                    value: `\`infoplayer\` - Ficha de usuario (ID, Warns, Kit).
                    \`kit\` - Admin marca si el usuario recibió su Starter Kit.
                    \`online\` - Lista de jugadores conectados en todo el cluster.
                    \`report\` - Formulario anónimo de reportes.
                    \`suggestvote\` - Encuestas de Sí/No.
                    \`soporte\` - Enlace al discord de ayuda.
                    \`ayudanitrado\` - Guía para obtener Token API.`
                }
            )
            .setImage(botAvatarUrl)
            .setFooter({ text: 'FlowShadow System • Enterprise Edition • Manual de Comandos' })
            .setTimestamp();

        // 5. Enviar mensaje
        try {
            if (channel) {
                await channel.send({ embeds: [welcomeEmbed], components: [row] });
            } else {
                const owner = await guild.fetchOwner();
                await owner.send({ content: `¡Hola! No encontré un canal donde presentarme en **${guild.name}**, así que te dejo el manual aquí:`, embeds: [welcomeEmbed], components: [row] });
            }
            console.log(`📥 [GuildCreate] FlowShadow desplegado en: ${guild.name} (ID: ${guild.id})`);
        } catch (error) {
            console.error(`❌ Error enviando mensaje de bienvenida en ${guild.name}:`, error.message);
        }
    },
};