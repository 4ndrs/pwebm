import { FFProbeSchema } from "./schema/ffprobe";

const args = Bun.argv.slice(2);

let inputFile: string;

if (args[0] === "-i" && args[1] !== undefined) {
  inputFile = args[1];
} else {
  console.error("Usage: pwebm -i <input>");

  process.exit(1);
}

const ffprobeProcess = Bun.spawnSync([
  "ffprobe",
  "-v",
  "error",
  "-show_format",
  "-show_streams",
  "-print_format",
  "json",
  inputFile,
]);

if (!ffprobeProcess.success) {
  console.error("Error reading the file");
  process.exit(1);
}

const parsedOutput = FFProbeSchema.safeParse(
  JSON.parse(ffprobeProcess.stdout.toString()),
);

if (!parsedOutput.success) {
  console.error("Error parsing the output from ffprobe");

  console.error(parsedOutput.error.errors);

  process.exit(1);
}

console.log(parsedOutput.data);
