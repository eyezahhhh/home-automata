import * as AVR from "./avr";
import "./express";

console.log("Connecting to AVR...");
AVR.connect(process.env.AVR_ADDRESS).then(async () => {
    console.log("Connected to AVR!");

    // await AVR.setListeningMode("stereo");
    // await AVR.setInput("bluetooth");
});