import { queue } from "./queue";
import { status } from "./status";
import { logger } from "./logger";
import { CLI_NAME } from "./constants";
import { unlinkSync } from "fs";
import { ArgsSchema } from "./schema/args";
import { FFProbeSchema } from "./schema/ffprobe";
import { ProgressSchema } from "./schema/ffmpeg";
import { Subprocess as _Subprocess } from "bun";
import { TEMP_PATH, NULL_DEVICE_PATH } from "./paths";

import path from "path";

type Subprocess = _Subprocess<"ignore", "pipe", "pipe">;

let stderr = "";
let forceKilled = false;
let ffmpegProcess: Subprocess | undefined;

const encode = async (args: ArgsSchema) => {
  const duration = deduceDuration(args);

  const inputs = args.inputs.flatMap((input) => {
    const result = [];

    if (input.startTime) {
      result.push("-ss", input.startTime);
    }

    if (input.stopTime) {
      result.push("-to", input.stopTime);
    }

    result.push("-i", input.file);

    return result;
  });

  const outputSeeking = [];

  if (args.output?.startTime) {
    outputSeeking.push("-ss", args.output.startTime);
  }

  if (args.output?.stopTime) {
    outputSeeking.push("-to", args.output.stopTime);
  }

  const lavfi = args.lavfi ? ["-lavfi", args.lavfi] : [];
  const extraParams = args.extraParams || [];

  const encoder = args.extraParams?.includes("-c:v")
    ? args.extraParams[args.extraParams.lastIndexOf("-c:v") + 1]
    : args.encoder;

  const isWebmEncoder = encoder.includes("libvpx");

  const outFile =
    args.output?.file ||
    path.join(
      args.videoPath,
      generateRandomFilename() + (isWebmEncoder ? ".webm" : ".mkv"),
    );

  const userMapping = !!args.extraParams?.includes("-map");

  if (!isWebmEncoder) {
    // if the encoder is not for webms (libvpx/libvpx-vp9), let's just do a single pass with the copied streams
    // the goal here is to copy everything (audio, subtitles, attachments, etc) as is, and encode the video stream
    // with the crf value in constant quality mode, if map is used in extra params, we will drop our mappings
    // this is an escape hatch for users that sometimes want to use other encoders like libx264 with copied streams (me)

    const mappings = userMapping
      ? []
      : args.inputs.flatMap((_, index) => ["-map", index.toString()]);

    const cmd = [
      "ffmpeg",
      "-hide_banner",
      "-progress",
      "pipe:1",
      ...inputs,
      ...outputSeeking,
      ...mappings,
      "-c",
      "copy",
      "-c:v",
      args.encoder,
      "-crf",
      args.crf.toString(),
      ...lavfi,
      "-b:v",
      "0",
      "-preset",
      "veryslow", // veryslow is used here as the preset, can be changed with extra params which takes precedence
      ...extraParams,
      outFile,
      "-y",
    ];

    logger.info(
      queue.getStatus() + ": " + "{BLUE}Processing the single pass{/BLUE}",
      {
        logToConsole: true,
        fancyConsole: {
          colors: true,
          noNewLine: true,
          clearPreviousLine: true,
        },
      },
    );

    status.updateSinglePass();

    logger.info("Executing: " + cmd.join(" "));

    const singlePassProcess = Bun.spawn({ cmd, stderr: "pipe" });

    ffmpegProcess = singlePassProcess;

    let previousProgressPercentage = 0;

    processStdout(singlePassProcess, (progress) => {
      const newProgressPercentage = Math.trunc(
        (progress.outTime * 100) / duration,
      );

      if (newProgressPercentage !== previousProgressPercentage) {
        // only log unique percentage progress
        logger.info(
          `${queue.getStatus()}: {BLUE}${Math.trunc((progress.outTime * 100) / duration)}%{/BLUE}`,
          {
            logToConsole: true,
            fancyConsole: {
              colors: true,
              noNewLine: true,
              clearPreviousLine: true,
            },
          },
        );

        status.updateSinglePass(newProgressPercentage);

        previousProgressPercentage = newProgressPercentage;
      }
      // need duration
    });

    processStderr(singlePassProcess);

    await singlePassProcess.exited;

    if (ffmpegProcess.exitCode !== 0 && !forceKilled) {
      logger.error(
        "Error processing the single pass, ffmpeg exited with code: " +
          ffmpegProcess.exitCode,
      );
      logger.error(stderr);

      process.exit(1);
    }

    if (forceKilled) {
      logKilled();

      return;
    }

    const queueIsDone = queue.getProcessedCount() === queue.getTotalCount();

    logger.info(queue.getStatus() + ": {GREEN}100%{/GREEN}", {
      logToConsole: true,
      fancyConsole: {
        colors: true,
        noNewLine: queueIsDone ? false : true,
        clearPreviousLine: true,
      },
    });

    status.updateSinglePass(100);

    if (queueIsDone) {
      logger.info("All encodings done");
    }

    return;
  }

  // this is just for convenience to quick burn subtitles for single input streams
  // picks the first input file and burns its subtitles to the output stream
  // this won't work with input seeking since they will be de-synced
  const subtitles = `subtitles=${escapeSpecialCharacters(args.inputs[0].file)}`;

  if (args.subs && args.lavfi) {
    lavfi[1] += "," + subtitles;
  } else if (args.subs) {
    lavfi.push("-lavfi", subtitles);
  }

  // we don't want any of these
  // i could explicitly just map the video stream, but want ffmpeg pick it automatically
  // as the default, if the codec options are used or any mapping, we will skip these
  const noAudio = extraParams.includes("-c:a") || userMapping ? [] : ["-an"];
  const noSoftSubs = extraParams.includes("-c:s") || userMapping ? [] : ["-sn"];

  const noDataStreams =
    extraParams.includes("-c:d") || userMapping ? [] : ["-dn"];

  const cmd = [
    "ffmpeg",
    "-hide_banner",
    "-progress",
    "pipe:1",
    ...inputs,
    ...outputSeeking,
    "-c:v",
    args.encoder,
    "-crf",
    args.crf.toString(),
    "-deadline",
    args.deadline,
    "-cpu-used",
    args.cpuUsed.toString(),
    ...lavfi,
    "-b:v",
    "0",
    "-row-mt",
    "1",
    "-map_metadata",
    "-1",
    "-map_chapters",
    "-1",
  ];

  const passLogFile = path.join(TEMP_PATH, CLI_NAME + "2pass");

  const firstPassCmd = [
    ...cmd,
    "-dn",
    "-sn",
    "-an", // first pass doesn't need audio
    "-f",
    "null",
    "-pass",
    "1",
    "-passlogfile",
    passLogFile,
    ...extraParams,
    NULL_DEVICE_PATH,
    "-y",
  ];

  const secondPassCmd = [
    ...cmd,
    ...noAudio,
    ...noSoftSubs,
    ...noDataStreams,
    "-f",
    "webm",
    "-pass",
    "2",
    "-passlogfile",
    passLogFile,
    ...extraParams,
    outFile,
    "-y",
  ];

  // first try tries to encode with just the crf value (constant quality mode
  // triggered by b:v 0), subsequent tries will try to encode with bitrate calculation
  // bitrate = size limit / duration * 8
  // with the exceeding percentage removed in the following tries with a minimum of 0.02%

  let failed: boolean;
  let bitrate = 0;
  let triesCount = 1;

  const limitInBytes = args.sizeLimit * 1024 ** 2; // convert from MiB to bytes

  do {
    failed = false;

    logger.info(
      `${queue.getStatus()}: {BLUE}Processing the first pass${triesCount > 1 ? ` {YELLOW}(try ${triesCount}){/YELLOW}` : ""}{/BLUE}`,
      {
        logToConsole: true,
        fancyConsole: {
          colors: true,
          noNewLine: true,
          clearPreviousLine: true,
        },
      },
    );

    status.updateFirstPass(undefined, triesCount);

    logger.info("Executing: " + firstPassCmd.join(" "));

    const firstPassProcess = Bun.spawn({ cmd: firstPassCmd, stderr: "pipe" });

    ffmpegProcess = firstPassProcess;

    processStderr(firstPassProcess);

    await firstPassProcess.exited;

    if (firstPassProcess.exitCode !== 0 && !forceKilled) {
      logger.error("Couldn't process first pass");

      removePassLogFile(passLogFile);

      process.exit(1);
    }

    if (forceKilled) {
      removePassLogFile(passLogFile);

      logKilled();

      return;
    }

    logger.info(
      `${queue.getStatus()}: {BLUE}Processing the second pass${triesCount > 1 ? ` {YELLOW}(try ${triesCount}){/YELLOW}` : ""}{/BLUE}`,
      {
        logToConsole: true,
        fancyConsole: {
          colors: true,
          noNewLine: true,
          clearPreviousLine: true,
        },
      },
    );

    status.updateSecondPass(undefined, triesCount);

    logger.info("Executing: " + secondPassCmd.join(" "));

    const secondPassProcess = Bun.spawn({ cmd: secondPassCmd, stderr: "pipe" });

    ffmpegProcess = secondPassProcess;

    let previousProgressPercentage = 0;

    processStdout(secondPassProcess, (progress) => {
      const newProgressPercentage = Math.trunc(
        (progress.outTime * 100) / duration,
      );

      if (newProgressPercentage !== previousProgressPercentage) {
        // only log unique percentage progress
        logger.info(
          `${queue.getStatus()}: {BLUE}${Math.trunc((progress.outTime * 100) / duration)}%${triesCount > 1 ? ` {YELLOW}(try ${triesCount}){/YELLOW}` : ""}{/BLUE}`,
          {
            logToConsole: true,
            fancyConsole: {
              colors: true,
              noNewLine: true,
              clearPreviousLine: true,
            },
          },
        );

        status.updateSecondPass(newProgressPercentage, triesCount);

        previousProgressPercentage = newProgressPercentage;
      }

      if (limitInBytes === 0 || failed || progress.totalSize <= limitInBytes) {
        return;
      }

      failed = true;

      const offsetPercentage = Number(
        (((progress.totalSize - limitInBytes) / limitInBytes) * 100).toFixed(3),
      );

      logger.warn(
        `${queue.getStatus()}: {RED}File size is greater than the limit by ${offsetPercentage}% with ${triesCount === 1 ? "crf " + args.crf : "bitrate " + (bitrate / 1000).toFixed(2) + "K"}{/RED}`,
        {
          logToConsole: true,
          fancyConsole: {
            colors: true,
            noNewLine: false,
            clearPreviousLine: true,
          },
        },
      );

      if (triesCount === 1) {
        bitrate = Math.floor((limitInBytes / duration) * 8);

        // set the crf to 10 for a targeted bitrate next
        firstPassCmd[firstPassCmd.lastIndexOf("-crf") + 1] = "10";
        secondPassCmd[secondPassCmd.lastIndexOf("-crf") + 1] = "10";
      } else {
        const percent = offsetPercentage < 0.02 ? 0.02 : offsetPercentage;

        bitrate -= Math.floor((percent / 100) * bitrate);
      }

      // replace the b:v 0 with the calculated bitrate
      firstPassCmd[firstPassCmd.lastIndexOf("-b:v") + 1] = bitrate.toString();
      secondPassCmd[secondPassCmd.lastIndexOf("-b:v") + 1] = bitrate.toString();

      logger.warn(
        `${queue.getStatus()}: {RED}Retrying with bitrate ${(bitrate / 1000).toFixed(2)}K{/RED}`,
        {
          logToConsole: true,
          fancyConsole: {
            colors: true,
            noNewLine: false,
            clearPreviousLine: false,
          },
        },
      );

      triesCount++;

      secondPassProcess.kill("SIGKILL");
    });

    processStderr(secondPassProcess);

    await secondPassProcess.exited;
  } while (failed);

  removePassLogFile(passLogFile);

  if (ffmpegProcess.exitCode !== 0 && !forceKilled) {
    logger.error(
      "Error processing the second pass, ffmpeg exited with code: " +
        ffmpegProcess.exitCode,
    );

    logger.error(stderr);

    process.exit(1);
  }

  if (forceKilled) {
    logKilled();

    return;
  }

  const queueIsDone = queue.getProcessedCount() === queue.getTotalCount();

  logger.info(queue.getStatus() + ": {GREEN}100%{/GREEN}", {
    logToConsole: true,
    fancyConsole: {
      colors: true,
      noNewLine: queueIsDone ? false : true,
      clearPreviousLine: true,
    },
  });

  status.updateSecondPass(100);

  if (queueIsDone) {
    logger.info("All encodings done");
  }
};

