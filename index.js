require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, Partials, Collection } = require("discord.js");
const { startCleanupTask } = require('./utils/cleanupManager');

// Configuración del Cliente
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration, 
        GatewayIntentBits.GuildPresences,
    ],
    partials: [Partials.Channel],
});

// 1. Cargador de Comandos
client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");

if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ("data" in command && "execute" in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`⚠️ Comando incompleto: ${filePath}`);
        }
    }
}

// 2. Cargador de Eventos
const eventsPath = path.join(__dirname, "events");
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith(".js"));
    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        if (event.once) client.once(event.name, (...args) => event.execute(...args));
        else client.on(event.name, (...args) => event.execute(...args));
    }
}

// 3. SISTEMA ANTI-CRASH (IMPORTANTE PARA VPS)
process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 [Anti-Crash] Error no manejado (Rejection):', reason);
    // Aquí podrías enviar un log a un canal de Discord si quisieras
});

process.on('uncaughtException', (error) => {
    console.error('🚨 [Anti-Crash] Error fatal (Exception):', error);
});

console.log("🛡️ Sistemas anti-crash activados.");

// 4. Login
client.login(process.env.BOT_TOKEN);
client.once('ready', () => {
    console.log(`Logueado como ${client.user.tag}`);
    
    // INICIAR LIMPIEZA
    startCleanupTask(client);
});
