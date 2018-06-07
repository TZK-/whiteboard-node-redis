const http = require("http");
const app = require("./express");
const WebSocket = require("ws");
const { subscribe, unsubscribeAll, broadcast, redisSubscriber, socketsPerChannels } = require("./socket")

const config = require('./config');

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

redisSubscriber.on("message", (channel, message) => {
    const socketSubscribed = socketsPerChannels.get(channel) || new Set();

    socketSubscribed.forEach(client => {
        client.send(message);
    });
});

wss.on("connection", ws => {
    ws.on("close", () => {
        unsubscribeAll(ws);
    });

    ws.on("message", data => {
        const message = JSON.parse(data.toString());

        switch (message.type) {
            case "subscribe":
                subscribe(ws, message.channel);
                break;
            default:
                broadcast(message.channel, data);
                break;
        }
    });
});

server.listen(config.express.port, () => {
    console.log(`Server started on port ${server.address().port}`);
});
