import { logger } from "./logger";
import { ffmpeg } from "./ffmpeg";
import { parseArgs } from "./args";
import { FFProbeSchema } from "./schema/ffprobe";

const args = Bun.argv.slice(2);

logger.info("argv: " + args.join(" "));

const parsedArgs = parseArgs(args);

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

parsedArgs.inputs.forEach((input) => {
  const ffprobeProcess = Bun.spawnSync([
    "ffprobe",
    "-v",
    "error",
    "-show_format",
    "-show_streams",
    "-print_format",
    "json",
    input.file,
  ]);

  if (!ffprobeProcess.success) {
    logger.error("Error reading the file " + input.file);

    process.exit(1);
  }
  const parsedOutput = FFProbeSchema.safeParse(
    JSON.parse(ffprobeProcess.stdout.toString()),
  );

  if (!parsedOutput.success) {
    logger.error("Error parsing the output from ffprobe");

    logger.error(parsedOutput.error.errors);

    process.exit(1);
  }

  logger.info(parsedOutput.data, { onlyConsole: true });
});

ffmpeg.encode(parsedArgs);
