import { Redis } from 'ioredis';

const PREFIX = 'TelegramTransmissionBot:WaitList';

export class WaitList {
    private redis: Redis;

    constructor({ redis }: { redis: Redis }) {
        this.redis = redis;
    }

    async remove(torrentId: string) {
        return await this.redis.hdel(PREFIX, torrentId);
    }

    async add(torrentId: string, chatId: string) {
        return await this.redis.hset(PREFIX, torrentId, chatId);
    }

    async getAll() {
        return await this.redis.hgetall(PREFIX);
    }
};
