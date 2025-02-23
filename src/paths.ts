import os from "os";
import path from "path";
import envPaths from "env-paths";

import { CLI_NAME } from "./constants";

const home = os.homedir();
const paths = envPaths(CLI_NAME, { suffix: "" });

let videoPath: string;

switch (os.platform()) {
  case "darwin":
    videoPath = path.join(home, "Movies", CLI_NAME);
  case "win32":
  case "linux":
  default:
    videoPath = path.join(home, "Videos", CLI_NAME);
}

export const CONFIG_PATH = paths.config;
export const DEFAULT_VIDEOS_PATH = videoPath;
