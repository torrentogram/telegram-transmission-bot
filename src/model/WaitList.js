const PREFIX = 'TelegramTransmissionBot:WaitList';

module.exports = class WaitList {
    /**
     * @param {Object} options
     * @param {import('ioredis').Redis} options.redis
     */
    constructor({ redis }) {
        this.redis = redis;
    }

    async remove(torrentId) {
        return await this.redis.hdel(PREFIX, torrentId);
    }

    async add(torrentId, chatId) {
        return await this.redis.hset(PREFIX, torrentId, chatId);
    }

    async getAll() {
        return await this.redis.hgetall(PREFIX);
    }
};
