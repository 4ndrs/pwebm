import { ffmpeg } from "./ffmpeg";
import { ArgsSchema } from "./schema/args";

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
  if (!store.processing) {
    return;
  }

  store.abort = true;

  await ffmpeg.kill();
};

const processQueue = async () => {
  if (store.processing) {
    return;
  }

  store.processing = true;

  while (getProcessedCount() < store.total) {
    if (store.abort) {
      break;
    }

    const current = store.queue.shift();

    if (!current) {
      continue;
    }

    await ffmpeg.encode(current);
  }

  store.processing = false;
};

const getTotalCount = () => store.total;
const getProcessedCount = () => store.total - store.queue.length;
const getStatus = () => `Encoding ${getProcessedCount()} of ${store.total}`;

export const queue = {
  push,
  getStatus,
  processQueue,
  getTotalCount,
  abortProcessing,
  getProcessedCount,
};
