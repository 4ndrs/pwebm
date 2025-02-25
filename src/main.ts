import { logger } from "./logger";
import { parseArgs } from "./args";
import { FFProbeSchema } from "./schema/ffprobe";

const args = Bun.argv.slice(2);

logger.info("argv: " + args.join(" "));

const parsedArgs = parseArgs(args);

console.log("parsedArgs:", parsedArgs);

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
