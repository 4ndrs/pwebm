import os from "os";
import path from "path";

import { CLI_NAME } from "./constants";

const home = os.homedir();

const tempPath = path.join(os.tmpdir());
const configPath = path.join(home, ".config", CLI_NAME);

let videoPath: string;
let nullDevicePath: string;

switch (os.platform()) {
  case "darwin":
    nullDevicePath = "/dev/null";
    videoPath = path.join(home, "Movies", CLI_NAME);
    break;
  case "win32":
    nullDevicePath = "NUL";
    videoPath = path.join(home, "Videos", CLI_NAME);
    break;
  case "linux":
  default:
    nullDevicePath = "/dev/null";
    videoPath = path.join(home, "Videos", CLI_NAME);
}

export const expandHome = <T extends string | undefined>(value: T) => {
  if (value?.startsWith("~")) {
    return value.replace("~", home);
  }

  if (value?.startsWith("$HOME")) {
    return value.replace("$HOME", home);
  }

  return value;
};

export const TEMP_PATH = tempPath;
export const CONFIG_PATH = configPath;
export const DEFAULT_VIDEO_PATH = videoPath;
export const NULL_DEVICE_PATH = nullDevicePath;
