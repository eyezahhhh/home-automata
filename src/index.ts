import * as AVR from "./avr";
import "./express";
import Wled from "./wled";

console.log("Connecting to AVR...");
AVR.connect(process.env.AVR_ADDRESS!).then(async () => {
    console.log("Connected to AVR!");

    // await AVR.setListeningMode("stereo");
    // await AVR.setInput("bluetooth");
});

// 192.168.178.36 - main desk (120 leds long)
// 192.168.178.120 - guest desk

const led = new Wled("192.168.178.36");
led.connect().then(() => {

    const builder = led.createStateBuilder();
    builder.setPower(true);

    const segment = builder.createSegment(0, 120)
        .setPower(true)
        .setEffect("Android")
        .setEffectSpeed(1)
        .setPalette([
            [255,255,255],
            [0,255,0],
            [255,255,255]
        ]);
    
    builder.createSegment(0, 0);

    // const otherSegment = builder.createSegment(20, 100)
    //     .setPower(true)
    //     .setEffect("Pride 2015")
    //     .setPalette([
    //         [255,0,0],
    //         [0,255,0],
    //         [0,0,255]
    //     ]);
    

    builder.send().then(() => console.log("done")).catch(console.error);
});