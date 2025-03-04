import { ipc } from "./ipc";
import { queue } from "./queue";
import { logger } from "./logger";
import { CLI_NAME } from "./constants";
import { parseArgs } from "./args";
import { cleanExit } from "./utils";

process.title = CLI_NAME;

process.on("SIGINT", () => {
  logger.warn("Received SIGINT, aborting processing");

  cleanExit(130);
});

process.on("SIGTERM", () => {
  logger.warn("Received SIGTERM, aborting processing");

  cleanExit(143);
});

process.on("SIGHUP", () => {
  logger.warn("Received SIGHUP, aborting processing");

  cleanExit(129);
});

process.on("uncaughtException", (error) => {
  let message = error.message;

  message = error.stack ? `${message}\n${error.stack}` : message;

  logger.error("Uncaught exception: " + message);

  cleanExit(1);
});

process.on("unhandledRejection", (reason) => {
  let message: string;

  if (reason instanceof Error) {
    message = reason.message;

    message = reason.stack ? `${message}\n${reason.stack}` : message;
  } else {
    message = JSON.stringify(reason, null, 2);
  }

  logger.error("Unhandled rejection: " + message);

  cleanExit(1);
});

const args = Bun.argv.slice(2);

logger.info("argv: " + args.join(" "));

const parsedArgs = await parseArgs(args);

// let's check if ffmpeg and ffprobe are available before encoding anything
try {
  const ffmpegProcess = Bun.spawnSync(["ffmpeg", "-hide_banner", "-version"]);

  if (!ffmpegProcess.success) {
    throw new Error(ffmpegProcess.stderr.toString());
  }
} catch (error) {
  logger.error(
    "Error checking ffmpeg executable" +
      (error instanceof Error ? `: ${error.message}` : ""),
  );

  process.exit(1);
}

try {
  const ffprobeProcess = Bun.spawnSync(["ffprobe", "-hide_banner", "-version"]);

  if (!ffprobeProcess.success) {
    throw new Error(ffprobeProcess.stderr.toString());
  }
} catch (error) {
  logger.error(
    "Error checking ffprobe executable" +
      (error instanceof Error ? `: ${error.message}` : ""),
  );

  process.exit(1);
}

try {
  // try sending the args to the running process if there is one
  await ipc.sendMessage({
    type: "enqueue",
    data: parsedArgs,
  });

  logger.info("Sent the encoding parameters to the already running instance", {
    logToConsole: true,
  });
} catch (error) {
  logger.warn("No running instance found, starting a new queue");

  queue.push(parsedArgs);

  ipc.startListener();

  await queue.processQueue();

  ipc.stopListener();
}
