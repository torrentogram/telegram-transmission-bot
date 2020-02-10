const PREFIX = 'TelegramTransmissionBot:RutrackerSearchResultsList';

module.exports = class RutrackerSearchResultsList {
    /**
     * @param {Object} options
     * @param {import('ioredis').Redis} options.redis
     */
    constructor({ redis }) {
        this.redis = redis;
    }

    async create(results) {
        const id = Math.floor(Math.random() * 1e9).toString(16);
        await this.redis.setex(
            `${PREFIX}:${id}`,
            30 * 24 * 3600,
            JSON.stringify(results)
        );
        return id;
    }

    async get(id) {
        const str = await this.redis.get(`${PREFIX}:${id}`);
        if (!str) {
            return null;
        }
        return JSON.parse(str);
    }
};
