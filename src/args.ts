import { ArgsSchema } from "./schema/args";
import { CLI_NAME, VERSION } from "./constants";

export const parseArgs = (args: string[]): ArgsSchema => {
  for (const arg of args) {
    if (["-h", "--help"].includes(arg)) {
      console.info("Usage: pwebm -i <input> [options] [output]");
      process.exit();
    }

    if (["-v", "--version"].includes(arg)) {
      console.info(CLI_NAME, VERSION);
      process.exit();
    }

    if (arg === "-kill") {
      console.info("Requested kill");
      process.exit();
    }

    if (arg === "-status") {
      console.info("Requested status");
      process.exit();
    }
  }
};
