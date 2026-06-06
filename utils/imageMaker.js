const Canvas = require('canvas');
const { AttachmentBuilder } = require('discord.js');
const ColorThief = require('colorthief');

module.exports = {
    async createCompositeImage(guild, user, type = 'welcome') {
        const width = 700;
        const height = 250;
        const canvas = Canvas.createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // 1. Obtener URLs
        // Usamos un icono gris neutro por defecto si falla la carga
        const fallbackIcon = 'https://i.imgur.com/5L481aA.png'; 
        
        // Intentar obtener URL válida del servidor
        let guildIconUrl = guild.iconURL({ extension: 'png', size: 128, forceStatic: true });
        // Si no hay icono, usamos el fallback directamente para análisis
        const iconToAnalyze = guildIconUrl || fallbackIcon;
        
        // URLs de alta calidad para pintar
        const guildIconHD = guild.iconURL({ extension: 'png', size: 256, forceStatic: true }) || fallbackIcon;
        const userAvatarHD = user.displayAvatarURL({ extension: 'png', forceStatic: true, size: 256 });

        // 2. Extraer color dominante o usar MORADO por defecto
        const DEFAULT_PURPLE = [128, 0, 128]; 
        let dominantColorRGB = DEFAULT_PURPLE;

        try {
            // Solo intentamos analizar si la URL es válida
            if (iconToAnalyze) {
                dominantColorRGB = await ColorThief.getColor(iconToAnalyze);
            }
        } catch (e) {
            // Si falla (error 404, formato raro, etc), usamos default silenciosamente
            dominantColorRGB = DEFAULT_PURPLE;
        }

        // 3. Ajuste de Brillo (Si es negro puro, subir a Morado Oscuro)
        const isTooDark = (rgb) => (rgb[0] + rgb[1] + rgb[2]) < 50; 
        
        if (isTooDark(dominantColorRGB)) {
            dominantColorRGB = [75, 0, 130]; // Indigo/Morado oscuro
        }

        // Generar gradiente
        const darken = (rgb, amount) => rgb.map(c => Math.max(0, c - amount));
        const colorStartRGB = dominantColorRGB;
        const colorEndRGB = darken(dominantColorRGB, 60); 

        const colorStartStr = `rgb(${colorStartRGB[0]}, ${colorStartRGB[1]}, ${colorStartRGB[2]})`;
        const colorEndStr = `rgb(${colorEndRGB[0]}, ${colorEndRGB[1]}, ${colorEndRGB[2]})`;

        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, colorStartStr);
        gradient.addColorStop(1, colorEndStr);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Superposición según tipo
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; 
        if (type === 'ban') ctx.fillStyle = 'rgba(200, 0, 0, 0.5)'; 
        ctx.fillRect(0, 0, width, height);

        // 4. Función de Dibujo
        const drawCircularImage = (img, x, y, radius) => {
            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2, true);
            ctx.lineWidth = 8;
            ctx.strokeStyle = '#FFFFFF';
            ctx.stroke();
            ctx.restore();
        };

        try {
            // Carga segura con catch individual
            const guildImg = await Canvas.loadImage(guildIconHD).catch(() => Canvas.loadImage(fallbackIcon));
            const userImg = await Canvas.loadImage(userAvatarHD).catch(() => Canvas.loadImage(fallbackIcon));

            drawCircularImage(guildImg, 200, height / 2, 80);
            drawCircularImage(userImg, 500, height / 2, 100);
        } catch (error) {
            console.error("Error crítico dibujando Canvas:", error);
            return null; 
        }

        return new AttachmentBuilder(canvas.toBuffer(), { name: `${type}-image.png` });
    }
};
