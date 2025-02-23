import { z } from "zod";
import { DEFAULT_VIDEOS_PATH } from "../paths";

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
  videosPath: z.string().default(DEFAULT_VIDEOS_PATH),
});

export type ConfigSchema = z.infer<typeof ConfigSchema>;
