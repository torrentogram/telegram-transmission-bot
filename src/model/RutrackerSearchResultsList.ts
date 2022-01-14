import { Redis } from 'ioredis';
import { SearchResult } from 'rutracker-sucker';

const PREFIX = 'TelegramTransmissionBot:RutrackerSearchResultsList';

export class RutrackerSearchResultsList {
    private redis: Redis;
    constructor({ redis }: { redis: Redis }) {
        this.redis = redis;
    }

    async create(results: SearchResult[]) {
        const id = Math.floor(Math.random() * 1e9).toString(16);
        await this.redis.setex(
            `${PREFIX}:${id}`,
            30 * 24 * 3600,
            JSON.stringify(results)
        );
        return id;
    }

    async get(id: string): Promise<SearchResult[] | null> {
        const str = await this.redis.get(`${PREFIX}:${id}`);
        if (!str) {
            return null;
        }
        return JSON.parse(str);
    }
}
