import os from "os";
import path from "path";

import { logger } from "./logger";
import { TEMP_PATH } from "./paths";
import { unlinkSync } from "fs";
import { PIPE_NAME, SOCKET_NAME } from "./constants";
import { IPCSchema, ResponseSchema } from "./schema/ipc";

import type { UnixSocketListener } from "bun";

// windows doesn't have unix sockets but named pipes
const SOCKET_FILE =
  os.platform() === "win32" ? PIPE_NAME : path.join(TEMP_PATH, SOCKET_NAME);

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
      data: (socket, rawData) => {
        const parsedData = IPCSchema.safeParse(JSON.parse(rawData.toString()));

        if (!parsedData.success) {
          logger.warn("Invalid data received through the socket. Ignoring...");

          socket.end();

          return;
        }

        const { type, data } = parsedData.data;

        switch (type) {
          case "kill":
            logger.info("Received kill request through the socket");

            socket.end(
              JSON.stringify({
                type: "kill",
                success: true,
              } satisfies ResponseSchema),
            );

            break;
          case "enqueue":
            logger.info("Received enqueue request through the socket");

            // TODO: enqueue data
            data;

            socket.end(
              JSON.stringify({
                type: "enqueue",
                success: true,
              } satisfies ResponseSchema),
            );
            break;
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

const sendMessage = async (message: IPCSchema) =>
  new Promise<void>(async (resolve, reject) => {
    const socket = await Bun.connect({
      unix: SOCKET_FILE,
      socket: {
        data: (socket, rawData) => {
          const parsedData = ResponseSchema.safeParse(
            JSON.parse(rawData.toString()),
          );

          if (!parsedData.success) {
            logger.error("Invalid response received through the socket");

            socket.end();

            return reject();
          }

          const { success } = parsedData.data;

          switch (message.type) {
            case "kill":
              logger.info(
                success
                  ? "Received kill response through the socket"
                  : "Failed to kill the process through the socket",
              );
              break;
            case "enqueue":
              logger.info(
                success
                  ? "Received enqueue response through the socket"
                  : "Failed to enqueue the process through the socket",
              );
              break;
          }

          socket.end();

          resolve();
        },
      },
    });

    switch (message.type) {
      case "kill":
        logger.info("Sending kill request through the socket");
        socket.write(JSON.stringify(message));
        break;
      case "enqueue":
        logger.info("Sending enqueue request through the socket");
        socket.write(JSON.stringify(message));
        break;
    }
  });

export const ipc = {
  sendMessage,
  stopListener,
  startListener,
};
