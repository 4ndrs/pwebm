import { z } from "zod";
import { ArgsSchema } from "./args";
import { StatusSchema } from "./status";

const KillRequest = z.object({
  type: z.literal("kill"),
  data: z.undefined(),
});

const StatusRequest = z.object({
  type: z.literal("status"),
  data: z.undefined(),
});

const EnqueueRequest = z.object({
  type: z.literal("enqueue"),
  data: ArgsSchema,
});

const SimpleResponse = z.object({
  type: z.union([z.literal("enqueue"), z.literal("kill")]),
  success: z.boolean(),
});

const StatusOKResponse = z.object({
  type: z.literal("status"),
  data: StatusSchema,
  success: z.literal(true),
});

const StatusFAILResponse = z.object({
  type: z.literal("status"),
  data: z.undefined(),
  success: z.literal(false),
});

const StatusResponse = z.union([StatusOKResponse, StatusFAILResponse]);

export const IPCSchema = z.union([KillRequest, StatusRequest, EnqueueRequest]);
export const ResponseSchema = z.union([SimpleResponse, StatusResponse]);

export type IPCSchema = z.infer<typeof IPCSchema>;
export type ResponseSchema = z.infer<typeof ResponseSchema>;
