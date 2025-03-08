import { queue } from "./queue";
import { logger } from "./logger";
import { ipcServer } from "./ipc/server";

type AssertNever = (value: never) => never;

export const assertNever: AssertNever = (value) => {
  throw new Error(`Unexpected value: ${value}`);
};

// explicit type needed for the control flow but it doesn't work with promises
// https://github.com/microsoft/TypeScript/issues/34955
type CleanExit = (code?: number) => Promise<never>;

export const cleanExit: CleanExit = async (code = 0) => {
  logger.info("Exiting cleanly...");

  await queue.abortProcessing();

  ipcServer.stop();

  process.exit(code);
};
