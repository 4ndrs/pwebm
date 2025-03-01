import { z } from "zod";
import { ArgsSchema } from "./args";

const Enqueue = z.object({
  type: z.literal("enqueue"),
  data: ArgsSchema,
});

const Kill = z.object({
  type: z.literal("kill"),
  data: z.undefined(),
});

export const ResponseSchema = z.object({
  type: z.union([z.literal("enqueue"), z.literal("kill")]),
  success: z.boolean(),
});

export const IPCSchema = z.union([Enqueue, Kill]);

export type IPCSchema = z.infer<typeof IPCSchema>;
export type ResponseSchema = z.infer<typeof ResponseSchema>;
