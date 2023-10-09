import Eiscp, { CommandInfo } from "eiscp";
import ChildProcess from "child_process";

const listeners = new Map<string, ((response: any) => void)[]>();

function tempListener(event: string, callback: (response: any) => void) {
    const remove = (wrapper: ((response: any) => void)) => {
        const list = listeners.get(event);
        if (list) {
            const index = list.indexOf(wrapper);
            if (index >= 0) {
                list.splice(index, 1);
            }
        }
    }

    const wrapper = (response: any) => {
        remove(wrapper);
        callback(response);
    }
    let list = listeners.get(event);
    if (list) {
        list.push(wrapper);
    } else {
        list = [ wrapper ];
        listeners.set(event, list);
        // @ts-expect-error
        Eiscp.on(event, (response: any) => {
            for (let listener of list!) {
                listener(response);
            }
        })
    }

    return () => remove(wrapper);
}

Eiscp.on("error", e => {
    console.error("AVR Error!", e);
});

export function connect(address: string) {
    return new Promise<void>((resolve, reject) => {
        let waiting = true;

        Eiscp.on("connect", () => {
            if (waiting) {
                waiting = false;
                resolve();
            }
        });

        Eiscp.on("error", () => {
            if (waiting) {
                waiting = false;
                reject();
            }
        });

        Eiscp.on("close", () => {
            if (waiting) {
                waiting = false;
                reject();
            }
        });

        Eiscp.connect({
            host: address,
            model: "SC-LX502",
            verify_commands: false
        });
    });
}



export function getCommands(zone = "main") {
    return new Promise<string[]>((resolve, reject) => {
        Eiscp.get_commands(zone, (e, commands) => {
            if (e) {
                reject();
            } else {
                resolve(commands);
            }
        });
    });
}

export function getCommand(command: string) {
    return new Promise<CommandInfo>((resolve, reject) => {
        Eiscp.get_command(command, (e, args) => {
            if (e) {
                reject();
            } else {
                resolve(args);
            }
        });
    })
}

export type SubscriptionPacket = {
    data: {
        status: {
            duration: number,
            playSpeed: number
        },
        controls: {
            previous: boolean,
            next_: boolean,
            pause: boolean,
            playMode: {} // todo: figure out what this is for
        },
        mediaRoles: {
            mediaData?: {
                playLogicPath: string,
                live: boolean,
                serviceID: string
            }
            title: string,
            asciiTitle?: string,
            description?: string,
            icon?: string,
            type?: "audio",
            timestamp?: number,
            audioType?: "audioBroadcast"
        },
        playId: {
            systemMemberId: string,
            timestamp: number
        },
        state: "playing" | "paused", // todo: figure out what else this can be
        trackRoles: {
            mediaData: {
                composer: string,
                serviceNameOverride: string,
                externalAppName: string,
                artist: string,
                album: string,
                albumArtist: string,
                originalTrackNumber: number,
                serviceID: string
            },
            title: string,
            description: string,
            icon: string,
            audioType: string
        }
    };
    playTime: {
        i64_: number,
        type: "i64_"
    };
    senderVolume: {};
    senderMute: {};
    sender: string;
};

export function subscribe(address: string, callback: (data: SubscriptionPacket) => void) {
    return new Promise<() => void>(async (resolve, reject) => {        
        const child = ChildProcess.spawn("curl", ["-N", "--http0.9", `http://${address}:4545`], {
            stdio: ["pipe", "pipe", "pipe"]
        });

        child.on("close", () => {
            if (waiting) {
                reject();
            }
        });

        child.on("disconnect", () => {
            if (waiting) {
                reject();
            }
        });

        function kill() {
            child.kill();
            callback = null;
        }

        let waiting = true;

        let timeout: NodeJS.Timeout;

        function debounce(chunk: SubscriptionPacket) {
            if (timeout) {
                clearTimeout(timeout);
            }

            timeout = setTimeout(() => {
                if (callback) {
                    callback(chunk);
                }
            }, 50);
        }

        let buffer = "";

        function checkBuffer() {
            let depth = 0;
            let inString = false;

            for (let i = 0; i < buffer.length; i++) {
                const char = buffer[i];

                if (char == `"`) {
                    inString = !inString;
                    continue;
                }

                if (!inString) {
                    if (char == "{") {
                        depth++;
                    } else if (char == "}") {
                        if (!--depth) {
                            const chunk = buffer.substring(0, i + 1);
                            debounce(JSON.parse(chunk));
                            buffer = buffer.substring(i + 1);
                            checkBuffer();
                            return;
                        }
                    }
                }
            }
        }

        child.stdout.on("data", data => {
            if (waiting) {
                waiting = false;
                resolve(() => kill());
            }
            buffer += Buffer.from(data).toString("utf-8");
            checkBuffer();
        });
    });
}

