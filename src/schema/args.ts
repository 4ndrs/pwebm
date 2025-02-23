import { z } from "zod";
import { config } from "../config";
import { ConfigSchema } from "./config";

export const ArgsSchema = ConfigSchema.merge(
  z.object({
    output: z.string().optional(),
    version: z.boolean().optional(),
    status: z.boolean().optional(),
    kill: z.boolean().optional(),
    inputs: z.array(
      z.object({
        file: z.string(),
        stopTime: z.string().optional(),
        startTime: z.string().optional(),
        seeking: z.union([z.literal("input"), z.literal("output")]),
      }),
    ),
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
    videosPath: ConfigSchema.shape.videosPath.default(config.videosPath),
  }),
);

export type ArgsSchema = z.infer<typeof ArgsSchema>;
