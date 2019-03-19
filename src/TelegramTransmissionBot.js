const Telegraf = require('telegraf');
const Transmission = require('transmission-promise');
const _ = require('lodash');
const IORedis = require('ioredis');
const debug = require('debug')('TelegramTransmissionBot');
const TelegrafLogger = require('telegraf-logger');

const WAIT_LIST = 'TelegramTransmissionBot:waitList';

class TelegramTransmissionBot {
    /**
     *
     * @param {Object} options
     * @param {string} options.token
     * @param {Object} options.transmissionOptions
     * @param {IORedis.Redis} options.redis
     * @param {string[]} options.allowedUsers
     */
    constructor({ token, transmissionOptions, redis, allowedUsers }) {
        this.bot = new Telegraf(token);
        this.bot.use(
            new TelegrafLogger({
                log: debug
            })
        );
        this.bot.use(this.authMiddleware.bind(this));
        this.transmission = new Transmission(transmissionOptions);
        this.redis = new IORedis(redis);
        this.waitList = new Map();
        this.allowedUsers = allowedUsers || [];
    }

    authMiddleware(ctx, next) {
        const {
            chat,
            chat: { username }
        } = ctx;
        if (this.allowedUsers.includes(username)) {
            next(ctx);
        } else {
            ctx.reply('You are not authenticated to this bot');
            debug(`Access denied for chat ${JSON.stringify(chat)}`);
        }
    }

    launch() {
        const { bot } = this;
        bot.start(ctx => ctx.reply('Welcome'));
        bot.help(ctx => ctx.reply('Send me a torrent'));
        bot.command('list', ctx => this.listTorrents(ctx));
        bot.on('message', ctx => {
            if (this.containsTorrentFile(ctx)) {
                return this.addTorrent(ctx);
            }
            return;
        });
        bot.launch();
        setInterval(this.checkStatuses.bind(this), 1000);
    }

    containsTorrentFile(ctx) {
        const { message: { document: { mime_type } = {} } = {} } = ctx;
        return mime_type === 'application/x-bittorrent';
    }

    async addTorrent(ctx) {
        const {
            message: {
                document: { file_id }
            }
        } = ctx;
        const { transmission } = this;
        try {
            const fileLink = await ctx.tg.getFileLink(file_id);
            const torrent = await transmission.addUrl(fileLink);
            await ctx.reply(`Added "${torrent.name}"`);
            await this.waitListAdd(torrent.id, ctx.chat.id);
        } catch (e) {
            debug(`Error: ${e}`);
            return ctx.reply(`Error: ${e}`);
        }
    }

    async waitListRemove(torrentId) {
        return await this.redis.hdel(WAIT_LIST, torrentId);
    }

    async waitListAdd(torrentId, chatId) {
        return await this.redis.hset(WAIT_LIST, torrentId, chatId);
    }

    async waitListGetAll() {
        return await this.redis.hgetall(WAIT_LIST);
    }

    async checkStatuses() {
        const { transmission, bot } = this;

        const chatIdByTorrentId = await this.waitListGetAll();
        const torrentIds = Object.keys(chatIdByTorrentId).map(i =>
            parseInt(i, 10)
        );
        const { torrents } = await transmission.get(torrentIds);

        for (const torrent of torrents) {
            if (torrent.status > 4) {
                debug('Torrent finished: %s', torrent.name);
                const chatId = parseInt(chatIdByTorrentId[torrent.id], 10);
                await this.waitListRemove(torrent.id);
                if (chatId) {
                    await bot.telegram.sendMessage(
                        chatId,
                        `✅ Torrent finished "${torrent.name}"`
                    );
                }
            }
        }
    }

    statusToEmoji(torrent) {
        return {
            0: '🚫 Stopped', // Torrent is stopped
            1: '❓ Checking', // Queued to check files
            2: '❓ Checking', // Checking files
            3: '⬇️ Downloading', // Queued to download
            4: '⬇️ Downloading', // Downloading
            5: '⬆️ Seeding', // Queued to seed
            6: '⬆️ Seeding', // Seeding
            7: '😞 Cannot find peers' // Torrent can't find peers
        }[torrent.status];
    }

    async listTorrents(ctx) {
        const { transmission } = this;
        try {
            const { torrents } = await transmission.all();
            const topTorrents = _(torrents)
                .orderBy(['addedDate'], ['desc'])
                .slice(0, 10)
                .value();
            const message = topTorrents
                .map(
                    (t, i) =>
                        `\n${i + 1}. ${this.statusToEmoji(t)}\n  ${t.name}`
                )
                .join('\n');
            return ctx.reply(`Recent torrents (up to 10):\n${message}`);
        } catch (e) {
            debug(`Error: ${e}`);
            return ctx.reply(`Error: ${e}`);
        }
    }
}

module.exports = TelegramTransmissionBot;
