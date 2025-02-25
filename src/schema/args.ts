import { z } from "zod";
import { config } from "../config";
import { expandHome } from "../paths";
import { ConfigSchema } from "./config";

export const ArgsSchema = ConfigSchema.merge(
  z.object({
    inputs: z.array(
      z.object({
        file: z.string().transform(expandHome),
        stopTime: z.string().optional(),
        startTime: z.string().optional(),
      }),
    ),
    output: z
      .object({
        file: z.string().optional().transform(expandHome),
        stopTime: z.string().optional(),
        startTime: z.string().optional(),
      })
      .optional(),
    lavfi: z.string().optional(),
    extraParams: z.array(z.string()).optional(),
    // the next ones come from the config schema
    // we are just replacing the defaults with the values loaded from the config file
    crf: ConfigSchema.shape.crf.default(config.crf),
    subs: ConfigSchema.shape.subs.default(config.subs),
    encoder: ConfigSchema.shape.encoder.default(config.encoder),
    cpuUsed: ConfigSchema.shape.cpuUsed.default(config.cpuUsed),
    deadline: ConfigSchema.shape.deadline.default(config.deadline),
    sizeLimit: ConfigSchema.shape.sizeLimit.default(config.sizeLimit),
    videoPath: ConfigSchema.shape.videoPath.default(config.videoPath),
  }),
);

export type ArgsSchema = z.infer<typeof ArgsSchema>;
