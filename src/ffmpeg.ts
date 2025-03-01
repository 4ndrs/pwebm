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
      "Processing the first pass" +
        (triesCount > 1 ? ` (try ${triesCount})` : ""),
    );

    logger.info("Executing: " + firstPassCmd.join(" "));

    const firstPassProcess = Bun.spawn({ cmd: firstPassCmd, stderr: "pipe" });

    ffmpegProcess = firstPassProcess;

    processStderr(firstPassProcess);

    await firstPassProcess.exited;

    if (firstPassProcess.exitCode !== 0) {
      logger.error("Couldn't process first pass");

      removePassLogFile(passLogFile);

      process.exit(1);
    }

    logger.info(
      "Processing the second pass" +
        (triesCount > 1 ? ` (try ${triesCount})` : ""),
    );

    logger.info("Executing: " + secondPassCmd.join(" "));

    const secondPassProcess = Bun.spawn({ cmd: secondPassCmd, stderr: "pipe" });

    ffmpegProcess = secondPassProcess;

    processStdout(secondPassProcess, (progress) => {
      if (limitInBytes === 0 || failed || progress.totalSize <= limitInBytes) {
        return;
      }

      failed = true;

      const offsetPercentage = Number(
        (((progress.totalSize - limitInBytes) / limitInBytes) * 100).toFixed(3),
      );

      logger.warn(
        `File size is greater than the limit by ${offsetPercentage}% with ${triesCount === 1 ? "crf " + args.crf : "bitrate " + (bitrate / 1000).toFixed(2) + "K"}`,
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

      logger.warn(`Retrying with bitrate ${bitrate / 1000}K`);

      triesCount++;

      secondPassProcess.kill("SIGKILL");
    });

    processStderr(secondPassProcess);

    await secondPassProcess.exited;
  } while (failed);

  removePassLogFile(passLogFile);

  if (ffmpegProcess.exitCode !== 0) {
    logger.error("ffmpeg exited with code: " + ffmpegProcess.exitCode);
    logger.error(stderr);

    process.exit(1);
  }
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
