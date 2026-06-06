module.exports = {
  apps : [{
    name: "bot-ark",
    script: "index.js",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "800M", // Reinicia si usa más de 800MB de RAM (Protección VPS)
    env: {
      NODE_ENV: "production",
    }
  }]
};
