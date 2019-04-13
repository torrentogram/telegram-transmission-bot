const Telegraf = require('telegraf');
const Transmission = require('transmission-promise');
const _ = require('lodash');
const IORedis = require('ioredis');
const debug = require('debug')('TelegramTransmissionBot');
const TelegrafLogger = require('telegraf-logger');
const sleep = require('sleep-promise');
const WaitList = require('./model/WaitList');
const ReferenceList = require('./model/ReferenceList');

const CHECK_POLLING_INTERVAL = 10000;

class TelegramTransmissionBot {
    /**
     * @param {Object} options
     * @param {string} options.token
     * @param {Object} options.transmissionOptions
     * @param {IORedis.Redis} options.redis
     * @param {string[]} options.allowedUsers
     *
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
        this.allowedUsers = allowedUsers || [];

        this.redis = new IORedis(redis);
        this.waitList = new WaitList({ redis: this.redis });
        this.referenceList = new ReferenceList({ redis: this.redis });
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

        bot.hears(/^(\d+)/, ctx => this.selectTorrent(ctx));

        bot.on('message', ctx => {
            if (this.containsTorrentFile(ctx)) {
                return this.addTorrent(ctx);
            }
            return;
        });

        bot.launch();
        this.startCheckStatusPolling();
    }

    async startCheckStatusPolling() {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            await sleep(CHECK_POLLING_INTERVAL);
            try {
                await this.checkStatuses();
            } catch (error) {
                debug(
                    'checkStatuses failed with error %s',
                    error.stack || error.message
                );
            }
        }
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
            await this.waitList.add(torrent.id, ctx.chat.id);
        } catch (e) {
            debug(`Error: ${e}`);
            return ctx.reply(`Error: ${e}`);
        }
    }

    async checkStatuses() {
        debug('Status check');
        const { transmission, bot } = this;

        const chatIdByTorrentId = await this.waitList.getAll();
        const waitListLength = Object.keys(chatIdByTorrentId).length;
        if (waitListLength === 0) {
            return;
        }
        debug('Checking %d torrents', waitListLength);
        const torrentIds = Object.keys(chatIdByTorrentId).map(i =>
            parseInt(i, 10)
        );
        const { torrents } = await transmission.get(torrentIds);

        //Collect garbage (ids present in Redis but missing in Transmission)
        const foundTorrentIds = torrents.map(t => parseInt(t.id, 10));
        for (const waitingTorrentId of Object.keys(chatIdByTorrentId)) {
            if (!foundTorrentIds.includes(parseInt(waitingTorrentId, 10))) {
                debug('Torrent not found in transmission %s', waitingTorrentId);
                await this.waitList.remove(waitingTorrentId);
            }
        }

        //Check statuses
        for (const torrent of torrents) {
            if (torrent.status > 4) {
                debug('Torrent finished: %s', torrent.name);
                const chatId = parseInt(chatIdByTorrentId[torrent.id], 10);
                await this.waitList.remove(torrent.id);
                if (chatId) {
                    await bot.telegram.sendMessage(
                        chatId,
                        `✅ Torrent finished "${torrent.name}"`
                    );
                }
            }
        }
    }

    renderStatus(torrent) {
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

    renderProgress(torrent) {
        //Example: ██░░░░░░░░ 20%
        const { percentDone } = torrent;
        if (percentDone === 1) {
            return '';
        }
        const length = 10;
        const filledCount = Math.round(percentDone * length);
        const emptyCount = length - filledCount;
        const filled = _.repeat('█', filledCount);
        const empty = _.repeat('░', emptyCount);
        const percentage = Math.round(percentDone * 100);
        return `${filled}${empty} ${percentage}%\n`;
    }

    renderTorrent(t, i) {
        const status = this.renderStatus(t);
        const progress = this.renderProgress(t);
        return `\n${i + 1}. ${status}\n${progress}  ${t.name}`;
    }

    async listTorrents(ctx) {
        const { transmission } = this;
        try {
            const { torrents } = await transmission.all();

            const topTorrents = _(torrents)
                .orderBy(['addedDate'], ['desc'])
                .slice(0, 10)
                .value();
            await this.referenceList.set(topTorrents);

            const message = topTorrents
                .map((t, i) => this.renderTorrent(t, i))
                .join('\n');
            return ctx.reply(`Recent torrents (up to 10):\n${message}`);
        } catch (e) {
            debug(`Error: ${e}`);
            return ctx.reply(`Error: ${e}`);
        }
    }

    async selectTorrent(ctx) {
        const { match = [] } = ctx;
        const strTorrentIndexStartingFrom1 = match[1];
        if (!strTorrentIndexStartingFrom1) {
            return;
        }
        const torrentIndex = parseInt(strTorrentIndexStartingFrom1, 10) - 1;
        if (torrentIndex < 0) {
            return;
        }

        const ids = await this.referenceList.get();
        if (ids === null) {
            return ctx.reply(
                'Wrong torrent number. To see all the torrents, run /list '
            );
        }
        const id = ids[torrentIndex];
        if (!id) {
            return ctx.reply(
                'Wrong torrent number. To see all the torrents, run /list '
            );
        }

        const {
            torrents: [torrent]
        } = await this.transmission.get(id);

        const torrentMessage = this.renderTorrent(torrent, torrentIndex);
        await ctx.reply(torrentMessage);
    }
}

module.exports = TelegramTransmissionBot;
