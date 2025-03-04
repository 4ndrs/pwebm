import { ipc } from "./ipc";
import { queue } from "./queue";
import { logger } from "./logger";

export const assertNever = (value: never) => {
  throw new Error(`Unexpected value: ${value}`);
};

// explicit type needed for the control flow but it doesn't work with promises
// https://github.com/microsoft/TypeScript/issues/34955
type CleanExit = (code?: number) => Promise<never>;

export const cleanExit: CleanExit = async (code = 0) => {
  logger.info("Exiting cleanly...");

  await queue.abortProcessing();

  ipc.stopListener();

  process.exit(code);
};
