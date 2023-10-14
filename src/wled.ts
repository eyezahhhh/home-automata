import { client as SocketClient, connection as SocketConnection } from "websocket";
import { clamp } from "./utils";

export type Props = {
    secure?: boolean
}

export type WledEffect = (
    "Solid" |
    "Blink" |
    "Breathe" |
    "Wipe" |
    "Wipe Random" |
    "Random Colors" |
    "Sweep" |
    "Dynamic" |
    "Colorloop" |
    "Rainbow" |
    "Scan" |
    "Dual Scan" |
    "Fade" |
    "Chase" |
    "Chase Rainbow" |
    "Running" |
    "Saw" |
    "Twinkle" |
    "Dissolve" |
    "Dissolve Rnd" |
    "Sparkle" |
    "Sparkle+" |
    "Strobe" |
    "Strobe Rainbow" |
    "Mega Strobe" |
    "Blink Rainbow" |
    "Android" |
    "Chase" |
    "Chase Random" |
    "Chase Rainbow" |
    "Chase Flash" |
    "Chase Flash Rnd" |
    "Rainbow Runner" |
    "Colorful" |
    "Traffic Light" |
    "Sweep Random" |
    "Running 2" |
    "Red & Blue" |
    "Stream" |
    "Scanner" |
    "Lighthouse" |
    "Fireworks" |
    "Rain" |
    "Merry Christmas" |
    "Fire Flicker" |
    "Gradient" |
    "Loading" |
    "In Out" |
    "In In" |
    "Out Out" |
    "Out In" |
    "Circus" |
    "Halloween" |
    "Tri Chase" |
    "Tri Wipe" |
    "Tri Fade" |
    "Lightning" |
    "ICU" |
    "Multi Comet" |
    "Dual Scanner" |
    "Stream 2" |
    "Oscillate" |
    "Pride 2015" |
    "Juggle" |
    "Palette" |
    "Fire 2012" |
    "Colorwaves" |
    "BPM" |
    "Fill Noise" |
    "Noise 1" |
    "Noise 2" |
    "Noise 3" |
    "Noise 4" |
    "Colortwinkle" |
    "Lake" |
    "Meteor" |
    "Smooth Meteor" |
    "Railway" |
    "Ripple"
);

export const WLED_EFFECTS: WledEffect[] = ["Solid", "Blink", "Breathe", "Wipe", "Wipe Random", "Random Colors", "Sweep", "Dynamic", "Colorloop", "Rainbow", "Scan", "Dual Scan", "Fade", "Chase", "Chase Rainbow", "Running", "Saw", "Twinkle", "Dissolve", "Dissolve Rnd", "Sparkle", "Sparkle+", "Strobe", "Strobe Rainbow", "Mega Strobe", "Blink Rainbow", "Android", "Chase", "Chase Random", "Chase Rainbow", "Chase Flash", "Chase Flash Rnd", "Rainbow Runner", "Colorful", "Traffic Light", "Sweep Random", "Running 2", "Red & Blue", "Stream", "Scanner", "Lighthouse", "Fireworks", "Rain", "Merry Christmas", "Fire Flicker", "Gradient", "Loading", "In Out", "In In", "Out Out", "Out In", "Circus", "Halloween", "Tri Chase", "Tri Wipe", "Tri Fade", "Lightning", "ICU", "Multi Comet", "Dual Scanner", "Stream 2", "Oscillate", "Pride 2015", "Juggle", "Palette", "Fire 2012", "Colorwaves", "BPM", "Fill Noise", "Noise 1", "Noise 2", "Noise 3", "Noise 4", "Colortwinkle", "Lake", "Meteor", "Smooth Meteor", "Railway", "Ripple"];

export type WledColor = [number, number, number];

function regulate(value: number) {
    return Math.round(clamp(value * 2.55, 0, 255));
}

export class WledSegment {
    private effect: WledEffect | undefined;
    private effectSpeed: number | undefined;
    private effectIntensity: number | undefined;
    private power: boolean | undefined;
    private brightness: number | undefined;
    private palette: [WledColor, WledColor, WledColor] | undefined;

