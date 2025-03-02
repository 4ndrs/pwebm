import { ffmpeg } from "./ffmpeg";
import { ArgsSchema } from "./schema/args";
import { setTimeout } from "timers/promises";

const store: {
  total: number;
  abort: boolean;
  queue: ArgsSchema[];
  processing: boolean;
} = {
  total: 0,
  queue: [],
  abort: false,
  processing: false,
};

const push = (args: ArgsSchema) => {
  store.queue.push(args);
  store.total++;
};

const abortProcessing = async () => {
  store.abort = true;

  ffmpeg.kill();

  while (store.processing) {
    await setTimeout(100);
  }
};

const processQueue = async () => {
  if (store.processing) {
    return;
  }

  store.processing = true;

  while (getProcessedCount() < store.total) {
    const current = store.queue.shift();

    if (!current) {
      continue;
    }

    await ffmpeg.encode(current);

    if (store.abort) {
      break;
    }
  }

  store.abort = false;
  store.processing = false;
};

const getTotalCount = () => store.total;
const getProcessedCount = () => store.total - store.queue.length;

export const queue = {
  push,
  processQueue,
  getTotalCount,
  abortProcessing,
  getProcessedCount,
};
