import os from "os";
import path from "path";

import { CLI_NAME } from "./constants";

const home = os.homedir();

const configPath = path.join(home, ".config", CLI_NAME);

let videoPath: string;

switch (os.platform()) {
  case "darwin":
    videoPath = path.join(home, "Movies", CLI_NAME);
  case "win32":
  case "linux":
  default:
    videoPath = path.join(home, "Videos", CLI_NAME);
}

export const CONFIG_PATH = configPath;
export const DEFAULT_VIDEO_PATH = videoPath;
