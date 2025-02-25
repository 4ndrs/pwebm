import { z } from "zod";

export const ProgressSchema = z
  .object({
    progress: z.union([z.literal("continue"), z.literal("end")]),
    total_size: z
      .string()
      .transform(Number)
      .refine((value) => !isNaN(value), { message: "Invalid number" }),
    out_time_us: z
      .string()
      .transform(Number)
      .refine((value) => !isNaN(value), { message: "Invalid number" }),
  })
  .transform((data) => ({
    outTime: data.out_time_us / 1_000_000, // seconds
    progress: data.progress,
    totalSize: data.total_size, // bytes
  }));
