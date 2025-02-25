import { z } from "zod";
import { DEFAULT_VIDEO_PATH } from "../paths";

import os from "os";

export const ConfigSchema = z.object({
  subs: z.boolean().default(false),
  encoder: z.string().default("libvpx-vp9"),
  sizeLimit: z.number().default(4),
  crf: z.number().default(24),
  cpuUsed: z
    .union([
      z.literal(0),
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
    ])
    .default(0),
  deadline: z.enum(["good", "best"]).default("good"),
  videoPath: z
    .string()
    .default(DEFAULT_VIDEO_PATH)
    .transform((value) => {
      const home = os.homedir();

      if (value.startsWith("~")) {
        return value.replace("~", home);
      }

      if (value.startsWith("$HOME")) {
        return value.replace("$HOME", home);
      }

      return value;
    }),
});

export type ConfigSchema = z.infer<typeof ConfigSchema>;
