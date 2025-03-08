import {
  AUTHOR,
  LICENSE,
  VERSION,
  HOMEPAGE,
  CLI_NAME,
  DESCRIPTION,
  COPYRIGHT_YEAR,
} from "./constants";

import { config } from "./config";
import { ipcClient } from "./ipc/client";
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
  "--no-log-file",
];

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
  -crf <value>               The crf to use (default is ${config.crf})
  -cpu-used {0,1,2,3,4,5}    The cpu-used for libvpx-vp9; a number between 0 and 5 inclusive, the higher
                             the number the faster the encoding will be with a quality trade-off (default is ${config.cpuUsed})
  -subs                      Burn the subtitles onto the output file; this flag will automatically use
                             the subtitles found in the first input file, to use a different file use
                             the -lavfi flag with the subtitles filter directly
  -sl, --size-limit <limit>  The size limit of the output file in MiB, use 0 for no limit (default is ${config.sizeLimit})
  --video-path <path>        The video path where the video files are stored (default is ${config.videoPath})
                             this is overridden if the output file is specified
  --no-log-file              Don't log to the log file
  -ep, --extra-params <params>
                             The extra parameters to pass to ffmpeg, these will be appended making it
                             possible to override some defaults. This option has to be the last one, everything
                             will be passed as is to ffmpeg

