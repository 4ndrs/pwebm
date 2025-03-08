import os from "os";
import path from "path";

import { TEMP_PATH } from "../paths";
import { PIPE_NAME, SOCKET_NAME } from "../constants";

// windows doesn't have unix sockets but named pipes
export const SOCKET_FILE =
  os.platform() === "win32" ? PIPE_NAME : path.join(TEMP_PATH, SOCKET_NAME);
