import { z } from "zod";

export const ArgsSchema = z.object({
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
  subs: z.boolean().default(false),
  encoder: z.string().default("libvpx-vp9"),
  lavfi: z.string().optional(),
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
  extraParams: z.array(z.string()).optional(),
});

export type ArgsSchema = z.infer<typeof ArgsSchema>;
