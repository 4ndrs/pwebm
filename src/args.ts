import {
  AUTHOR,
  LICENSE,
  VERSION,
  HOMEPAGE,
  CLI_NAME,
  DESCRIPTION,
  COPYRIGHT_YEAR,
} from "./constants";

import { ipc } from "./ipc";
import { config } from "./config";
import { logger } from "./logger";
import { ArgsSchema } from "./schema/args";

const RECOGNIZED_ARGS = [
  "-h",
  "--help",
  "-v",
  "--version",
  "-kill",
  "-status",
  "-i",
  "-ss",
  "-to",
  "-lavfi",
  "-c:v",
  "-deadline",
  "-crf",
  "-cpu-used",
  "-subs",
  "-sl",
  "--size-limit",
  "-ep",
  "--extra-params",
  "--video-path",
];

export const parseArgs = async (args: string[]): Promise<ArgsSchema> => {
  if (args.length === 0) {
    printUsage();

    // if the user isn't using any of the quick actions we require the -i flag
    logger.error("Input file is required");

    process.exit(1);
  }

  const rawArgs: Partial<ArgsSchema> = {};

  let skip = false;
  let isExtraParam = false;
  let seeking: { startTime?: string; stopTime?: string } | undefined;

  const skipNext = () => (skip = true);

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];

    if (skip) {
      skip = false;
      continue;
    }

    if (isExtraParam) {
      rawArgs.extraParams?.push(arg);
      continue;
    }

    if (arg.startsWith("-") && !RECOGNIZED_ARGS.includes(arg)) {
      printUsage();

      logger.error(`Unrecognized argument: ${arg}`);

      process.exit(1);
    }

    if (["-h", "--help"].includes(arg)) {
      printUsage();

      process.exit();
    }

    if (["-v", "--version"].includes(arg)) {
      logger.info(
        `${CLI_NAME} version ${VERSION}\nCopyright (c) ${COPYRIGHT_YEAR} ${AUTHOR}\nLicensed under the ${LICENSE} License\n${HOMEPAGE}`,
        { onlyConsole: true },
      );
      process.exit();
    }

    if (arg === "-kill") {
      try {
        await ipc.sendMessage({ type: "kill" });

        logger.info("Main instance successfully killed", {
          logToConsole: true,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code !== "ENOENT"
        ) {
          logger.error("Couldn't kill the main instance");
        }

        process.exit(1);
      }

      process.exit();
    }

    if (arg === "-status") {
      try {
        const status = await ipc.sendMessage({ type: "status" });

        logger.info(JSON.stringify(status, null, 2), { onlyConsole: true });

        logger.info("Status printed to the screen");
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code !== "ENOENT"
        ) {
          logger.error("Couldn't get the status of the main instance");
        }

        process.exit(1);
      }

      process.exit();
    }

    if (!arg.startsWith("-") && !arg.startsWith("--")) {
      if (rawArgs.output?.file) {
        logger.error("Only one output file is allowed");

        logger.debug(
          `Current output file: ${rawArgs.output.file}, new file: ${arg}`,
        );

        process.exit(1);
      }

      if (!rawArgs.output) {
        rawArgs.output = {};
      }

      rawArgs.output.file = arg;

      continue;
    }

    if (arg === "-ss") {
      if (args[index + 1] === undefined || args[index + 1].startsWith("-")) {
        logMissingArg(arg);

        process.exit(1);
      }

      if (!seeking) {
        seeking = {};
      }

      seeking.startTime = args[index + 1];

      skipNext();

      continue;
    }

    if (arg === "-to") {
      if (args[index + 1] === undefined || args[index + 1].startsWith("-")) {
        logMissingArg(arg);

        process.exit(1);
      }

      if (!seeking) {
        seeking = {};
      }

      seeking.stopTime = args[index + 1];

      skipNext();

      continue;
    }

    if (arg === "-i") {
      if (args[index + 1] === undefined || args[index + 1].startsWith("-")) {
        logMissingArg(arg);

        process.exit(1);
      }

      if (!rawArgs.inputs) {
        rawArgs.inputs = [];
      }

      rawArgs.inputs.push({
        file: args[index + 1],
        ...seeking,
      });

      seeking = undefined;

      skipNext();

      continue;
    }

    if (arg === "-subs") {
      rawArgs.subs = true;

      continue;
    }

    if (arg === "-sl" || arg === "--size-limit") {
      if (args[index + 1] === undefined || args[index + 1].startsWith("-")) {
        logMissingArg(arg);

        process.exit(1);
      }

      const sizeLimit = Number(args[index + 1]);

      if (isNaN(sizeLimit)) {
        logInvalidNumber(arg, sizeLimit);

        process.exit(1);
      }

      rawArgs.sizeLimit = sizeLimit;

      skipNext();

      continue;
    }

    if (arg === "-ep" || arg === "--extra-params") {
      if (args[index + 1] === undefined) {
        logMissingArg(arg);

        process.exit(1);
      }

      isExtraParam = true;

      rawArgs.extraParams = [];

      continue;
    }

    if (arg === "--video-path") {
      if (args[index + 1] === undefined || args[index + 1].startsWith("-")) {
        logMissingArg(arg);

        process.exit(1);
      }

      rawArgs.videoPath = args[index + 1];

      skipNext();

      continue;
    }

    if (arg === "-crf") {
      if (args[index + 1] === undefined || args[index + 1].startsWith("-")) {
        logMissingArg(arg);

        process.exit(1);
      }

      const crf = Number(args[index + 1]);

      if (isNaN(crf)) {
        logInvalidNumber(arg, crf);

        process.exit(1);
      }

      rawArgs.crf = crf;

      skipNext();

      continue;
    }

    if (arg === "-cpu-used") {
      if (args[index + 1] === undefined || args[index + 1].startsWith("-")) {
        logMissingArg(arg);

        process.exit(1);
      }

      const cpuUsed = Number(args[index + 1]);

      if (isNaN(cpuUsed)) {
        logInvalidNumber(arg, cpuUsed);

        process.exit(1);
      }

      if (ArgsSchema.shape.cpuUsed.safeParse(cpuUsed).success === false) {
        logger.error(
          `The ${arg} flag requires a number between 0 and 5 inclusive. "${cpuUsed}" is out of that range`,
        );

        process.exit(1);
      }

      rawArgs.cpuUsed = cpuUsed as 0 | 1 | 2 | 3 | 4 | 5;

      skipNext();

      continue;
    }

    if (arg === "-deadline") {
      if (args[index + 1] === undefined || args[index + 1].startsWith("-")) {
        logMissingArg(arg);

        process.exit(1);
      }

      if (!["good", "best"].includes(args[index + 1])) {
        logger.error(
          `The ${arg} flag requires either "good" or "best". "${args[index + 1]}" is not a valid value`,
        );

        process.exit(1);
      }

      rawArgs.deadline = args[index + 1] as "good" | "best";

      skipNext();

      continue;
    }

    if (arg === "-c:v") {
      if (args[index + 1] === undefined || args[index + 1].startsWith("-")) {
        logMissingArg(arg);

        process.exit(1);
      }

      rawArgs.encoder = args[index + 1];

      skipNext();

      continue;
    }

    if (arg === "-lavfi") {
      if (args[index + 1] === undefined || args[index + 1].startsWith("-")) {
        logMissingArg(arg);

        process.exit(1);
      }

      rawArgs.lavfi = args[index + 1];

      skipNext();

      continue;
    }
  }

  if (seeking) {
    rawArgs.output = { ...rawArgs.output, ...seeking };

    seeking = undefined;
  }

  const parsedArgs = ArgsSchema.safeParse(rawArgs);

  if (!parsedArgs.success) {
    logger.error("Error parsing the arguments");

    logger.error(
      JSON.stringify(parsedArgs.error.flatten().fieldErrors, null, 2),
    );

    process.exit(1);
  }

  return parsedArgs.data;
};

