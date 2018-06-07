const redis = require("redis");
const config = require("./config");
const { promisify } = require("util");
const redisPublisher = redis.createClient(config.redis);
const redisSubscriber = redis.createClient(config.redis);

const llen = promisify(redisPublisher.llen).bind(redisPublisher);
const rpop = promisify(redisPublisher.rpop).bind(redisPublisher);
const lpush = promisify(redisPublisher.lpush).bind(redisPublisher);
const lrange = promisify(redisPublisher.lrange).bind(redisPublisher);

/* Map<string, Set<WebSocket>> */
const socketsPerChannels = new Map();

/* WeakMap<WebSocket, Set<string> */
const channelsPerSocket = new WeakMap();

async function reloadCanvas(ws, channel) {
    let data = await lrange(channel, 0, config.whiteboard.points_to_keep);

    data.forEach(d => {
        ws.send(d);
    });
}

function subscribe(socket, channel) {
    let socketSubscribed = socketsPerChannels.get(channel) || new Set();
    let channelSubscribed = channelsPerSocket.get(socket) || new Set();

    socketSubscribed = socketSubscribed.add(socket);
    channelSubscribed = channelSubscribed.add(channel);

    socketsPerChannels.set(channel, socketSubscribed);
    channelsPerSocket.set(socket, channelSubscribed);

    if (socketSubscribed.size === 1) {
        redisSubscriber.subscribe(channel);

        sendWordToGuess(socket, channel);
    }

    reloadCanvas(socket, channel);
}

function sendWordToGuess(socket, channel) {
    const word = config.whiteboard.words[Math.floor(Math.random() * config.whiteboard.words.length)];
    const payload = {
        type: "wordToDiscover",
        channel: channel,
        word: word
    };
    redisPublisher.set(channel, word);
    socket.send(JSON.stringify(payload));
}

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

function unsubscribeAll(socket) {
    const channelSubscribed = channelsPerSocket.get(socket) || new Set();

    channelSubscribed.forEach(channel => {
        unsubscribe(socket, channel);
    });
}

async function broadcast(channel, data) {
    redisPublisher.publish(channel, data);

    while ((await llen(channel)) >= config.whiteboard.points_to_keep) {
        await rpop(channel);
    }

    await lpush(channel, data);
}

module.exports = {
    reloadCanvas,
    redisSubscriber,
    redisPublisher,
    broadcast,
    subscribe,
    unsubscribe,
    unsubscribeAll,
    socketsPerChannels,
    channelsPerSocket
};
