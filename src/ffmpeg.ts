import { logger } from "./logger";
import { ArgsSchema } from "./schema/args";
import { ProgressSchema } from "./schema/ffmpeg";

import path from "path";

type Event = "close" | "status";
type Subprocess = ReturnType<typeof encode>;

let stderr = "";
let ffmpegProcess: Subprocess | undefined;

const encode = (args: ArgsSchema) => {
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
    ...noAudio,
    "-row-mt",
    "1",
    "-map_metadata",
    "-1",
    "-map_chapters",
    "-1",
    "-f",
    "webm",
    ...extraParams,
    outFile,
    "-y",
  ];

  logger.info("Executing: " + cmd.join(" "));

  const process = Bun.spawn({ cmd, stderr: "pipe" });

  ffmpegProcess = process;

  processStdout(process);
  processStderr(process);
  processTermination(process);

  return process;
};

const processStderr = async (process: Subprocess) => {
  for await (const chunk of process.stderr) {
    stderr += new TextDecoder().decode(chunk);
  }
};

const processStdout = async (process: Subprocess) => {
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
      logger.error(
        "Error parsing progress data: " + JSON.stringify(data, null, 2),
      );

      logger.error(
        JSON.stringify(parsedProgress.error.flatten().fieldErrors, null, 2),
      );

      continue;
    }

    console.log("progress:", parsedProgress.data);
  }
};

const processTermination = async (process: Subprocess) => {
  await process.exited;

  console.log("exited with code:", process.exitCode);

  if (process.exitCode !== 0) {
    console.error(stderr);
  }
};

const kill = () => ffmpegProcess?.kill();
const addEventListener = (event: Event, callback: () => void) => {
  // TODO
};

const generateRandomFilename = () =>
  Date.now() +
  Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");

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

export const ffmpeg = {
  kill,
  encode,
  addEventListener,
};
