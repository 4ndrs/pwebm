import { SOCKET_FILE } from "./constants";
import { ResponseSchema } from "../schema/ipc";

import type { IPCSchema } from "../schema/ipc";
import type { StatusSchema } from "../schema/status";

// overloading
type SendMessage = {
  (message: Exclude<IPCSchema, { type: "status" }>): Promise<void>;
  (message: Extract<IPCSchema, { type: "status" }>): Promise<StatusSchema>;
};

const sendMessage: SendMessage = async (message) =>
  new Promise(async (resolve, reject) => {
    try {
      const socket = await Bun.connect({
        unix: SOCKET_FILE,
        socket: {
          data: (socket, rawData) => {
            socket.end();

            const parsedData = ResponseSchema.safeParse(
              JSON.parse(rawData.toString()),
            );

            if (!parsedData.success) {
              // couldn't parse
              console.error("Invalid response received through the socket");

              return reject();
            }

            if (!parsedData.data.success) {
              // request did not succeed
              return reject();
            }

            if (parsedData.data.type === "status") {
              const { data } = parsedData.data;

              return resolve(data);
            }

            return resolve(undefined as void & StatusSchema);
          },
        },
      });

      socket.write(JSON.stringify(message));
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT" &&
        message.type !== "enqueue"
      ) {
        console.error("No current main instance running");
      }

      reject(error);
    }
  });

export const ipcClient = {
  sendMessage,
};