export function setPower(on: boolean) {
    return new Promise<void>((resolve, reject) => {
        Eiscp.command(`system-power ${on ? "on" : "standby"}`, e => {
            if (e) {
                reject();
            } else {
                resolve();
            }
        });
    });
}

export function getVolume() {
    return new Promise<number>((resolve, reject) => {
        let active = true;
        tempListener("volume", (volume: number) => {
            if (active) {
                resolve(volume);
                active = false;
            }
        });

        Eiscp.command("volume query", e => {
            if (e && active) {
                active = false;
                reject();
            }
        });
    });
}

export function setVolume(volume: number) {
    return new Promise<number>((resolve, reject) => {
        let active = true;
        tempListener("volume", (volume: number) => {
            if (active) {
                resolve(volume);
                active = false;
            }
        });

        Eiscp.command(`volume ${Math.min(Math.max(volume, 0), 100)}`, e => {
            if (e && active) {
                active = false;
                reject();
            }
        });
    });
}

export function changeVolume(direction: "up" | "down") {
    return new Promise<number>((resolve, reject) => {
        let active = true;
        tempListener("volume", (volume: number) => {
            if (active) {
                resolve(volume);
                active = false;
            }
        });

        Eiscp.command(`volume level-${direction}`, e => {
            if (e && active) {
                active = false;
                reject();
            }
        });
    });
}

export function isMuted() {
    return new Promise<boolean>((resolve, reject) => {
        let active = true;
        tempListener("audio-muting", (muted: string) => {
            if (active) {
                resolve(muted == "on");
                active = false;
            }
        });

        Eiscp.command("audio-muting query", e => {
            if (e && active) {
                active = false;
                reject();
            }
        });
    });
}

export function setMuted(muted: boolean | "toggle") {
    return new Promise<boolean>((resolve, reject) => {
        let active = true;
        tempListener("audio-muting", (muted: string) => {
            if (active) {
                resolve(muted == "on");
                active = false;
            }
        });

        Eiscp.command(`audio-muting ${muted == true ? "on" : (!muted ? "off" : "toggle")}`, e => {
            if (e && active) {
                active = false;
                reject();
            }
        })
    });
}

// export function getDisplayMode() { // todo: figure out what display mode does
//     return new Promise<"selector-volume" | string>((resolve, reject) => {
//         let active = true;
//         tempListener("display-mode", (displayMode: "selector-volume" | string) => {
//             if (active) {
//                 resolve(displayMode);
//                 active = false;
//             }
//         });

//         Eiscp.command("display-mode query", e => {
//             if (e && active) {
//                 active = false;
//                 reject();
//             }
//         })
//     });
// }

export type DimmerLevel = "bright" | "dim" | "dark" | "shut-off" | "bright-led-off";

export function getDimmerLevel() { // Gets the brightness of the LCD display and LEDs
    return new Promise<DimmerLevel>((resolve, reject) => {
        let active = true;
        tempListener("dimmer-level", (level: DimmerLevel) => {
            if (active) {
                resolve(level);
                active = false;
            }
        });

        Eiscp.command("dimmer-level query", e => {
            if (e && active) {
                active = false;
                reject();
            }
        })
    });
}

export function setDimmerLevel(level: DimmerLevel) { // Changes the brightness of the LCD display and LEDs
    return new Promise<DimmerLevel>((resolve, reject) => {
        let active = true;
        tempListener("dimmer-level", (level: DimmerLevel) => {
            if (active) {
                resolve(level);
                active = false;
            }
        });

        Eiscp.command(`dimmer-level ${level}`, e => {
            if (e && active) {
                active = false;
                reject();
            }
        })
    });
}



export type Input = (
    "hdmi-1" |
    "hdmi-2" |
    "hdmi-3" |
    "hdmi-4" |
    "hdmi-5" |
    "hdmi-6" |
    "hdmi-7" |
    "phono" |
    "am" |
    "fm" |
    "network" |
    "usb" |
    "bluetooth"
);

