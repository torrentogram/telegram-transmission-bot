const TelegramTransmissionBot = require('./TelegramTransmissionBot');

const bot = new TelegramTransmissionBot({
    token: process.env.TG_TOKEN,
    redis: process.env.REDIS,
    transmissionOptions: {
        host: process.env.TRANSMISSION_HOST,
        username: process.env.TRANSMISSION_LOGIN,
        password: process.env.TRANSMISSION_PASSWORD
    }
});

bot.launch();
