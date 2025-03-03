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

const COLORS = {
  RED: "\u001b[1;91m",
  BLUE: "\u001b[1;94m",
  GREEN: "\u001b[1;92m",
  YELLOW: "\u001b[1;93m",
  ORANGE: "\u001b[1;38;5;208m",
};

const END_COLOR = "\u001b[0m";
const CLEAR_LINE = "\r\u001b[K";

type Options = {
  onlyConsole?: boolean; // only logs to console regardless of the allowed level
  logToConsole?: boolean; // logs to console regardless of the allowed level
  fancyConsole?: {
    colors?: boolean;
    noNewLine?: boolean;
    clearPreviousLine?: boolean;
  };
};

type Message = Parameters<typeof print>[0];

const log = (message: Message, level: Level, options?: Options) => {
  let consoleLog: typeof console.log;

  const skipNewLine = options?.fancyConsole?.noNewLine;

  switch (level) {
    case "INFO":
      consoleLog = (message: string) => print(message, "stdout", skipNewLine);
      break;
    case "WARN":
      message = `{ORANGE}${message}{/ORANGE}`;
      consoleLog = (message: string) => print(message, "stderr", skipNewLine);
      break;
    case "ERROR":
      message = `{RED}${message}{/RED}`;
      consoleLog = (message: string) => print(message, "stderr", skipNewLine);
      break;
    case "DEBUG":
      consoleLog = (message: string) => print(message, "stdout", skipNewLine);
      break;
  }

  if (options?.fancyConsole?.colors || level === "ERROR" || level === "WARN") {
    Object.keys(COLORS).forEach((color) => {
      const endColorRegex = new RegExp(`\\{\/${color}\\}`, "g");
      const startColorRegex = new RegExp(`\\{${color}\\}`, "g");

      message = message.replace(
        startColorRegex,
        COLORS[color as keyof typeof COLORS],
      );

      message = message.replace(endColorRegex, END_COLOR);
    });
  }

  // i don't want the following in the log file
  let consoleMessage = message;

  if (options?.fancyConsole?.clearPreviousLine) {
    consoleMessage = CLEAR_LINE + message;
  }

  if (options?.onlyConsole) {
    consoleLog(consoleMessage);
    return;
  }

  if (LEVELS_FOR_CONSOLE.includes(level) || options?.logToConsole) {
    consoleLog(consoleMessage);
  }

  writeToFile(message, level);
};

const print = (
  message: string,
  output: "stdout" | "stderr",
  skipNewLine?: boolean,
) => {
  const newLine = skipNewLine ? "" : "\n";

  process[output].write(message + newLine);
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
