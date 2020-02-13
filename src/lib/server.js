const handler = require("serve-handler");
const http = require("http");
const localtunnel = require("localtunnel");

function init({ root }) {
    const server = http.createServer((request, response) => {
        // You pass two more arguments for config and middleware
        // More details here: https://github.com/zeit/serve-handler#options
        return handler(request, response, {
            public: root
        });
    });

    server.listen(3000, () => {
        console.log("Running at http://localhost:3000");
    });
}
async function startTunnel() {
    const tunnel = await localtunnel(3000);
    return tunnel.url;
}

exports.startTunnel = startTunnel;
exports.init = init;
