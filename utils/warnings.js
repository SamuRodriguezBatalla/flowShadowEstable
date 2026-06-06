const { loadTribes, saveTribe } = require('./dataManager'); // 1. Importamos saveTribe
const { updateLog } = require('./logger');
const { WARNING_POINTS, BAN_THRESHOLD } = require('./constants');

async function applyWarning(guild, targetType, targetId, warningType) {
    const tribes = loadTribes(guild.id);
    const points = WARNING_POINTS[warningType];
    let tribeName = null, member = null, isBanned = false;

    if (targetType === 'tribe') {
        tribeName = targetId;
        if (!tribes[tribeName]) return { success: false, message: 'Tribu no existe.' };
        
        tribes[tribeName].warnings = (tribes[tribeName].warnings || 0) + points;
        if (tribes[tribeName].warnings >= BAN_THRESHOLD) isBanned = true;
    } else {
        // Buscar usuario
        for (const t in tribes) {
            const m = tribes[t].members.find(x => x.discordId === targetId);
            if (m) { tribeName = t; member = m; break; }
        }
        if (!member) return { success: false, message: 'Usuario sin tribu.' };
        member.warnings = (member.warnings || 0) + points;
        // Sumar warnings personales + warnings de tribu
        if ((member.warnings + (tribes[tribeName].warnings || 0)) >= BAN_THRESHOLD) isBanned = true;
    }

    // 2. GUARDADO SEGURO: Solo guardamos la tribu afectada
    saveTribe(guild.id, tribeName, tribes[tribeName]);
    
    await updateLog(guild, guild.client);
    return { success: true, message: `Warns aplicados.`, banned: isBanned };
}

async function removeWarning(guild, targetType, targetId, warningType) {
    const tribes = loadTribes(guild.id);
    const points = WARNING_POINTS[warningType];
    let tribeNameForSave = null;

    if (targetType === 'tribe') {
        if (!tribes[targetId]) return { success: false, message: 'No existe.' };
        tribes[targetId].warnings = Math.max(0, (tribes[targetId].warnings || 0) - points);
        tribeNameForSave = targetId;
    } else {
        let member = null;
        for (const t in tribes) {
            member = tribes[t].members.find(x => x.discordId === targetId);
            if (member) {
                tribeNameForSave = t; // Guardamos el nombre de la tribu para salvar después
                break;
            }
        }
        if (!member) return { success: false, message: 'Sin tribu.' };
        member.warnings = Math.max(0, (member.warnings || 0) - points);
    }

    // 3. GUARDADO SEGURO
    if (tribeNameForSave) {
        saveTribe(guild.id, tribeNameForSave, tribes[tribeNameForSave]);
    }

    await updateLog(guild, guild.client);
    return { success: true, message: 'Warns removidos.' };
}

module.exports = { applyWarning, removeWarning };
