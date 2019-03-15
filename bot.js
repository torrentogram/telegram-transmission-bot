const Telegraf = require('telegraf');
const Transmission = require('transmission-promise');
const _ = require('lodash');

const waitList = new Map();

const main = () => {
    const bot = new Telegraf(process.env.TG_TOKEN);
    const transmission = new Transmission({
        host: process.env.TRANSMISSION_HOST,
        username: process.env.TRANSMISSION_LOGIN,
        password: process.env.TRANSMISSION_PASSWORD
    });

    bot.start(ctx => ctx.reply('Welcome'));
    bot.help(ctx => ctx.reply('Send me a torrent'));
    bot.command('list', ctx => listTorrents(ctx, transmission));
    bot.on('message', ctx => {
        if (containsTorrentFile(ctx)) {
            return addTorrent(ctx, transmission);
        }
        return;
    });
    bot.launch();
    setInterval(checkStatuses.bind(null, transmission, bot), 1000);
};

/**
 *
 * @param {Object} ctx
 * @param {Transmission} transmission
 */
const listTorrents = async (ctx, transmission) => {
    const { torrents } = await transmission.all();
    const topTorrents = _(torrents)
        .orderBy(['addedDate'], ['desc'])
        .slice(0, 10)
        .value();
    const message = topTorrents.map(t => t.name).join('\n');
    return ctx.reply(message);
};

/**
 *
 * @param {*} ctx
 * @param {Transmission} transmission
 */
const addTorrent = async (ctx, transmission) => {
    const {
        message: {
            document: { file_id }
        }
    } = ctx;

    const fileLink = await ctx.tg.getFileLink(file_id);
    const torrent = await transmission.addUrl(fileLink);
    await ctx.reply(`Added "${torrent.name}"`);
    await addToWaitList(torrent.id, ctx.chat.id);
};

const addToWaitList = (torrentId, chatId) => {
    waitList.set(torrentId, chatId);
};
const removeFromWaitList = (torrentId, chatId) => {
    waitList.delete(torrentId, chatId);
};

const containsTorrentFile = ctx => {
    const { message: { document: { mime_type } = {} } = {} } = ctx;
    return mime_type === 'application/x-bittorrent';
};

/**
 *
 * @param {Transmission} transmission
 * @param {Telegraf} bot
 */
const checkStatuses = async (transmission, bot) => {
    const ids = Array.from(waitList.keys());
    const { torrents } = await transmission.get(ids);
    for (const torrent of torrents) {
        if (torrent.status > 4) {
            console.log('Done', torrent.name);
            const chatId = waitList.get(torrent.id);
            removeFromWaitList(torrent.id);
            await bot.telegram.sendMessage(
                chatId,
                `✅ Torrent finished "${torrent.name}"`
            );
        }
    }
};

main();
