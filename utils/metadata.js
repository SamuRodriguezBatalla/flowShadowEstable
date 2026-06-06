// utils/metadata.js
const fs = require('fs');
const path = require('path');

const METADATA_FILE = path.join(__dirname, '..', 'data', 'metadata.json');

function loadMetadata() {
    if (!fs.existsSync(METADATA_FILE)) {
        console.error("⚠️ metadata.json no encontrado. Creando con Season 0.");
        return { season: 0 }; 
    }
    try {
        const data = fs.readFileSync(METADATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Error cargando metadata:", error);
        return { season: 0 };
    }
}

function saveMetadata(metadata) {
    try {
        fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2), 'utf8');
    } catch (error) {
        console.error("Error guardando metadata:", error);
    }
}

module.exports = { loadMetadata, saveMetadata };