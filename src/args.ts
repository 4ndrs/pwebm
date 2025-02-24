import { ArgsSchema } from "./schema/args";
import { CLI_NAME, VERSION } from "./constants";

export const parseArgs = (args: string[]): ArgsSchema => {
  args.forEach((arg) => {
    if (["-h", "--help"].includes(arg)) {
      console.info("Usage: pwebm -i <input> [options] [output]");
      process.exit(0);
    }

    if (["-v", "--version"].includes(arg)) {
      console.info(CLI_NAME, VERSION);
      process.exit(0);
    }

    if (arg === "-kill") {
      console.info("Requested kill");
      process.exit(0);
    }

    if (arg === "-status") {
      console.info("Requested status");
      process.exit(0);
    }
  });
};
