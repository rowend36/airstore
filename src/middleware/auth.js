const session = require("express-session");
const crypto = require("crypto");

exports.auth = session({
    // This will log out users on server restart
    secret: crypto.randomBytes(16).toString("hex"),
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000 /* Wait a day */,
    },
});

exports.requireAuth = function (req, res, next) {
    if (!req.session.user) {
        res.status(401);
        res.send("Unauthorized");
        res.end();
    } else return next();
};
