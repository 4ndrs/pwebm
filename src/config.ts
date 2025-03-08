import path from "path";

import { parse } from "smol-toml";
import { CONFIG_PATH } from "./paths";
import { ConfigSchema } from "./schema/config";
import { CONFIG_FILE_NAME } from "./constants";
import { existsSync, readFileSync } from "fs";

const configPath = path.join(CONFIG_PATH, CONFIG_FILE_NAME);

let rawConfig: unknown = {};

if (existsSync(configPath)) {
  try {
    rawConfig = parse(readFileSync(configPath, "utf-8"));
  } catch (error) {
    if (error instanceof Error) {
      console.error(
        "Error parsing the config file " + configPath + ":\n\n" + error.message,
      );

      process.exit(1);
    }

    throw error;
  }
}

const parsedConfig = ConfigSchema.safeParse(rawConfig);

if (!parsedConfig.success) {
  console.error("Error parsing the config file " + configPath);

  const errors = parsedConfig.error.flatten().fieldErrors;

  for (const key in errors) {
    console.error(
      `Error in option "${key}": ` +
        errors[key as keyof typeof errors]?.join("; "),
    );
  }

  process.exit(1);
}

export const config = parsedConfig.data;
