declare module "eiscp" {
    export type ConnectOptions = {
        host: string
        port?: number
        send_delay?: number
        model?: string
        reconnect?: boolean
        reconnect_sleep?: number
        verify_commands?: boolean
    };
    export function connect(options?: ConnectOptions): void;

    export type DiscoverOptions = {
        address?: string
        port?: number
        devices?: number
        timeout?: number
    }

    export type Device = {
        host: string
        port: number
        model: string
        areacode: string
        message: any // todo: improve type
    }

    export const is_connected: boolean;
    export function discover(options: DiscoverOptions, callback: (error: string | false, devices: Device[]) => void): void;
    export function disconnect(): void;
    export function close(): void;

    export function raw(command: any, callback: (error: false, result: string | null) => void): void;
    export function command(command: string, callback: (error: false, result: string | null) => void): void;
    
    export function get_commands(zone: string, callback: (error: string | null, commands: string[]) => void): void;

    export type CommandInfo = {
        description: string;
        arguments: string[]
    }

    export function get_command(command: string, callback: (error: string | null, info: CommandInfo) => void): void;

    export function on(command: "connect", callback: () => void): void;
    export function on(command: "close", callback: () => void): void;
    export function on(command: "error", callback: (error: string) => void): void;
    export function on(command: "debug", callback: (message: string) => void): void;
    export function on(command: "data", callback: (...args: any[]) => void): void; // todo: improve args types
}