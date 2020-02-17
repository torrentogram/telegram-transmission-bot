const axios = require("axios");

class TunnelAPI {
    constructor({ url }) {
        this.http = axios.create({ baseURL: url });
    }

    async start() {
        return (await this.http.post("/tunnel", {})).data;
    }
    async stop() {
        return (await this.http.delete("/tunnel")).data;
    }
    async status() {
        return (await this.http.get("/tunnel")).data;
    }
}

exports.TunnelAPI = TunnelAPI;
