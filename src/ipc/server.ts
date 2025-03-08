import { queue } from "../queue";
import { status } from "../status";
import { logger } from "../logger";
import { unlinkSync } from "fs";
import { assertNever } from "../utils";
import { SOCKET_FILE } from "./constants";
import { IPCSchema, ResponseSchema } from "../schema/ipc";

import os from "os";

import type { UnixSocketListener } from "bun";

let listener: UnixSocketListener<undefined> | undefined;

const startListener = () => {
  if (listener) {
    logger.warn("Listener already started");
    return;
  }

  logger.info("Listening for connections on " + SOCKET_FILE);

  listener = Bun.listen({
    unix: SOCKET_FILE,
    socket: {
      data: async (socket, rawData) => {
        const parsedData = IPCSchema.safeParse(JSON.parse(rawData.toString()));

        if (!parsedData.success) {
          logger.warn("Invalid data received through the socket. Ignoring...");

          socket.end();

          return;
        }

        const { type, data } = parsedData.data;

        switch (type) {
          case "kill":
            logger.info("Received kill signal, aborting the queue");

            await queue.abortProcessing();

            socket.end(
              JSON.stringify({
                type: "kill",
                success: true,
              } satisfies ResponseSchema),
            );

            break;
          case "enqueue":
            logger.info(
              "Received new encoding parameters, adding to the queue",
            );

            queue.push(data);

            socket.end(
              JSON.stringify({
                type: "enqueue",
                success: true,
              } satisfies ResponseSchema),
            );
            break;
          case "status":
            socket.end(
              JSON.stringify({
                type: "status",
                success: true,
                data: status.getStatus(),
              } satisfies ResponseSchema),
            );
            break;
          default:
            assertNever(type);
        }

        socket.end();
      },
    },
  });
};

const stopListener = () => {
  if (!listener) {
    return;
  }

  listener.stop();
  listener = undefined;

  // cleanup socket file if not on windows
  if (os.platform() !== "win32") {
    try {
      logger.info("Deleting the socket file: " + SOCKET_FILE);

      unlinkSync(SOCKET_FILE);
    } catch (error) {
      logger.error("Error deleting socket file: " + SOCKET_FILE);

      logger.error(
        error instanceof Error ? error.message : JSON.stringify(error, null, 2),
      );
    }
  }
};

export const ipcServer = {
  stop: stopListener,
  start: startListener,
};
