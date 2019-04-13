const IORedis = require('ioredis');
const REFERENCE_LIST = 'TelegramTransmissionBot:ReferenceList';

module.exports = class ReferenceList {
    /**
     * @param {Object} options
     * @param {IORedis.Redis} options.redis
     */
    constructor({ redis }) {
        this.redis = redis;
    }

    async set(torrents) {
        const ids = torrents.map(({ id }) => id);
        return await this.redis.set(REFERENCE_LIST, JSON.stringify(ids));
    }

    async get() {
        const strIds = await this.redis.get(REFERENCE_LIST);
        if (!strIds) {
            return null;
        }
        return JSON.parse(strIds);
    }
};
