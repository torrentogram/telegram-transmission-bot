const TelegramTransmissionBot = require("./TelegramTransmissionBot");

const bot = new TelegramTransmissionBot({
    token: process.env.TG_TOKEN,
    redis: process.env.REDIS,
    transmissionOptions: {
        host: process.env.TRANSMISSION_HOST,
        username: process.env.TRANSMISSION_LOGIN,
        password: process.env.TRANSMISSION_PASSWORD
    },
    allowedUsers: (process.env.TG_ALLOWED_USERS || "").split(","),
    rutrackerLogin: process.env.RUTRACKER_LOGIN,
    rutrackerPassword: process.env.RUTRACKER_PASSWORD,
    tunnelRoot: process.env.TUNNEL_ROOT
});

bot.launch();
