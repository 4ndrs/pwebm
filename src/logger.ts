import os from "os";
import path from "path";

import { CONFIG_PATH } from "./paths";
import { CLI_NAME, LOG_FILE_NAME } from "./constants";
import { existsSync, mkdirSync, appendFileSync } from "fs";

type Level = "INFO" | "ERROR" | "WARN" | "DEBUG";

const LEVELS_FOR_CONSOLE: Level[] = ["ERROR"];

const logFile = path.join(CONFIG_PATH, LOG_FILE_NAME);

if (!existsSync(CONFIG_PATH)) {
  mkdirSync(CONFIG_PATH, { recursive: true });
}

const writeToFile = (message: string, level: Level) => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const milliseconds = String(now.getMilliseconds()).padStart(3, "0");

  const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
  const logMessage = `${timestamp} ${os.hostname()} ${CLI_NAME}[${process.pid}]: ${level}: ${message}\n`;

  appendFileSync(logFile, logMessage, "utf-8");
};

type Options = {
  onlyConsole?: boolean; // only logs to console regardless of the allowed level
  logToConsole?: boolean; // logs to console regardless of the allowed level
};

type Message = Parameters<typeof console.log>[0];

const log = (message: Message, level: Level, options?: Options) => {
  let consoleLog: typeof console.log;

  switch (level) {
    case "INFO":
      consoleLog = console.info;
      break;
    case "WARN":
      consoleLog = console.warn;
      break;
    case "ERROR":
      consoleLog = console.error;
      break;
    case "DEBUG":
      consoleLog = console.debug;
      break;
  }

  if (options?.onlyConsole) {
    consoleLog(message);
    return;
  }

  if (LEVELS_FOR_CONSOLE.includes(level) || options?.logToConsole) {
    consoleLog(message);
  }

  writeToFile(message, level);
};

export const logger: {
  [key in Lowercase<Level>]: (message: Message, options?: Options) => void;
} = {
  info: (message, options) => log(message, "INFO", options),
  warn: (message, options) => log(message, "WARN", options),
  error: (message, options) => log(message, "ERROR", options),
  debug: (message, options) => log(message, "DEBUG", options),
};

logger.info("Started");
