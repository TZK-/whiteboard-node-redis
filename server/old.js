const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const http = require("http");
const WebSocket = require("ws");
const uuidv4 = require("uuid/v4");
const redis = require("redis");
const {promisify} = require('util');

const redisConf = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
};

const redisPublisher = redis.createClient(redisConf);
const redisSubscriber = redis.createClient(redisConf);

const llen = promisify(redisPublisher.llen).bind(redisPublisher);
const rpop = promisify(redisPublisher.rpop).bind(redisPublisher);
const lpush = promisify(redisPublisher.lpush).bind(redisPublisher);
const lrange = promisify(redisPublisher.lrange).bind(redisPublisher);

const app = express();

const PUBLIC_FOLDER = path.join(__dirname, "../public");
const PORT = process.env.PORT || 5000;
const DRAWING_POINTS_TO_KEEP = 5000;

const socketsPerChannels /* Map<string, Set<WebSocket>> */ = new Map();
const channelsPerSocket /* WeakMap<WebSocket, Set<string> */ = new WeakMap();

// Initialize a simple http server
const server = http.createServer(app);

// Initialize the WebSocket server instance
const wss = new WebSocket.Server({ server });

/*
 * Subscribe a socket to a specific channel.
 */
function subscribe(socket, channel) {
    let socketSubscribed = socketsPerChannels.get(channel) || new Set();
    let channelSubscribed = channelsPerSocket.get(socket) || new Set();

    socketSubscribed = socketSubscribed.add(socket);
    channelSubscribed = channelSubscribed.add(channel);

    socketsPerChannels.set(channel, socketSubscribed);
    channelsPerSocket.set(socket, channelSubscribed);

    if (socketSubscribed.size === 1) {
        redisSubscriber.subscribe(channel);
    }

    reloadCanvas(socket, channel);
}

/*
 * Unsubscribe a socket from a specific channel.
 */
function unsubscribe(socket, channel) {
    let socketSubscribed = socketsPerChannels.get(channel) || new Set();
    let channelSubscribed = channelsPerSocket.get(socket) || new Set();

    socketSubscribed.delete(socket);
    channelSubscribed.delete(channel);

    socketsPerChannels.set(channel, socketSubscribed);
    channelsPerSocket.set(socket, channelSubscribed);

    if (socketSubscribed.size === 0) {
        redisSubscriber.unsubscribe(channel);
    }
}

/*
 * Subscribe a socket from all channels.
 */
function unsubscribeAll(socket) {
    const channelSubscribed = channelsPerSocket.get(socket) || new Set();

    channelSubscribed.forEach(channel => {
        unsubscribe(socket, channel);
    });
}

async function broadcast(channel, data) {
    redisPublisher.publish(channel, data);

    while (await llen(channel) >= DRAWING_POINTS_TO_KEEP) {
        await rpop(channel);
    }

    await lpush(channel, data);
}

async function reloadCanvas(ws, channel) {
    let data = await lrange(channel, 0, DRAWING_POINTS_TO_KEEP);

    data.forEach(d => {
        ws.send(d);
    });
}

redisSubscriber.on("message", (channel, message) => {
    const socketSubscribed = socketsPerChannels.get(channel) || new Set();

    socketSubscribed.forEach(client => {
        client.send(message);
    });
});

// Broadcast message from client
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

function authMiddleware(req, res, next) {
    if (req.cookie.login && res.cookie.login.trim().length > 0) {
        return res.redirect('/');
    }

    return res.redirect('/login');
}

app.use(express.static(PUBLIC_FOLDER));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser);

app.all('*', authMiddleware);

// Assign a random channel to people opening the application
app.get("/", (req, res) => {
    res.redirect(`/${uuidv4()}`);
});

app.get("/login", (req, res) => {
    res.sendFile(path.join(PUBLIC_FOLDER, "login.html"), {}, err => {
        if (err) {
            next(err);
        }
    });
});

app.post("/login", (req, res) => {
    res.cookie('login', req.body.login, { maxAge: 900000, httpOnly: true })
    res.redirect('/');
});

app.get("/:channel", (req, res, next) => {
    res.sendFile(path.join(PUBLIC_FOLDER, "index.html"), {}, err => {
        if (err) {
            next(err);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server started on http://localhost:${server.address().port}`);
});
