const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { saveGuildConfig, loadGuildConfig } = require('../utils/dataManager');

const SUPPORT_INVITE_LINK = 'https://discord.gg/pBPRS64GKq'; 
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('⚙️ [V13] Setup: Estructura Base + Admin Logs.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();
        const guild = interaction.guild;
        
        await interaction.editReply("🔄 **Escaneando servidor...**");
        await guild.channels.fetch(); 
        const allMembers = await guild.members.fetch(); 

        let config = loadGuildConfig(guild.id) || { roles: {}, channels: {}, categories: {}, names: {} };
        if (!config.names) config.names = {};

        const DEFAULTS = {
            roles: { survivor: 'Superviviente', unverified: 'No verificado', leader: 'Líder de Tribu' },
            categories: { 
                private: '🔐 Rᴇɢɪsᴛʀᴏ-Pʀɪᴠᴀᴅᴏ', 
                public: '📝 Zᴏɴᴀ ᴅᴇ Rᴇɢɪsᴛʀᴏ', 
                tribes: 'Tʀɪʙᴜs',
                market: 'Mᴇʀᴄᴀᴅᴏ',
                admin: 'Aᴅᴍɪɴ'
            },
            channels: { 
                welcome: '┏「👋」ʙɪᴇɴᴠᴇɴɪᴅᴀ', 
                log: '┣「📖」ʀᴇɢɪsᴛʀᴏ-ᴅᴇ-ᴛʀɪʙᴜ', 
                checkin: '┣「⏱️」ᴄʜᴇᴄᴋ-ɪɴ', 
                goodbye: '┣「🚪」ʙʏᴇ', 
                bans: '┗「🚫」ʙᴀɴᴇᴀᴅᴏs', 
                leaderRoom: 'sᴀʟᴀ-ᴅᴇ-lɪᴅᴇʀᴇs👑',
                market: 'ᴄᴏᴍᴘʀᴀ-ᴠᴇɴᴛᴀ💸',
                error_log: 'ᴇʀʀᴏʀᴇs-ᴅᴇ-ʀᴇɢɪsᴛʀᴏ·🚨',
                admin_log: 'Lᴏɢ Cᴏᴍᴀɴᴅᴏs 📜',
                reports: 'ʀᴇᴘᴏʀᴛ-ᴊᴜɢᴀᴅᴏʀᴇs🚨'
            }
        };

        try {
            const ensureRole = async (k, n, c) => {
                let r = config.roles[k] ? guild.roles.cache.get(config.roles[k]) : guild.roles.cache.find(x => x.name === n);
                if (!r) r = await guild.roles.create({ name: n, color: c, reason: 'Bot Setup' });
                return r.id;
            };

            const ensureCat = async (k, defaultName) => {
                const nameToUse = config.names[`cat_${k}`] || defaultName;
                let c = config.categories[k] ? guild.channels.cache.get(config.categories[k]) : guild.channels.cache.find(x => x.type === ChannelType.GuildCategory && x.name === nameToUse);
                if (!c) c = await guild.channels.create({ name: nameToUse, type: ChannelType.GuildCategory });
                else config.names[`cat_${k}`] = c.name;
                return c;
            };

            const ensureChan = async (k, defaultName, pid) => {
                const nameToUse = config.names[`ch_${k}`] || defaultName;
                let c = config.channels[k] ? guild.channels.cache.get(config.channels[k]) : guild.channels.cache.find(x => x.name === nameToUse);
                if (!c) c = await guild.channels.create({ name: nameToUse, type: ChannelType.GuildText, parent: pid });
                else { if (c.parentId !== pid) await c.setParent(pid); config.names[`ch_${k}`] = c.name; }
                return c.id;
            };

            // 1. ROLES
            await interaction.editReply("🔄 Configurando Roles...");
            config.roles.unverified = await ensureRole('unverified', DEFAULTS.roles.unverified, '#808080');
            config.roles.survivor = await ensureRole('survivor', DEFAULTS.roles.survivor, '#7F08FF');
            config.roles.leader = await ensureRole('leader', DEFAULTS.roles.leader, '#FFD700');

            // 2. CATEGORÍAS
            await interaction.editReply("🔄 Configurando Categorías...");
            const catPrivate = await ensureCat('private_registration', DEFAULTS.categories.private);
            config.categories.private_registration = catPrivate.id;
            
            const catPublic = await ensureCat('registration', DEFAULTS.categories.public);
            config.categories.registration = catPublic.id;
            
            const catTribes = await ensureCat('tribes', DEFAULTS.categories.tribes);
            config.categories.tribes = catTribes.id;

            const catMarket = await ensureCat('market', DEFAULTS.categories.market);
            config.categories.market = catMarket.id;

            const catAdmin = await ensureCat('admin', DEFAULTS.categories.admin);
            config.categories.admin = catAdmin.id;

            // 3. ORDENAMIENTO
            await interaction.editReply("🏗️ **Forzando orden...**");
            const allCats = [...guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).values()];
            const otherCats = allCats.filter(c => 
                c.id !== catPrivate.id && c.id !== catPublic.id && c.id !== catTribes.id && 
                c.id !== catMarket.id && c.id !== catAdmin.id
            ).sort((a, b) => a.position - b.position);

            const payload = [
                { channel: catPrivate.id, position: 0 },
                { channel: catPublic.id, position: 1 },
                { channel: catTribes.id, position: 2 },
                { channel: catMarket.id, position: 3 },
                { channel: catAdmin.id, position: 4 }
            ];
            let i = 5; 
            for (const c of otherCats) { payload.push({ channel: c.id, position: i++ }); }
            await guild.channels.setPositions(payload);

            // 4. PERMISOS Y CANALES
            await catPrivate.permissionOverwrites.edit(guild.id, { ViewChannel: false });
            await catAdmin.permissionOverwrites.edit(guild.id, { ViewChannel: false }); // Proteger Admin

            // Admin Logs & Reportes
            config.channels.admin_log = await ensureChan('admin_log', DEFAULTS.channels.admin_log, catAdmin.id);
            config.channels.reports = await ensureChan('reports', DEFAULTS.channels.reports, catAdmin.id);

            // Resto de canales
            const regCatId = config.categories.registration;
            
            // Error Log
            const errName = config.names['ch_error_log'] || DEFAULTS.channels.error_log;
            let errorLogChan = config.channels.error_log ? guild.channels.cache.get(config.channels.error_log) : guild.channels.cache.find(c => c.name === errName);
            if (!errorLogChan) {
                errorLogChan = await guild.channels.create({ name: errName, type: ChannelType.GuildText, parent: catPrivate.id, permissionOverwrites: [{ id: guild.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] }, { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] });
            } else { if (errorLogChan.parentId !== catPrivate.id) await errorLogChan.setParent(catPrivate.id); }
            await errorLogChan.setPosition(0);
            config.channels.error_log = errorLogChan.id;

            config.channels.welcome = await ensureChan('welcome', DEFAULTS.channels.welcome, regCatId);
            config.channels.log = await ensureChan('log', DEFAULTS.channels.log, regCatId);
            config.channels.checkin_log = await ensureChan('checkin_log', DEFAULTS.channels.checkin, regCatId);
            config.channels.goodbye = await ensureChan('goodbye', DEFAULTS.channels.goodbye, regCatId);
            config.channels.ban_notifications = await ensureChan('ban_notifications', DEFAULTS.channels.bans, regCatId);
            
            const checkinChan = guild.channels.cache.get(config.channels.checkin_log);
            if (checkinChan) await checkinChan.permissionOverwrites.edit(guild.id, { SendMessages: false });

            config.channels.leader_channel = await ensureChan('leader_channel', DEFAULTS.channels.leaderRoom, config.categories.tribes);
            const leaderChan = guild.channels.cache.get(config.channels.leader_channel);
            if (leaderChan) {
                await leaderChan.permissionOverwrites.edit(guild.id, { ViewChannel: false });
                await leaderChan.permissionOverwrites.edit(config.roles.leader, { ViewChannel: true, SendMessages: true });
            }

            config.channels.market = await ensureChan('market', DEFAULTS.channels.market, config.categories.market);

            saveGuildConfig(guild.id, config);

            // AUTO-ROL
            await interaction.editReply("👮 **Aplicando Auto-Rol...**");
            const unverifiedRole = guild.roles.cache.get(config.roles.unverified);
            const targets = allMembers.filter(m => {
                if (m.user.bot || m.permissions.has(PermissionFlagsBits.Administrator)) return false;
                const hasSys = [config.roles.unverified, config.roles.survivor, config.roles.leader].some(id => m.roles.cache.has(id));
                return !hasSys;
            });
            if (targets.size > 0) {
                if (guild.members.me.roles.highest.position > unverifiedRole.position) {
                    for (const [id, m] of targets) { await m.roles.add(unverifiedRole).catch(()=>{}); await sleep(100); }
                }
            }

            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Soporte').setStyle(ButtonStyle.Link).setURL(SUPPORT_INVITE_LINK));
            await interaction.editReply({ content: `✅ **SETUP COMPLETADO**\n\n- Estructura Admin desplegada.\n- Logs configurados.`, components: [row] });

        } catch (e) { console.error(e); interaction.editReply(`❌ ERROR: ${e.message}`); }
    },
};
