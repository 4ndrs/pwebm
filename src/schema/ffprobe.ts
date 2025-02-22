import { z } from "zod";

const Format = z.object({
  format_name: z.string(),
  format_long_name: z.string(),
  size: z.string().transform(Number),
  duration: z.string().transform(Number),
  start_time: z.string(),
});

const Stream = z.object({
  index: z.number(),
  codec_name: z.string(),
  codec_long_name: z.string(),
});

const Video = Stream.extend({
  codec_type: z.literal("video"),
  width: z.number(),
  height: z.number(),
  pix_fmt: z.string(),
  start_time: z.string().optional(),
  duration: z.string().transform(Number).optional(),
});

const Audio = Stream.extend({
  codec_type: z.literal("audio"),
  start_time: z.string().optional(),
  duration: z.string().transform(Number).optional(),
});

const Subtitle = Stream.extend({
  codec_type: z.literal("subtitle"),
});

const Attachment = Stream.merge(
  z.object({
    codec_type: z.literal("attachment"),
    codec_name: Stream.shape.codec_name.optional(),
    codec_long_name: Stream.shape.codec_long_name.optional(),
  }),
);

export const FFProbeSchema = z.object({
  format: Format,
  streams: z.array(z.union([Video, Audio, Subtitle, Attachment])),
});

export type FFProbeSchema = z.infer<typeof FFProbeSchema>;
