const IORedis = require('ioredis');

const WAIT_LIST = 'TelegramTransmissionBot:WaitList';

module.exports = class WaitList {
    /**
     * @param {Object} options
     * @param {IORedis.Redis} options.redis
     */
    constructor({ redis }) {
        this.redis = redis;
    }

    async remove(torrentId) {
        return await this.redis.hdel(WAIT_LIST, torrentId);
    }

    async add(torrentId, chatId) {
        return await this.redis.hset(WAIT_LIST, torrentId, chatId);
    }

    async getAll() {
        return await this.redis.hgetall(WAIT_LIST);
    }
};
