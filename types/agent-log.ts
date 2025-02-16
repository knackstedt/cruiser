export type LogRecord = {
    block?: "start" | "end",
    level: "info" | "debug" | "warn" | "error" | "fatal" | "stdout" | "stderr",
    time: number,

    // Must have EITHER a msg or data chunk.
    msg?: string,
    chunk?: string;

    state?: string,
    properties?: {
        [key: string]: any
    }
}

export type LogMessage = {
    ev: "log:agent",
    data: LogRecord;
};
