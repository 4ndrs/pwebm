import { ffmpeg } from "./ffmpeg";
import { ArgsSchema } from "./schema/args";

const store: {
  total: number;
  queue: ArgsSchema[];
  processing: boolean;
} = {
  total: 0,
  queue: [],
  processing: false,
};

const push = (args: ArgsSchema) => {
  store.queue.push(args);
  store.total++;
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
  }

  store.processing = false;
};

const getTotalCount = () => store.total;
const getProcessedCount = () => store.total - store.queue.length;

export const queue = {
  push,
  processQueue,
  getTotalCount,
  getProcessedCount,
};
