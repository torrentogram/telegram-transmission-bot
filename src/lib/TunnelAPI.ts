import axios, { AxiosInstance } from 'axios';

interface TunnelResponse<T extends Tunnel> {
    tunnel: T;
}

type Tunnel = TunnelRunning | TunnelStopped;
interface TunnelRunning {
    isRunning: true;
    url: string;
}
interface TunnelStopped {
    isRunning: false;
    url: null;
}

export class TunnelAPI {
    private readonly http: AxiosInstance;

    constructor({ url }: { url: string }) {
        this.http = axios.create({ baseURL: url });
    }

    async start(): Promise<TunnelResponse<TunnelRunning>> {
        return (await this.http.post('/tunnel', {})).data;
    }

    async stop(): Promise<TunnelResponse<TunnelStopped>> {
        return (await this.http.delete('/tunnel')).data;
    }

    async status(): Promise<TunnelResponse<Tunnel>> {
        return (await this.http.get('/tunnel')).data;
    }
}
