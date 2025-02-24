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

export const parseArgs = (args: string[]): ArgsSchema => {
  for (const arg of args) {
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
      logger.info("Requested kill", { onlyConsole: true });
      process.exit();
    }

    if (arg === "-status") {
      logger.info("Requested status", { onlyConsole: true });
      process.exit();
    }
  }
};

const printUsage = () => {
  const usage = `Usage: ${CLI_NAME} [options] [[infile options] -i infile]... [[outfile options] outfile]...

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
  -ep, --extra-params <params>
                             The extra parameters to pass to ffmpeg, these will be appended making it
                             possible to override some defaults
  --video-path <path>        The video path where the video files are stored (default is ${config.videoPath})
                             this is overridden if the output file is specified

Examples:
  ${CLI_NAME} -i "/tmp/Videos/nijinosaki.mkv" -ss 00:00:02.268 -to 00:00:10.310 
  ${CLI_NAME} -i "/tmp/Videos/nijinosaki.mkv" --size_limit 6 -subs --extra_params '-map 0:a -c:a libopus -b:a 128k'`;

  logger.info(usage, {
    onlyConsole: true,
  });
};
