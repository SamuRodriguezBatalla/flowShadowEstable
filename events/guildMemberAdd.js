const { Events, PermissionsBitField, EmbedBuilder, ChannelType } = require('discord.js');
const { loadGuildConfig, saveGuildConfig, isPermabanned, initRegistrationState } = require('../utils/dataManager');

const processingMembers = new Set();

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        await this.iniciarRegistro(member);
    },

    iniciarRegistro: async function(member) {
        if (member.user.bot) return;

        // Evitar spam de registros simultáneos
        if (processingMembers.has(member.id)) return;
        processingMembers.add(member.id);
        setTimeout(() => processingMembers.delete(member.id), 10000);

        try {
            const guild = member.guild;
            let config = loadGuildConfig(guild.id);
            if (!config) return; 

            // 1. PORTERO PERMABAN
            const permabanData = isPermabanned(member.guild.id, member.id);
            if (permabanData) {
                try { await member.ban({ reason: `[AUTO-BLACKLIST] ${permabanData.reason}` }); } catch (e) {}
                return; 
            }

            if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return; 

            // 2. Asignar Rol "No Verificado"
            const unverifiedRole = guild.roles.cache.get(config.roles.unverified);
            if (unverifiedRole && !member.roles.cache.has(unverifiedRole.id)) {
                await member.roles.add(unverifiedRole).catch(()=>{});
            }

            // 3. Evitar duplicados (Buscar canal existente)
            await guild.channels.fetch(); 
            const suffix = member.id.slice(-4);
            
            let oldCh = guild.channels.cache.find(c => 
                (c.type === ChannelType.GuildText) && 
                ((c.topic && c.topic.includes(`USER:${member.id}`)) || (c.name.includes(suffix) && c.name.includes('registro')))
            );

            if (oldCh) {
                initRegistrationState(oldCh.id, member.id);
                return; 
            }

            // 4. Crear Canal
            let catId = config.categories.private_registration;
            let catObj = guild.channels.cache.get(catId);
            
            if (!catObj) {
                catObj = guild.channels.cache.find(c => c.name === '🔐 Rᴇgistrᴏ-Pʀiᴠᴀdᴏ' && c.type === ChannelType.GuildCategory);
                if (catObj) {
                    config.categories.private_registration = catObj.id;
                    saveGuildConfig(guild.id, config);
                }
            }

            const cleanName = member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10); 
            const initialTopic = `REGISTRO_ACTIVO | USER:${member.id} | STEP:1`;

            const channel = await guild.channels.create({
                name: `registro-${cleanName}-${suffix}`, 
                type: ChannelType.GuildText, 
                parent: catObj ? catObj.id : null, 
                topic: initialTopic, 
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, 
                    { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }, 
                    { id: member.client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                ]
            });

            // Guardar en DB
            initRegistrationState(channel.id, member.id);

            const season = config.season || 0;
            const welcomeEmbed = new EmbedBuilder()
                .setColor('#00BFFF')
                .setTitle(`👋 ¡Bienvenid a **${guild.name}**!`)
                .setDescription(`Hola **${member}**, soy **${member.client.user.username}**.\nEstás a un paso de entrar a la **Season ${season}**.`)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: '📋 Instrucciones', value: 'Por favor, responde a las siguientes preguntas para completar tu ficha.' },
                    { name: '🚀 Paso 1/2', value: '**Escribe tu ID de Plataforma** a continuación (PSN, SteamID, Gamertag...).' }
                )
                .setFooter({ text: 'Registro Automático • Tus datos son privados.' })
                .setTimestamp();

            await channel.send({ content: `${member}`, embeds: [welcomeEmbed] });

        } catch (error) {
            console.error(`Error iniciarRegistro ${member.user.tag}:`, error);
        }
    }
};