Examples:
  ${CLI_NAME} -i "/tmp/Videos/nijinosaki.mkv" -ss 00:00:02.268 -to 00:00:10.310
  ${CLI_NAME} -i "/tmp/Videos/nijinosaki.mkv" --size-limit 6 -subs --extra-params -map 0:a -c:a libopus -b:a 128k`;

  console.info(usage);
};

const logMissingArg = (arg: string) =>
  console.error(`The ${arg} flag requires an argument`);

const logInvalidNumber = (arg: string, value: number) =>
  console.error(
    `The ${arg} flag requires a number. "${value}" is not a valid number`,
  );

const argv = Bun.argv.slice(2);

const rawArgs: Partial<ArgsSchema> = {};

let skip = false;
let isExtraParam = false;
let seeking: { startTime?: string; stopTime?: string } | undefined;

const skipNext = () => (skip = true);

for (let index = 0; index < argv.length; index++) {
  const arg = argv[index];

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

    console.error(`Unrecognized argument: ${arg}`);

    process.exit(1);
  }

  if (["-h", "--help"].includes(arg)) {
    printUsage();

    process.exit();
  }

  if (["-v", "--version"].includes(arg)) {
    console.info(
      `${CLI_NAME} version ${VERSION}\nCopyright (c) ${COPYRIGHT_YEAR} ${AUTHOR}\nLicensed under the ${LICENSE} License\n${HOMEPAGE}`,
    );
    process.exit();
  }

  if (arg === "-kill") {
    try {
      await ipcClient.sendMessage({ type: "kill" });

      console.info("Main instance successfully killed");
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code !== "ENOENT"
      ) {
        console.error("Couldn't kill the main instance");
      }

      process.exit(1);
    }

    process.exit();
  }

  if (arg === "-status") {
    try {
      const status = await ipcClient.sendMessage({ type: "status" });

      console.info(JSON.stringify(status, null, 2));
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code !== "ENOENT"
      ) {
        console.error("Couldn't get the status of the main instance");
      }

      process.exit(1);
    }

    process.exit();
  }

  if (!arg.startsWith("-") && !arg.startsWith("--")) {
    if (rawArgs.output?.file) {
      console.error("Only one output file is allowed");

      console.debug(
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
    if (argv[index + 1] === undefined || argv[index + 1].startsWith("-")) {
      logMissingArg(arg);

      process.exit(1);
    }

    if (!seeking) {
      seeking = {};
    }

    seeking.startTime = argv[index + 1];

    skipNext();

    continue;
  }

  if (arg === "-to") {
    if (argv[index + 1] === undefined || argv[index + 1].startsWith("-")) {
      logMissingArg(arg);

      process.exit(1);
    }

    if (!seeking) {
      seeking = {};
    }

    seeking.stopTime = argv[index + 1];

    skipNext();

    continue;
  }

  if (arg === "-i") {
    if (argv[index + 1] === undefined || argv[index + 1].startsWith("-")) {
      logMissingArg(arg);

      process.exit(1);
    }

    if (!rawArgs.inputs) {
      rawArgs.inputs = [];
    }

    rawArgs.inputs.push({
      file: argv[index + 1],
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
    if (argv[index + 1] === undefined || argv[index + 1].startsWith("-")) {
      logMissingArg(arg);

      process.exit(1);
    }

    const sizeLimit = Number(argv[index + 1]);

    if (isNaN(sizeLimit)) {
      logInvalidNumber(arg, sizeLimit);

      process.exit(1);
    }

    rawArgs.sizeLimit = sizeLimit;

    skipNext();

    continue;
  }

  if (arg === "-ep" || arg === "--extra-params") {
    if (argv[index + 1] === undefined) {
      logMissingArg(arg);

      process.exit(1);
    }

    isExtraParam = true;

    rawArgs.extraParams = [];

    continue;
  }

  if (arg === "--video-path") {
    if (argv[index + 1] === undefined || argv[index + 1].startsWith("-")) {
      logMissingArg(arg);

      process.exit(1);
    }

    rawArgs.videoPath = argv[index + 1];

    skipNext();

    continue;
  }

  if (arg === "--no-log-file") {
    rawArgs.noLogFile = true;

    continue;
  }

  if (arg === "-crf") {
    if (argv[index + 1] === undefined || argv[index + 1].startsWith("-")) {
      logMissingArg(arg);

      process.exit(1);
    }

    const crf = Number(argv[index + 1]);

    if (isNaN(crf)) {
      logInvalidNumber(arg, crf);

      process.exit(1);
    }

    rawArgs.crf = crf;

    skipNext();

    continue;
  }

  if (arg === "-cpu-used") {
    if (argv[index + 1] === undefined || argv[index + 1].startsWith("-")) {
      logMissingArg(arg);

      process.exit(1);
    }

    const cpuUsed = Number(argv[index + 1]);

    if (isNaN(cpuUsed)) {
      logInvalidNumber(arg, cpuUsed);

      process.exit(1);
    }

    if (ArgsSchema.shape.cpuUsed.safeParse(cpuUsed).success === false) {
      console.error(
        `The ${arg} flag requires a number between 0 and 5 inclusive. "${cpuUsed}" is out of that range`,
      );

      process.exit(1);
    }

    rawArgs.cpuUsed = cpuUsed as 0 | 1 | 2 | 3 | 4 | 5;

    skipNext();

    continue;
  }

  if (arg === "-deadline") {
    if (argv[index + 1] === undefined || argv[index + 1].startsWith("-")) {
      logMissingArg(arg);

      process.exit(1);
    }

    if (!["good", "best"].includes(argv[index + 1])) {
      console.error(
        `The ${arg} flag requires either "good" or "best". "${argv[index + 1]}" is not a valid value`,
      );

      process.exit(1);
    }

    rawArgs.deadline = argv[index + 1] as "good" | "best";

    skipNext();

    continue;
  }

  if (arg === "-c:v") {
    if (argv[index + 1] === undefined || argv[index + 1].startsWith("-")) {
      logMissingArg(arg);

      process.exit(1);
    }

    rawArgs.encoder = argv[index + 1];

    skipNext();

    continue;
  }

  if (arg === "-lavfi") {
    if (argv[index + 1] === undefined || argv[index + 1].startsWith("-")) {
      logMissingArg(arg);

      process.exit(1);
    }

    rawArgs.lavfi = argv[index + 1];

    skipNext();

    continue;
  }
}

if (seeking) {
  rawArgs.output = { ...rawArgs.output, ...seeking };

  seeking = undefined;
}

if (!rawArgs.inputs) {
  printUsage();

  // if the user isn't using any of the quick actions we require the -i flag
  console.error("Input file is required");

  process.exit(1);
}

const parsed = ArgsSchema.safeParse(rawArgs);

if (!parsed.success) {
  console.error("Error parsing the arguments");

  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));

  process.exit(1);
}

export const parsedArgs = parsed.data;
