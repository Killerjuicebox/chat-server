import express from "express";
import { renderFile } from "ejs";
import { createPool } from "mariadb";
import { randomInt, createHash } from "crypto";
import { Server } from "socket.io";
import { createServer } from "http";
const pool = createPool({host: "localhost", user: "miles", password: "pppppp7p", database: "accounts"});
const app = express();
const websocketServer = createServer(app);
const websocket = new Server(websocketServer);
const port = 8080;

app.use(express.urlencoded({extended: true}));

const sleep = async (ms: number) => {
    return new Promise(r => setTimeout(r, ms));
}

app.get("/register", (req, res) => {
    renderFile("login.html", {pageName: "Register"}).then(f => {
        res.send(f);
    });
});

app.post("/register", (req, res) => {
    if (req.headers.referer != undefined && req.headers.referer?.includes("/register")) {
        let body: {username: string, password: string} = req.body;
        console.log(body);
        const waitTime = randomInt(250, 750);

        sleep(waitTime).then(async () => {
            let result: [{username: string, password: string, created: Date}] = await pool.query("select * from information;");
            let createAccount = true;
            let reason = "";
            delete result["meta"];

            for (let a in result) {
                if (result[a].username == body.username) {
                    console.log("Conflicting username");
                    console.log(result[a]);
                    createAccount = false;
                    reason = "Account with this username already exists";
                    break;
                } else if (body.username == "" || body.password == "") {
                    createAccount = false;
                    reason = "Cannot have a blank username or password";
                }
            }

            for (let i = 0; i < body.username.split("").length; i++) {
                const letter = body.username.split("")[i];
                if (!"abcdefghijklmnopqrstuvwxyz1234567890".includes(letter.toLowerCase())) {
                    createAccount = false;
                    reason = "Username must contain A-Z, 0-9 characters";
                    break;
                }
            }

            if (createAccount == true) {
                await pool.query(`insert into information (username, password, created) values ('${body.username}', '${createHash("sha256").update(body.password).digest("base64")}', '${new Date().toISOString().split("T")[0]}')`);
                res.status(200).send("Account created");
            } else {
                res.status(500).send(reason);
            }
        })
    } else {
        res.status(400).send("There was an error processing this request.");
    }
})

app.get("/login", (req, res) => {
    renderFile("login.html", {pageName: "Login"}).then(f => {
        res.send(f);
    });
});

app.post("/login", (req, res) => {
    console.log("User attempting to log in");
});

app.get("/login.html", (req, res) => {
    res.redirect("/login");
});

app.get("/", (req, res) => {
    res.redirect("/login");
});

app.get("/chat", (req, res) => {
    renderFile("chat.html", {}).then(f => {
        res.send(f);
    })
});

app.use(express.static("."));

app.get("*", (req, res) => {
    res.redirect("/login");
});

/*app.listen(port, () => {
    console.log(`Website listening on port ${port}`);
});*/

websocket.on("connection", socket => {
    // console.log("New connection on websocket server.");
    socket.on("message", data => {
        console.log(data);
        websocket.sockets.emit("message-incoming", {value: data});
    });
});

/*websocketServer.listen(port + 1, () => {
    console.log(`Websocket server open on port ${port + 1}`);
});*/

websocketServer.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});