const processStderr = async (process: Subprocess) => {
  for await (const chunk of process.stderr) {
    stderr += new TextDecoder().decode(chunk);
  }
};

const logKilled = () => {
  logger.warn("ffmpeg was killed");

  logger.info(queue.getStatus() + ": {RED}Killed{/RED}", {
    logToConsole: true,
    fancyConsole: {
      colors: true,
      noNewLine: false,
      clearPreviousLine: true,
    },
  });
};

const processStdout = async (
  process: Subprocess,
  onProgress: (progress: ProgressSchema) => void,
) => {
  for await (const chunk of process.stdout) {
    const text = new TextDecoder().decode(chunk);

    const data: Record<string, string> = {};

    text.split("\n").forEach((line) => {
      const [key, value] = line.split("=");

      if (!key || !value) {
        return;
      }

      data[key.trim()] = value.trim();
    });

    const parsedProgress = ProgressSchema.safeParse(data);

    if (!parsedProgress.success) {
      // values can be N/A, skip them to keep showing the previous values
      continue;
    }

    onProgress(parsedProgress.data);
  }
};

const kill = () => {
  if (!ffmpegProcess) {
    return;
  }

  logger.info(`Killing ffmpeg (PID: ${ffmpegProcess.pid})`);

  forceKilled = true;
  ffmpegProcess.kill("SIGKILL");
};

