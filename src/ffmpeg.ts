import { logger } from "./logger";
import { ArgsSchema } from "./schema/args";
import { ProgressSchema } from "./schema/ffmpeg";

type Event = "close" | "status";
type Subprocess = ReturnType<typeof encode>;

let stderr = "";
let ffmpegProcess: Subprocess | undefined;

const encode = (args: ArgsSchema) => {
  const outFile = args.output?.file || "/dev/null";

  const cmd = [
    "ffmpeg",
    "-hide_banner",
    "-progress",
    "pipe:1",
    "-i",
    args.inputs[0].file,
    "-c:v",
    args.encoder,
    "-f",
    "webm",
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

export const ffmpeg = {
  kill,
  encode,
  addEventListener,
};
