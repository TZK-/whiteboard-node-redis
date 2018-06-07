const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");

const config = require("./config");
const app = express();

app.use(express.static(config.express.public_path));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser);

app.all("*", (req, res, next) => {
    if (req.cookies.login && res.cookie.login.trim().length > 0) {
        return res.redirect("/");
    }

    return res.redirect("/login");
});

app.get("/", (req, res) => {
    res.redirect(`/${uuidv4()}`);
});

app.get("/:channel", (req, res, next) => {
    res.sendFile(path.join(config.express.public_path, "index.html"), {}, err => {
        if (err) {
            next(err);
        }
    });
});

app.get("/login", (req, res) => {
    res.sendFile(path.join(config.express.public_path, "login.html"), {}, err => {
        if (err) {
            next(err);
        }
    });
});

app.post("/login", (req, res) => {
    res.cookie("login", req.body.login, { maxAge: 900000, httpOnly: true });
    res.redirect("/");
});

module.exports = app;
