const Telegraf = require('telegraf');
const Extra = require('telegraf/extra');
const Transmission = require('transmission-promise');
const _ = require('lodash');
const { duration } = require('moment');
const bytes = require('bytes');
const IORedis = require('ioredis');
const debug = require('debug')('TelegramTransmissionBot');
const TelegrafLogger = require('telegraf-logger');
const sleep = require('sleep-promise');
const WaitList = require('./model/WaitList');
const ReferenceList = require('./model/ReferenceList');
const RutrackerSearchResultsList = require('./model/RutrackerSearchResultsList');

const {
    RutrackerSucker,
    rankResults,
    clusterizeResults
} = require('rutracker-sucker');

const CHECK_POLLING_INTERVAL = 10000;

class TelegramTransmissionBot {
    /**
     * @param {Object} options
     * @param {string} options.token
     * @param {Object} options.transmissionOptions
     * @param {IORedis.Redis} options.redis
     * @param {string[]} options.allowedUsers
     * @param {string} options.rutrackerLogin
     * @param {string} options.rutrackerPassword
     */
    constructor({
        token,
        transmissionOptions,
        redis,
        allowedUsers,
        rutrackerLogin,
        rutrackerPassword
    }) {
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
        this.rutrackerSearchResultsList = new RutrackerSearchResultsList({
            redis: this.redis
        });

        this.rutracker = new RutrackerSucker(rutrackerLogin, rutrackerPassword);
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

        bot.help(ctx =>
            ctx.reply('Send me a torrent file or a link to a Rutracker topic')
        );

        bot.command('list', ctx => this.listTorrents(ctx));

        bot.command('info', ctx => this.showInfo(ctx));

        bot.hears(/^(\d+)$/, ctx => this.selectTorrent(ctx));

        bot.hears(
            /^https:\/\/rutracker\.org\/forum\/viewtopic\.php\?t=(\d+)/,
            ctx => this.downloadTorrentFromRutrackerLink(ctx)
        );

        bot.hears(/^\/topic(\d+)$/, ctx =>
            this.downloadTorrentFromRutrackerLink(ctx)
        );
        bot.hears(/^\/more_([a-f0-9]+)$/, ctx =>
            this.showMoreSearchResults(ctx)
        );

        bot.hears(/^.+$/, ctx => this.searchTorrent(ctx));

        bot.action(/deleteTorrent:(\d+)/, ctx => this.deleteTorrent(ctx));

        bot.on('message', ctx => {
            if (this.containsTorrentFile(ctx)) {
                return this.addTorrent(ctx);
            }
            return;
        });

        bot.launch();
        this.startCheckStatusPolling();
    }
    async showMoreSearchResults(ctx) {
        try {
            const {
                match: [, id]
            } = ctx;

            const list = await this.rutrackerSearchResultsList.get(id);
            if (!list || !list.length) {
                await ctx.reply('No results');
                return;
            }

            await ctx.reply('Ranking...');
            const topics = await this.rutracker.getTopics(
                list.map(result => result.topicId)
            );
            const rankedResults = rankResults(list, topics);
            await ctx.replyWithHTML(
                rankedResults
                    .map(result => this.formatSearchResult(result))
                    .join('\n\n')
            );
        } catch (e) {
            debug(`Error: ${e}`);
            return ctx.reply(`Error: ${e}`);
        }
    }
    async searchTorrent(ctx) {
        try {
            const {
                message: { text }
            } = ctx;

            await ctx.reply('Searching...');

            const items = await this.rutracker.search(text);
            const clusters = clusterizeResults(items, 'seeds');
            if (!clusters.length) {
                await ctx.reply('No results');
                return;
            }
            const [popularCluster, otherCluster] = clusters;
            await ctx.reply('Ranking...');
            const topics = await this.rutracker.getTopics(
                popularCluster.map(result => result.topicId)
            );
            const rankedResults = rankResults(popularCluster, topics);
            await ctx.replyWithHTML(
                rankedResults
                    .map(result => this.formatSearchResult(result))
                    .join('\n\n')
            );

            if (otherCluster && otherCluster.length) {
                const moreResults = otherCluster.slice(0, 15);
                const otherSearchResultId = await this.rutrackerSearchResultsList.create(
                    moreResults
                );
                await ctx.reply(
                    `More ${moreResults.length} results /more_${otherSearchResultId}`
                );
            }
        } catch (e) {
            debug(`Error: ${e}`);
            return ctx.reply(`Error: ${e}`);
        }
    }

    /**
     *
     * @param { import('rutracker-sucker').RankedSearchResult } result
     */
    formatSearchResult(result) {
        return [
            `${this.formatRank(result.rank)} ${result.title}`,
            `<a href="${result.topicUrl}">View</a>`,
            `Seeds: <b>${result.seeds}</b>`,
            `<i>${bytes(result.size)}</i>`,
            `⬇️ Download: /topic${result.topicId}`
        ].join('\n');
    }

    formatRank(rank) {
        if (rank < 0) {
            return _('😁').repeat(-rank);
        } else if (rank > 0) {
            return _('😥').repeat(rank);
        } else {
            return '';
        }
    }

    async downloadTorrentFromRutrackerLink(ctx) {
        try {
            const {
                match: [, topicIdStr]
            } = ctx;
            const topicId = parseInt(topicIdStr, 10);
            if (!topicId) {
                throw new Error('Illegal topic ID');
            }
            const file = await this.rutracker.getTorrentFile(topicId);
            const torrent = await this.transmission.addBase64(
                file.data.toString('base64')
            );
            await ctx.reply(`Added "${torrent.name}"`);
            await this.waitList.add(torrent.id, ctx.chat.id);

            await ctx.reply('Torrent added');
        } catch (e) {
            debug(`Error: ${e}`);
            return ctx.reply(`Error: ${e}`);
        }
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
        const etaStr = duration(torrent.eta, 'seconds').humanize();
        return `${filled}${empty} ${percentage}%\nRemaining time: ${etaStr}\n`;
    }

    renderTorrent(t, i) {
        const status = this.renderStatus(t);
        const progress = this.renderProgress(t);
        const size = bytes(t.sizeWhenDone);

        return `\n${i + 1}. ${status} ${size}\n${progress}  ${t.name}`;
    }

    async showInfo(ctx) {
        const { transmission } = this;
        const {
            'download-dir': downloadDir,
            'download-dir-free-space': downloadDirFreeSpace,
            version
        } = await transmission.session();

        const freeSpaceStr = bytes(downloadDirFreeSpace);

        ctx.reply(
            `Transmission ${version}\nDownload directory: ${downloadDir}\nFree space: ${freeSpaceStr}`
        );
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

    async deleteTorrent(ctx) {
        const { match = [] } = ctx;
        const id = match[1];
        if (!id) {
            return;
        }

        await this.transmission.remove(parseInt(id, 10), true);
        ctx.reply('Torrent deleted\n/list');
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
        await ctx.reply(
            torrentMessage,
            Extra.markup(m =>
                m.inlineKeyboard([
                    m.callbackButton('Delete', `deleteTorrent:${torrent.id}`)
                ])
            )
        );
    }
}

module.exports = TelegramTransmissionBot;
