import express from "express";
import { renderFile } from "ejs";
import { randomInt, createHash } from "crypto";
import { Server } from "socket.io";
import { createServer } from "http";
import { readFileSync, writeFileSync, existsSync } from "fs";
const app = express();
const websocketServer = createServer(app);
const websocket = new Server(websocketServer);
const port = 8080; // move to env eventually

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
        const waitTime = randomInt(250, 750);

        sleep(waitTime).then(async () => {
            if (!existsSync("./data/users.json")) {
                writeFileSync("./data/users.json", "[]");
            }
            let userFile = readFileSync("./data/users.json");

            if (userFile.toString() == "") {
                writeFileSync("./data/users.json", "[]");
                userFile = readFileSync("./data/users.json");
            }

            const users: [{username: string, password: string, admin: boolean, created: string}] = JSON.parse(userFile.toString());
            let createAccount = true;
            let reason = "";

            for (const user of users) {
                if (user.username == body.username) {
                    createAccount = false;
                    reason = "Account with this username already exists";
                    break;
                } else if (body.username == "" || body.password == "") {
                    createAccount = false;
                    reason = "Cannot have a blank username or password";
                }
            }

            for (const letter of body.username.split("")) {
                if (!"abcdefghijklmnopqrstuvwxyz1234567890".includes(letter.toLowerCase())) {
                    createAccount = false;
                    reason = "Username must contain A-Z, 0-9 characters";
                    break;
                }
            }

            if (createAccount) {
                const registrationInfo = {username: body.username, password: createHash("sha256").update(body.password).digest("base64"), admin: false, created: new Date().toISOString().split("T")[0]};

                users.push(registrationInfo);

                writeFileSync("./data/users.json", JSON.stringify(users));

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

websocket.on("connection", socket => {
    // console.log("New connection on websocket server.");
    socket.on("message", data => {
        console.log(data);
        websocket.sockets.emit("message-incoming", {value: data}); // zero filtering going on here 😂
    });
});

websocketServer.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});