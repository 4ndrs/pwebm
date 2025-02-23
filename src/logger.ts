import os from "os";
import path from "path";
import winston from "winston";
import Transport from "winston-transport";

import { CONFIG_PATH } from "./paths";
import { existsSync, mkdirSync } from "fs";
import { CLI_NAME, LOG_FILE_NAME } from "./constants";

const logFile = path.join(CONFIG_PATH, LOG_FILE_NAME);

if (!existsSync(CONFIG_PATH)) {
  mkdirSync(CONFIG_PATH, { recursive: true });
}

class CustomConsoleTransport extends Transport {
  log(info: { level: string; message: string }, callback: () => void) {
    if (info.level === "error") {
      console.error(info.message);
    }
    callback();
  }
}

export const logger = winston.createLogger({
  transports: [
    new winston.transports.File({
      filename: logFile,
      level: "debug",
      handleExceptions: true,
      format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
        winston.format.printf(({ level, message, timestamp }) => {
          return `${timestamp} ${os.hostname()} ${CLI_NAME}[${process.pid}]: ${level.toUpperCase()}: ${message}`;
        }),
      ),
    }).on("error", (error) => console.error("file transport error:", error)),
    new CustomConsoleTransport(),
  ],
});

logger.info("Started");
