import { Express } from "express";
import Eiscp from "eiscp";
import * as AVR from "../avr";

export default async function(app: Express) {
    let latestPacket: null | AVR.SubscriptionPacket = null;

    Eiscp.on("connect", async () => {
        AVR.subscribe(process.env.AVR_ADDRESS!, data => {
            latestPacket = data;
        });

        const callbacks: (() => Promise<any>)[] = [
            AVR.getPower,
            AVR.getVolume,
            AVR.getCurrentInput,
            AVR.getDimmerLevel,
            AVR.getListeningMode
        ];
        while (1) {
            console.log("Looping");
            for (let i = 0; i < 4; i++) {
                try {
                    await callbacks[i]();
                    await new Promise(r => setTimeout(r, 10));
                } catch (e) {
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        }
    });

    app.get("/avr/raw", (req, res) => {
        res.send(latestPacket);
    });

    app.get("/avr", (req, res) => {
        res.send(AVR.getCache());
    })

    app.get("/avr/volume/:volume", async (req, res) => {
        const volume = parseInt(req.params.volume);
        if (isNaN(volume)) {
            return res.status(400).send("Invalid volume");
        }
        await AVR.setVolume(volume);
        res.send(AVR.getCache());
    });

    app.get("/avr/dimmer/:level", async (req, res) => {
        const level = req.params.level as AVR.DimmerLevel;
        const options: AVR.DimmerLevel[] = ["bright", "bright-led-off", "dark", "dim", "shut-off"];
        
        if (!options.includes(level)) {
            return res.status(400).send("Invalid level");
        }

        await AVR.setDimmerLevel(level);
        res.send(AVR.getCache());
    });

    app.get("/avr/input/:input", async (req, res) => {
        const input = req.params.input as AVR.Input;
        const options: AVR.Input[] = ["hdmi-1", "hdmi-2", "hdmi-3", "hdmi-4", "hdmi-5", "hdmi-6", "hdmi-7", "am", "fm", "bluetooth", "network", "phono", "usb", "pc"];

        if (!options.includes(input)) {
            return res.status(400).send("Invalid input");
        }

        await AVR.setInput(input);
        res.send(AVR.getCache());
    });

    app.get("/avr/listening-mode/:mode", async (req, res) => {
        const mode = req.params.mode as AVR.ListeningMode;
        const options: AVR.ListeningMode[] = ["auto", "auto-surround", "direct", "dolby-atmos", "dts-x", "mono", "neo-6-cinema", "neo-x-cinema", "neural-x", "pure-audio", "sports", "ster", "stereo", "stereo", "surr", "theater-dimensional", "whole-house"];

        if (!options.includes(mode)) {
            return res.status(400).send("Invalid mode");
        }

        await AVR.setListeningMode(mode);
        res.send(AVR.getCache());
    });

    app.get("/avr/power/:state", async (req, res) => {
        const state = req.params.state;

        if (state != "on" && state != "off") {
            return res.status(400).send("Invalid state");
        }

        await AVR.setPower(state == "on");
        res.send(AVR.getCache());
    });
}