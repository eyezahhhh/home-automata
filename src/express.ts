import Express from "express";
import DotEnv from "dotenv";
import * as FS from "fs";
DotEnv.config();

const app = Express();

for (let moduleName of FS.readdirSync("src/rest")) {
    if (!moduleName.endsWith(".ts")) {
        continue;
    }
    moduleName = moduleName.substring(0, moduleName.length - 3);

    const callback = require(`./rest/${moduleName}`).default;
    if (typeof callback == "function") {
        callback(app);
    }
}

app.get("/", (req, res) => {
    res.send("hello, world!");
});

const port = parseInt(process.env.REST_PORT) || 8080;
app.listen(port, () => {
    console.log(`Started server on port ${port}`);
});