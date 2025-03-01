import { logger } from "./logger";
import { ffmpeg } from "./ffmpeg";
import { parseArgs } from "./args";

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

ffmpeg.encode(parsedArgs);
