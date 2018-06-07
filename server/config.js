const path = require('path');

const config = {
    redis: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: process.env.REDIS_PORT || 6379
    },
    express: {
        public_path: path.join(__dirname, "../public"),
        port: process.env.PORT || 5000
    },
    whiteboard: {
        points_to_keep: 3000,
        words: ["dog", "cat", "car", "computer", "table", "chair"]
    }
};

module.exports = config;