const idMap: Record<Input | "next" | "previous", string> = {
    "hdmi-1": "dvd",
    "hdmi-2": "video2",
    "hdmi-3": "video3",
    "hdmi-4": "strm-box",
    "hdmi-5": "hdmi-5",
    "hdmi-6": "hdmi-6",
    "hdmi-7": "video4",
    "phono": "phono",
    "am": "am",
    "fm": "fm",
    "network": "network",
    "usb": "usb",
    "bluetooth": "bluetooth",
    "next": "up",
    "previous": "down"
};

export function getCurrentInput() {
    return new Promise<Input>((resolve, reject) => {
        let active = true;

        tempListener("input-selector", (input: string | string[]) => {
            if (active) {
                const map = Object.fromEntries(Object.entries(idMap).map(([k, v]) => [v, k])) as Record<string, Input>;
                active = false;

                if (Array.isArray(input)) {
                    for (let option of input) {
                        if (map[option]) {
                            return resolve(map[option]);
                        }
                    }
                }
                if (typeof input == "string" && map[input]) {
                    return resolve(map[input]);
                }
                if (Array.isArray(input)) {
                    input = input.join();
                }
                reject(`Unknown input type '${input}'`);
            }
        });

        Eiscp.command("input-selector query", e => {
            if (e && active) {
                active = false;
                reject();
            }
        })
    });
}

export function setInput(input: Input | "next" | "previous") {
    return new Promise<Input>((resolve, reject) => {
        let active = true;

        tempListener("input-selector", (input: string | string[]) => {
            if (active) {
                const map = Object.fromEntries(Object.entries(idMap).map(([k, v]) => [v, k])) as Record<string, Input>;
                active = false;

                if (Array.isArray(input)) {
                    for (let option of input) {
                        if (map[option]) {
                            return resolve(map[option]);
                        }
                    }
                }
                if (typeof input == "string" && map[input]) {
                    return resolve(map[input]);
                }
                if (Array.isArray(input)) {
                    input = input.join();
                }
                reject(`Unknown input type '${input}'`);
            }
        });

        Eiscp.command(`input-selector ${idMap[input]}`, e => {
            if (e && active) {
                active = false;
                reject();
            }
        })
    });
}

export type ListeningMode = (
    "pure-audio" |
    "dolby-atmos" |
    "neo-6-cinema" |
    "neo-x-cinema" |
    "dts-x" |
    "neural-x" |
    "stereo" |
    "direct" |
    "theater-dimensional" |
    "mono" |
    "whole-house" |
    "sports" |
    "auto-surround" |
    "auto" |
    "surr" |
    "ster"
)
const LISTENING_MODES: ListeningMode[] = ["pure-audio", "dolby-atmos", "neo-6-cinema", "neo-x-cinema", "dts-x", "neural-x", "stereo", "direct", "theater-dimensional", "mono", "whole-house", "sports", "auto-surround", "auto", "surr", "ster"];

export function getListeningMode() {
    return new Promise<ListeningMode>((resolve, reject) => {
        let active = true;
        tempListener("listening-mode", (mode: ListeningMode | ListeningMode[]) => {
            if (active) {
                active = false;
                if (Array.isArray(mode)) {
                    for (let option of mode) {
                        if (LISTENING_MODES.includes(option)) {
                            return resolve(option);
                        }
                    }
                }
                if (typeof mode == "string" && LISTENING_MODES.includes(mode)) {
                    return resolve(mode);
                }
                if (Array.isArray(mode)) {
                    mode = mode.join() as ListeningMode;
                }
                reject(`Unknown input type '${mode}'`);
            }
        });

        Eiscp.command("listening-mode query", e => {
            if (e && active) {
                active = false;
                reject();
            }
        })
    });
}

export function setListeningMode(mode: ListeningMode | "next" | "previous") {
    return new Promise<ListeningMode>((resolve, reject) => {
        let active = true;
        tempListener("listening-mode", (mode: ListeningMode | ListeningMode[]) => {
            if (active) {
                active = false;
                if (Array.isArray(mode)) {
                    for (let option of mode) {
                        if (LISTENING_MODES.includes(option)) {
                            return resolve(option);
                        }
                    }
                }
                if (typeof mode == "string" && LISTENING_MODES.includes(mode)) {
                    return resolve(mode);
                }
                if (Array.isArray(mode)) {
                    mode = mode.join() as ListeningMode;
                }
                reject(`Unknown input type '${mode}'`);
            }
        });

        let internalMode: string = mode;
        if (internalMode == "next") {
            internalMode = "up";
        }
        if (internalMode == "previous") {
            internalMode = "down";
        }

        Eiscp.command(`listening-mode ${internalMode}`, e => {
            if (e && active) {
                active = false;
                reject();
            }
        })
    });
}