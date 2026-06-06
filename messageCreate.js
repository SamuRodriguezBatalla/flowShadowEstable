const { Events, MessageFlags, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { loadGuildConfig, loadTribes, saveTribes, isPremium } = require('../utils/dataManager');
const { iniciarRegistro } = require('./guildMemberAdd'); 

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // 0. Validaciones básicas
        if (message.author.bot || !message.guild) return;
        if (!isPremium(message.guild.id)) return;

        const guild = message.guild;
        const member = message.member;
        if (!member) return;

        const config = loadGuildConfig(guild.id);
        if (!config) return;

        const unverifiedRole = guild.roles.cache.get(config.roles.unverified);
        const survivorRole = config.roles.survivor ? guild.roles.cache.get(config.roles.survivor) : null;
        const leaderRole = config.roles.leader ? guild.roles.cache.get(config.roles.leader) : null;

        // ==================================================================
        // 🛡️ ESCUDO DE INMUNIDAD (PROTECCIÓN PARA ADMINS)
        // ==================================================================
        // Definimos quién es inmune a las restricciones y reseteos:
        // 1. Dueño del Servidor
        // 2. Tiene permisos de Administrador de Discord
        // 3. Tiene el rol de Admin configurado en el bot
        // 4. Tiene el rol de Staff configurado en el bot
        const isImmune = 
            member.id === guild.ownerId ||
            member.permissions.has(PermissionFlagsBits.Administrator) ||
            (config.roles.admin && member.roles.cache.has(config.roles.admin)) ||
            (config.roles.staff && member.roles.cache.has(config.roles.staff));


        // ==================================================================
        // 1. AUTO-ASIGNACIÓN AL HABLAR (LÓGICA INTELIGENTE)
        // ==================================================================
        // Si el usuario NO tiene ninguno de los roles del sistema, se le considera "nuevo".
        // CORRECCIÓN: Si es Inmune, cuenta como que TIENE roles de sistema.
        const hasSystemRole = 
            isImmune || // <-- EL ARREGLO: Si es admin, el bot asume que está "registrado/seguro"
            (unverifiedRole && member.roles.cache.has(unverifiedRole.id)) ||
            (survivorRole && member.roles.cache.has(survivorRole.id)) ||
            (leaderRole && member.roles.cache.has(leaderRole.id));

        if (unverifiedRole && !hasSystemRole) {
            console.log(`⚡ [MessageCreate] Usuario ${member.user.tag} habló sin roles de sistema. Iniciando registro...`);
            await member.roles.add(unverifiedRole).catch(()=>{});
            await iniciarRegistro(member);
            return;
        }

        // ==================================================================
        // 2. PORTERO (Bloqueo de No Verificados)
        // ==================================================================
        if (unverifiedRole && member.roles.cache.has(unverifiedRole.id)) {
            
            // CORRECCIÓN: Si es Admin/Inmune, le dejamos hablar aunque tenga el rol de No Verificado (útil para pruebas)
            if (isImmune) return; 

            // Lista Blanca (Canales donde sí pueden hablar)
            if (message.channel.name.startsWith('registro-')) return; 
            if (message.channel.topic && message.channel.topic.includes('SYSTEM:REGISTRO')) return;
            if (config.categories.private_registration && message.channel.parentId === config.categories.private_registration) return;

            // Borrar mensaje no autorizado
            try { await message.delete(); } catch(e){}

            const suffix = member.id.slice(-4);
            const existingChannel = guild.channels.cache.find(c => 
                c.type === ChannelType.GuildText && 
                ((c.topic && c.topic.includes(member.id)) || (c.name.includes(suffix) && c.name.includes('registro')))
            );

            if (!existingChannel) {
                console.log(`🚑 Usuario ${member.user.tag} intentó hablar sin canal de registro. Creando uno nuevo...`);
                await iniciarRegistro(member);
            } else {
                const warning = new EmbedBuilder().setColor('Red').setDescription(`⛔ **Acceso Denegado:** Termina tu registro aquí: ${existingChannel}`);
                message.channel.send({ content: `${member}`, embeds: [warning] })
                    .then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
            }
            return;
        }

        // ==================================================================
        // 3. CHECK-IN PASIVO (ACTIVIDAD DE TRIBUS)
        // ==================================================================
        let tribes = loadTribes(guild.id);
        let modified = false;
        for (const tName in tribes) {
            const tribe = tribes[tName];
            if (tribe.members.some(m => m.discordId === message.author.id)) {
                // Actualizar actividad si ha pasado más de 1 hora desde la última vez
                if (Date.now() - (tribe.lastActive || 0) > 3600000) {
                    tribe.lastActive = Date.now();
                    modified = true;
                }
                break;
            }
        }
        if (modified) saveTribes(guild.id, tribes);
    },
};
