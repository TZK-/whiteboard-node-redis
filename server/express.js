const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const uuidv4 = require("uuid/v4");

const config = require("./config");
const app = express();

app.use('/public', express.static(config.express.public_path));

app.get("/", (req, res) => {
    res.redirect('/' + uuidv4());
});

app.get("/:channel", (req, res, next) => {
    res.sendFile(path.join(config.express.public_path, "index.html"), {}, err => {
        if (err) {
            next(err);
        }
    });
});

module.exports = app;
