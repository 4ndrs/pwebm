import packageJson from "../package.json";

export const CLI_NAME = packageJson.bin.pwebm;
export const LOG_FILE_NAME = `${CLI_NAME}.log`;
export const CONFIG_FILE_NAME = "config.toml";

export const AUTHOR = packageJson.author;
export const VERSION = packageJson.version;
export const LICENSE = packageJson.license;
export const HOMEPAGE = packageJson.homepage;
export const DESCRIPTION = packageJson.description;
export const COPYRIGHT_YEAR = "2023";
