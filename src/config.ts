import path from "path";

import { parse } from "smol-toml";
import { logger } from "./logger";
import { CONFIG_PATH } from "./paths";
import { ConfigSchema } from "./schema/config";
import { CONFIG_FILE_NAME } from "./constants";
import { existsSync, readFileSync } from "fs";

const configPath = path.join(CONFIG_PATH, CONFIG_FILE_NAME);

let rawConfig: unknown = {};

if (existsSync(configPath)) {
  logger.info("Loading config file " + configPath);

  try {
    rawConfig = parse(readFileSync(configPath, "utf-8"));
  } catch (error) {
    if (error instanceof Error) {
      logger.error(
        "Error parsing the config file " + configPath + ":\n\n" + error.message,
      );

      // this is a very roundabout way of exiting the cli, i don't like it at all
      // but it's currently the only way i can exit without breaking the logger
      // this won't show up on the console since handle exceptions is set to true in the file transport
      // this is done in other parts of the cli as well, e.g. in main.ts
      throw new Error();
    }

    throw error;
  }
}

const parsedConfig = ConfigSchema.safeParse(rawConfig);

if (!parsedConfig.success) {
  logger.error("Error parsing the config file " + configPath);

  const errors = parsedConfig.error.flatten().fieldErrors;

  for (const key in errors) {
    logger.error(
      `Error in option "${key}": ` +
        errors[key as keyof typeof errors]?.join("; "),
    );
  }

  throw new Error();
}

export const config = parsedConfig.data;
