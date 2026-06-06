require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

const commands = [];
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

console.log(`📦 Cargando ${commandFiles.length} comandos...`);

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
        const command = require(filePath);

        // Verificación estricta
        if (command && command.data && typeof command.data.toJSON === 'function') {
            commands.push(command.data.toJSON());
            // console.log(`✅ Cargado: ${command.data.name}`);
        } else {
            console.warn(`⚠️ El comando ${file} no tiene una propiedad "data" válida o le falta "toJSON()". Se ha omitido.`);
        }
    } catch (error) {
        console.error(`❌ Error crítico cargando el archivo ${file}:`, error);
    }
}

const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);

(async () => {
    try {
        console.log(`🔄 Iniciando actualización de ${commands.length} comandos (Globales)...`);

        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log(`✅ ¡Éxito! Se han registrado ${data.length} comandos.`);
    } catch (error) {
        console.error("❌ Error fatal al registrar comandos en la API de Discord:");
        console.error(error);
    }
})();
