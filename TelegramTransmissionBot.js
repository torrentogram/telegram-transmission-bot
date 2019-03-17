const Telegraf = require('telegraf');
const Transmission = require('transmission-promise');
const _ = require('lodash');
const IORedis = require('ioredis');

class TelegramTransmissionBot {
    constructor({ token, transmissionOptions, redis }) {
        this.bot = new Telegraf(token);
        this.transmission = new Transmission(transmissionOptions);
        this.redis = new IORedis(redis);
        this.waitList = new Map();
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

    async addTorrent(ctx) {
        const {
            message: {
                document: { file_id }
            }
        } = ctx;
        const { transmission } = this;

        const fileLink = await ctx.tg.getFileLink(file_id);
        const torrent = await transmission.addUrl(fileLink);
        await ctx.reply(`Added "${torrent.name}"`);
        await this.waitListAdd(torrent.id, ctx.chat.id);
    }

    async waitListRemove(torrentId) {
        return await this.redis.hdel('waitList', torrentId);
    }

    async waitListAdd(torrentId, chatId) {
        return await this.redis.hset('waitList', torrentId, chatId);
    }

    containsTorrentFile(ctx) {
        const { message: { document: { mime_type } = {} } = {} } = ctx;
        return mime_type === 'application/x-bittorrent';
    }

    async waitListGetAll() {
        return await this.redis.hgetall('waitList');
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
                console.log('Torrent finished', torrent.name);
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

    async listTorrents(ctx) {
        const { transmission } = this;
        const { torrents } = await transmission.all();
        const topTorrents = _(torrents)
            .orderBy(['addedDate'], ['desc'])
            .slice(0, 10)
            .value();
        const message = topTorrents.map(t => t.name).join('\n');
        return ctx.reply(message);
    }
}

module.exports = TelegramTransmissionBot;