const removePassLogFile = (file: string) => {
  file = file + "-0.log";

  try {
    logger.info(`Deleting the ${file} file`);

    unlinkSync(file);
  } catch (error) {
    logger.error("Couldn't delete pass log file: " + file);

    if (error instanceof Error) {
      logger.error(error.message);
    }
  }
};

const generateRandomFilename = () =>
  Date.now() +
  Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");

const getSeconds = (timestamp: string) => {
  const parts = timestamp.split(":").map(Number);

  let seconds = 0;

  while (parts.length) {
    seconds = seconds * 60 + (parts.shift() || 0);
  }

  return Number(seconds.toFixed(3));
};

const escapeSpecialCharacters = (value: string) =>
  value
    // Square brackets
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    // Single quotes
    .replace(/'/g, "\\\\\\'")
    // Semicolon
    .replace(/;/g, "\\;")
    // Colon
    .replace(/:/g, "\\\\:")
    // Comma
    .replace(/,/g, "\\,");

const deduceDuration = (args: ArgsSchema) => {
  // if output seeking stop time is set with no output start time, the
  // duration will be the stop time
  if (args.output?.stopTime && !args.output?.startTime) {
    return getSeconds(args.output.stopTime);
  } else if (args.output?.startTime && args.output?.stopTime) {
    // if both output seeking start and stop times are set, let's remove
    // the start time from the stop time
    return getSeconds(args.output.stopTime) - getSeconds(args.output.startTime);
  }

  const { data: metadata, error } = getInputMetadata(args.inputs);

  if (error) {
    logger.error("Error reading the input metadata");
    logger.error(error.message);

    process.exit(1);
  }

  // the following is a very simplistic approach to deduce the duration
  // but should work for most cases

  // the duration is only used for bitrate calculation for size limited
  // webms and the percentage that is shown during the encoding process

  // no output seeking, let's just pick the longest input if no lavfi concat
  // with the input seeking times or duration of the input metadata
  if (!args.lavfi?.includes("concat")) {
    const durations = getInputDurations(args.inputs, metadata);

    return Math.max(...durations);
  }

  // if lavfi concat is used, let's sum the durations of the inputs
  const durations = getInputDurations(args.inputs, metadata);

  return durations.reduce((acc, curr) => acc + curr, 0);
};

const getInputDurations = (
  inputs: ArgsSchema["inputs"],
  metadata: FFProbeSchema[],
) =>
  metadata.map((input, index) => {
    if (inputs[index].startTime && inputs[index].stopTime) {
      return (
        getSeconds(inputs[index].stopTime) - getSeconds(inputs[index].startTime)
      );
    }

    if (inputs[index].startTime) {
      return input.format.duration - getSeconds(inputs[index].startTime);
    }

    if (inputs[index].stopTime) {
      return getSeconds(inputs[index].stopTime);
    }

    return input.format.duration;
  });

const getInputMetadata = (inputs: { file: string }[]) => {
  const inputsMetadata: FFProbeSchema[] = [];

  try {
    inputs.forEach(({ file }) => {
      const ffprobeProcess = Bun.spawnSync([
        "ffprobe",
        "-v",
        "error",
        "-show_format",
        "-show_streams",
        "-print_format",
        "json",
        file,
      ]);

      if (!ffprobeProcess.success) {
        throw new Error("Error reading the file " + file);
      }

      const parsedOutput = FFProbeSchema.safeParse(
        JSON.parse(ffprobeProcess.stdout.toString()),
      );

      if (!parsedOutput.success) {
        throw new Error(
          "Error parsing the output from ffprobe: " +
            JSON.stringify(parsedOutput.error.flatten().fieldErrors, null, 2),
        );
      }

      inputsMetadata.push(parsedOutput.data);
    });
  } catch (error) {
    if (error instanceof Error) {
      return {
        data: null,
        error,
      };
    }
    throw error;
  }

  return {
    error: null,
    data: inputsMetadata,
  };
};

export const ffmpeg = { kill, encode };
