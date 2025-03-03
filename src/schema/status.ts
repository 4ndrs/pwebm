import { z } from "zod";

const Idle = z.object({
  stage: z.literal("IDLE"),
});

const SinglePass = z.object({
  stage: z.literal("SINGLE-PASS"),
  total: z.number(),
  current: z.number(),
  percentage: z.number().optional(),
});

const FirstPass = z.object({
  stage: z.literal("FIRST-PASS"),
  tries: z.number(),
  total: z.number(),
  current: z.number(),
});

const SecondPass = z.object({
  stage: z.literal("SECOND-PASS"),
  tries: z.number(),
  total: z.number(),
  current: z.number(),
  percentage: z.number().optional(),
});

export type StatusSchema = z.infer<typeof StatusSchema>;
export const StatusSchema = z.union([Idle, SinglePass, FirstPass, SecondPass]);