const logMissingArg = (arg: string) =>
  logger.error(`The ${arg} flag requires an argument`);

const logInvalidNumber = (arg: string, value: number) =>
  logger.error(
    `The ${arg} flag requires a number. "${value}" is not a valid number`,
  );

const printUsage = () => {
  const usage = `Usage: ${CLI_NAME} [options] [[infile options] -i infile]... [outfile options] [outfile] [extra params]

${DESCRIPTION}

Positional arguments:
  [outfile]                 The output file. If not specified, a generated unix timestamp as filename will be used
                            and saved to the directory set in the --video-path option

Options:
  -h, --help                 Show this help message
  -v, --version              Show version information
  -kill                      Terminate the running ${CLI_NAME} instance, if there is any
  -status                    Show the current status
  -i <input>                 The input file to encode
  -ss <start_time>           The start time (same as ffmpeg's -ss)
  -to <stop_time>            The stop time (same as ffmpeg's -to)
  -lavfi <filters>           The set of filters to pass to ffmpeg
  -c:v <encoder>             The video encoder to use (default is ${config.encoder})
  -deadline {good,best}      The deadline for libvpx-vp9; good is the recommended one, best has the best
                             compression efficiency but takes the most time (default is ${config.deadline})
  -crf <value>               The crf to use (default is 24)
  -cpu-used {0,1,2,3,4,5}    The cpu-used for libvpx-vp9; a number between 0 and 5 inclusive, the higher
                             the number the faster the encoding will be with a quality trade-off (default is ${config.cpuUsed})
  -subs                      Burn the subtitles onto the output file; this flag will automatically use
                             the subtitles found in the first input file, to use a different file use
                             the -lavfi flag with the subtitles filter directly
  -sl, --size-limit <limit>  The size limit of the output file in MiB, use 0 for no limit (default is ${config.sizeLimit})
  --video-path <path>        The video path where the video files are stored (default is ${config.videoPath})
                             this is overridden if the output file is specified
  -ep, --extra-params <params>
                             The extra parameters to pass to ffmpeg, these will be appended making it
                             possible to override some defaults. This option has to be the last one, everything
                             will be passed as is to ffmpeg

Examples:
  ${CLI_NAME} -i "/tmp/Videos/nijinosaki.mkv" -ss 00:00:02.268 -to 00:00:10.310 
  ${CLI_NAME} -i "/tmp/Videos/nijinosaki.mkv" --size-limit 6 -subs --extra-params -map 0:a -c:a libopus -b:a 128k`;

  logger.info(usage, {
    onlyConsole: true,
  });
};
