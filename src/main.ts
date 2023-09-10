import yargs from "yargs";

import { hideBin } from "yargs/helpers";

yargs(hideBin(process.argv))
  .scriptName("pwebm")
  .parserConfiguration({
    "short-option-groups": false,
    "camel-case-expansion": false,
  })
  .command(
    "kill",
    "terminates the running instance (if there is any)",
    {},
    () => console.log("killing the running instance..."),
  )
  .command(
    "status",
    "shows the running instance's current encoding status",
    {},
    () => console.log("showing the status..."),
  )
  .command(
    "$0 [output-file]",
    "encodes a webm with the specified parameters",
    (yargs) =>
      yargs
        .options({
          i: {
            desc: "the input file to encode; can be used multiple times",
            array: true,
            type: "string",
            demandOption: "at least one input file is needed",
            nargs: 1,
          },
          subs: {
            desc: "burn the subtitles",
            default: false,
            type: "boolean",
          },
          "c:v": {
            desc: "the video encoder to use",
            default: "libvpx-vp9",
            type: "string",
            nargs: 1,
          },
          ss: {
            desc: "the start time offset",
            type: "string",
            nargs: 1,
          },
          to: {
            desc: "the stop time offset",
            type: "string",
            nargs: 1,
          },
          lavfi: {
            desc: "the set of filters to pass to ffmpeg",
            type: "string",
            nargs: 1,
          },
          "size-limit": {
            desc: "the size limit of the output file in MB, use 0 for no limit",
            alias: "sl",
            default: 4,
            type: "number",
          },
          crf: {
            desc: "the crf to use",
            default: 24,
            type: "number",
            nargs: 1,
          },
          "cpu-used": {
            desc: "the cpu-used for libvpx-vp9; the higher the number the faster the encoding will be with a quality trade-off",
            default: 0,
            choices: [0, 1, 2, 3, 4, 5],
          },
          deadline: {
            desc: "the deadline for libvpx-vp9; good is the recommended one, best has the best compression efficiency but takes the most time",
            default: "good",
            choices: ["good", "best"],
          },
          "extra-params": {
            desc: "the extra parameters to pass to ffmpeg",
            alias: "ep",
            type: "string",
            nargs: 1,
          },
        })
        .positional("output-file", { desc: "the output file" }),
    (yargs) => console.log("encoding the webm...", yargs),
  )
  .help()
  .version()
  .alias("h", "help")
  .alias("v", "version")
  .strict()
  .parse();
