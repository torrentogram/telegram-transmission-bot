import assert from 'assert';
import { TelegramTransmissionBot } from './TelegramTransmissionBot';

assert.ok(process.env.TG_TOKEN);
assert.ok(process.env.REDIS);
assert.ok(process.env.TRANSMISSION_LOGIN);
assert.ok(process.env.TRANSMISSION_PASSWORD);
assert.ok(process.env.TRANSMISSION_HOST);
assert.ok(process.env.RUTRACKER_LOGIN);
assert.ok(process.env.RUTRACKER_PASSWORD);
assert.ok(process.env.TUNNEL_API);

const bot = new TelegramTransmissionBot({
    token: process.env.TG_TOKEN,
    redis: process.env.REDIS,
    transmissionOptions: {
        host: process.env.TRANSMISSION_HOST,
        port: parseInt(process.env.TRANSMISSION_PORT ?? '') || 9091,
        username: process.env.TRANSMISSION_LOGIN,
        password: process.env.TRANSMISSION_PASSWORD,
    },
    allowedUsers: (process.env.TG_ALLOWED_USERS || '').split(','),
    rutrackerLogin: process.env.RUTRACKER_LOGIN,
    rutrackerPassword: process.env.RUTRACKER_PASSWORD,
    tunnelApi: process.env.TUNNEL_API,
});

bot.launch();
