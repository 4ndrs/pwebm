import { logger } from "./logger";
import { CLI_NAME } from "./constants";
import { unlinkSync } from "fs";
import { ArgsSchema } from "./schema/args";
import { ProgressSchema } from "./schema/ffmpeg";
import { TEMP_PATH, NULL_DEVICE_PATH } from "./paths";

import path from "path";

type Subprocess = Awaited<ReturnType<typeof encode>>;

let stderr = "";
let ffmpegProcess: Subprocess | undefined;

const encode = async (args: ArgsSchema) => {
  const duration = deduceDuration(args);

  const outFile =
    args.output?.file ||
    path.join(args.videoPath, generateRandomFilename() + ".webm");

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

  // this is just for convenience to quick burn subtitles for single input streams
  // picks the first input file and burns its subtitles to the output stream
  // this won't work with input seeking since they will be de-synced
  const subtitles = `subtitles=${escapeSpecialCharacters(args.inputs[0].file)}`;

  if (args.subs && args.lavfi) {
    lavfi[1] += "," + subtitles;
  } else if (args.subs) {
    lavfi.push("-lavfi", subtitles);
  }

  const noAudio = extraParams.includes("-c:a") ? [] : ["-an"];

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

  const limitInBytes = args.sizeLimit * 1024 ** 2; // convert from MiB to bytes

  logger.info("Processing the first pass");

  logger.info("Executing: " + firstPassCmd.join(" "));

  const firstPassProcess = Bun.spawn({ cmd: firstPassCmd, stderr: "pipe" });

  ffmpegProcess = firstPassProcess;

  //processStdout(firstPassProcess); // no progress data on first pass, all N/A
  processStderr(firstPassProcess);

  await processTermination(firstPassProcess);

  if (firstPassProcess.exitCode !== 0) {
    logger.error("Couldn't process first pass");

    removePassLogFile(passLogFile);

    process.exit(1);
  }

  logger.info("Processing the second pass");

  logger.info("Executing: " + secondPassCmd.join(" "));

  const secondPassProcess = Bun.spawn({ cmd: secondPassCmd, stderr: "pipe" });

  ffmpegProcess = secondPassProcess;

  processStdout(secondPassProcess, (progress) => {
    if (progress.totalSize > limitInBytes) {
      logger.error(`Output file exceeds the size limit`);

      secondPassProcess.kill();
    }
  });

  processStderr(secondPassProcess);

  await processTermination(secondPassProcess);

  removePassLogFile(passLogFile);

  return secondPassProcess;
};

const processStderr = async (process: Subprocess) => {
  for await (const chunk of process.stderr) {
    stderr += new TextDecoder().decode(chunk);
  }
};

const processStdout = async (
  process: Subprocess,
  onProgress?: (progress: ProgressSchema) => void,
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

    onProgress?.(parsedProgress.data);
    console.log("progress:", parsedProgress.data);
  }
};

const processTermination = async (process: Subprocess) => {
  await process.exited;

  if (process.exitCode !== 0) {
    logger.error("ffmpeg exited with code: " + process.exitCode);
    logger.error(stderr);
  }
};

const kill = () => ffmpegProcess?.kill();

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
  // if output seeking stop time is set with no output start time, the duration will be
  // the stop time
  if (args.output?.stopTime && !args.output?.startTime) {
    return getSeconds(args.output.stopTime);
  } else if (args.output?.startTime && args.output?.stopTime) {
    // if both output seeking start and stop times are set, let's remove the start time
    // from the stop time
    return getSeconds(args.output.stopTime) - getSeconds(args.output.startTime);
  }

  const startTimes = args.inputs
    .filter((input) => !!input.startTime)
    .map((input) => getSeconds(input.startTime as string));

  const stopTimes = args.inputs
    .filter((input) => !!input.stopTime)
    .map((input) => getSeconds(input.stopTime as string));

  const start = startTimes.reduce((acc, time) => acc + Number(time), 0);
  const stop = stopTimes.reduce((acc, time) => acc + Number(time), 0);

  return stop - start;
};

const getInputsMetadata = (args: ArgsSchema) => {};

export const ffmpeg = { kill, encode };