    constructor(private start: number, private end: number) {}

    build() {
        return {
            start: this.start,
            stop: this.end,
            col: this.palette,
            fx: this.effect ? WLED_EFFECTS.indexOf(this.effect) + 1 : undefined,
            sx: this.effectSpeed,
            ix: this.effectIntensity,
            on: this.power,
            bri: this.brightness
        }
    }

    setStart(start: number) {
        this.start = start;
        return this;
    }

    setEnd(end: number) {
        this.end = end;
        return this;
    }

    setEffect(effect: WledEffect) {
        this.effect = effect;
        return this;
    }

    setEffectSpeed(speed: number) {
        this.effectSpeed = regulate(speed);
        return this;
    }

    setEffectIntensity(intensity: number) {
        this.effectIntensity = regulate(intensity);
        return this;
    }

    setPower(on: boolean) {
        this.power = on;
        return this;
    }

    setBrightness(brightness: number) {
        this.brightness = regulate(brightness);
        return this;
    }

    setPalette(palette: [WledColor, WledColor, WledColor]) {
        this.palette = palette.map(c => c.map(regulate)) as [WledColor, WledColor, WledColor];
    }
}

export class WledStateBuilder {
    private power: boolean | undefined;
    private brightness: number | undefined;
    private transition: number | undefined;
    private segments: WledSegment[] = [];

    constructor(private readonly sendCallback: (packet: any) => Promise<void>) {}

    async send() {
        const packet = {
            on: this.power,
            bri: this.brightness,
            transition: this.transition,
            seg: this.segments.map(s => s.build())
        };

        await this.sendCallback(packet);
    }

    createSegment(start: number, end: number) {
        const segment = new WledSegment(start, end);
        this.segments.push(segment);
        return segment;
    }

    setPower(on: boolean) {
        this.power = on;
        return this;
    }

    setBrightness(brightness: number) {
        this.brightness = regulate(brightness);
        return this;
    }

    setTransition(ms: number) {
        this.transition = ms;
        return this;
    }
}

export default class Wled {
    private readonly address: string;
    private socketClient: SocketClient;
    private socketConnection: SocketConnection | null;

    constructor(address: string, props: Props = {}) {
        this.address = `ws${props.secure ? "s" : ""}://${address}`;
    }

    public connect() {
        return new Promise<void>((resolve, reject) => {
            let waiting = true;

            if (this.socketConnection) {
                this.socketConnection.close();
                this.socketClient.removeAllListeners();
            }
    
            this.socketClient = new SocketClient();
            this.socketConnection = null;
    
            this.socketClient.on("connect", connection => {
                this.socketConnection = connection;
                if (waiting) {
                    waiting = false;
                    resolve();
                }
    
                connection.on("close", (code, desc) => {
                    console.log(`Disconnected from socket with code ${code} (${desc})`);
                    this.socketConnection = null;
                    if (waiting) {
                        waiting = false;
                        reject(code);
                    }
                });
    
                connection.on("error", error => {
                    console.log("WLED connection error:", error);
                    this.socketConnection = null;
                    if (waiting) {
                        waiting = false;
                        reject(error);
                    }
                });
            });
    
            this.socketClient.on("connectFailed", error => {
                console.error("WLED client error:", error);
            });
    
            this.socketClient.connect(`${this.address}/ws`);
        });
    }

    public isConnected() {
        return !!this.socketConnection;
    }

    private connectionCheck() {
        if (!this.socketConnection) {
            throw "Not connected to WLED";
        }
        return this.socketConnection;
    }

    public createStateBuilder() {
        return new WledStateBuilder(packet => {
            return new Promise<void>((resolve, reject) => {
                try {
                    const conn = this.connectionCheck();

                    const json = JSON.stringify(packet);
                    console.log(JSON.parse(json));

                    conn.send(json, e => {
                        if (e) {
                            reject(e);
                        } else {
                            resolve();
                        }
                    });
                } catch (e) {
                    return reject(e);
                }
            });
        });
    }
}