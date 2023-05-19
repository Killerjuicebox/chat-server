import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { renderFile } from "ejs";
import { randomInt, createHash } from "crypto";
import { Server } from "socket.io";
import { createServer } from "http";
import { readFileSync, writeFileSync, existsSync } from "fs";
const app = express();
const websocketServer = createServer(app);
const websocket = new Server(websocketServer);
const port = 8080; // move to env eventually

app.use(cookieParser());
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

            const users: [{username: string, password: string, admin: boolean, sessionToken:string, created: string}] = JSON.parse(userFile.toString());
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
                const registrationInfo = {username: body.username, password: createHash("sha256").update(body.password).digest("base64"), admin: false, sessionToken: "", created: new Date().toISOString().split("T")[0]};

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
    let body : {username: string, password: string} = req.body;
    let passwordToCompare = createHash("sha256").update(body.password).digest("base64");
    let users: [{username: string, password: string, admin: boolean, sessionToken: string, created: string}] = JSON.parse(readFileSync("./data/users.json").toString());
    let authenticatedUser = false;
    
    for (const user of users) {
        if (user.username == body.username && user.password == passwordToCompare) {
            let token: string;
            if (user.sessionToken == "") {
                const payload = {username: user.username, admin: user.admin, created: user.created}; // create a separate object for the jwt to use when making a token so it doesnt take into account the password or sessionToken when generating a new password
                token = jwt.sign(payload, "secret", { expiresIn: "1h"}); // placeholder, gonna change this to an env variable sometime in the future
            } else {
                // TODO: properly check for token expiration
                // if (user.sessionToken != "" && jwt.verify(user.sessionToken, "secret"))
                token = user.sessionToken;
                // console.log("user already had an active session token")
                // let test = jwt.verify(user.sessionToken, "secret");
            }
            res.cookie("token", token, {httpOnly: true});
            res.status(200).send("Logged in!");
            // TODO: Figure out how to redirect to the chat room after the login has been verified.
            // res.redirect("/chat");
            authenticatedUser = true;
            break;
        }
    }

    if (!authenticatedUser) {
        res.send("Invalid credentials");
    }
});

app.get("/login.html", (req, res) => {
    res.redirect("/login");
});

app.get("/", (req, res) => {
    res.redirect("/login");
});

app.get("/chat", (req, res) => {
    let user : {username: string, admin: boolean, created: string, iat: number, exp: number} | any;
    
    try {
        user = jwt.verify(req.cookies.token, "secret");
    } catch (err) {
        res.redirect("/login");
    }

    if (user != undefined) {
        renderFile("chat.html", {}).then(f => {
            res.send(f);
        })
    }
});

app.use(express.static("."));

app.get("*", (req, res) => {
    res.redirect("/login");
});

websocket.on("connection", socket => {
    let cookie = socket.handshake.headers.cookie || "";
    socket.on("message", data => {
        let user: { username: string } | any;

        try {
            user = jwt.verify(cookie.slice(cookie.indexOf("=") + 1), "secret");

            if ((data as string).replaceAll(" ", "") != "") {
                websocket.sockets.emit("message-incoming", {value: (user.username + ": " + data).trim()}); // zero filtering going on here 😂
            }
        } catch (err) {
            // TODO: Make sure this works correctly as this code was moved previously and I'm unsure how to redirect without express.
            websocket.sockets.emit("redirect", "/login");
        }
    });
});

websocketServer.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});