const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { loadGuildConfig } = require('../utils/dataManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fixroles')
        .setDescription('👮 MANUAL: Asigna rol "No Verificado" a quien no tenga roles y abre sus registros.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();
        const guild = interaction.guild;
        
        // Cargar configuración
        const config = loadGuildConfig(guild.id);
        if (!config || !config.roles.unverified) {
            return interaction.editReply("❌ Error: No hay configuración de roles. Ejecuta /setup primero.");
        }

        const unverifiedRole = guild.roles.cache.get(config.roles.unverified);
        if (!unverifiedRole) {
            return interaction.editReply("❌ Error: El rol 'No Verificado' no existe en Discord.");
        }

        await interaction.editReply("🔄 **Escaneando usuarios sin rol...** (Esto puede tardar un poco)");

        try {
            // Descargar todos los miembros
            const members = await guild.members.fetch();
            
            // Filtrar: No bots, No admins, y que NO tengan roles del sistema
            const targets = members.filter(m => {
                if (m.user.bot) return false;
                if (m.permissions.has(PermissionFlagsBits.Administrator)) return false; // Ignoramos admins por seguridad

                const hasSystemRole = [
                    config.roles.unverified, 
                    config.roles.survivor, 
                    config.roles.leader
                ].some(roleId => m.roles.cache.has(roleId));

                // Si NO tiene ninguno de estos, es un objetivo
                return !hasSystemRole;
            });

            if (targets.size === 0) {
                return interaction.editReply("✅ **Todo limpio.** No he encontrado a nadie sin roles.");
            }

            await interaction.editReply(`⚠️ Encontrados **${targets.size}** usuarios sin rol. Aplicando corrección...`);

            let count = 0;
            for (const [id, member] of targets) {
                // Al añadir el rol, se disparará el evento guildMemberUpdate
                // que a su vez lanzará iniciarRegistro() y creará el canal.
                await member.roles.add(unverifiedRole).catch(e => console.error(`Fallo en ${member.user.tag}:`, e.message));
                
                count++;
                // Pequeña pausa para no saturar la API
                await new Promise(r => setTimeout(r, 250));
            }

            await interaction.editReply(`✅ **¡Listo!** Se ha asignado el rol a **${count}** usuarios.\nSus canales de registro deberían estar abriéndose ahora mismo.`);

        } catch (error) {
            console.error(error);
            await interaction.editReply(`❌ Ocurrió un error: ${error.message}`);
        }
    },
};