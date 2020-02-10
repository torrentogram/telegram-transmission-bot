const PREFIX = 'TelegramTransmissionBot:ReferenceList';

module.exports = class ReferenceList {
    /**
     * @param {Object} options
     * @param {import('ioredis').Redis} options.redis
     */
    constructor({ redis }) {
        this.redis = redis;
    }

    async set(torrents) {
        const ids = torrents.map(({ id }) => id);
        return await this.redis.set(PREFIX, JSON.stringify(ids));
    }

    async get() {
        const strIds = await this.redis.get(PREFIX);
        if (!strIds) {
            return null;
        }
        return JSON.parse(strIds);
    }
};
