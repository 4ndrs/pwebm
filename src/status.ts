import { queue } from "./queue";
import { StatusSchema } from "./schema/status";

type Stage = StatusSchema["stage"];

let store: StatusSchema = {
  stage: "IDLE",
};

const update = (stage: Stage, percentage?: number, tries = 1) => {
  const baseStore = {
    total: queue.getTotalCount(),
    current: queue.getProcessedCount(),
  };

  switch (stage) {
    case "IDLE":
      store = { stage };
      break;
    case "SINGLE-PASS":
      store = {
        ...baseStore,
        stage,
        percentage,
      };
      break;
    case "FIRST-PASS":
      store = {
        ...baseStore,
        stage,
        tries,
      };
      break;
    case "SECOND-PASS":
      store = {
        ...baseStore,
        stage,
        tries,
        percentage,
      };
      break;
  }
};

export const status = {
  getStatus: () => ({ ...store }),
  updateFirstPass: (percentage?: number, tries?: number) =>
    update("FIRST-PASS", percentage, tries),
  updateSinglePass: (percentage?: number) =>
    update("SINGLE-PASS", percentage, undefined),
  updateSecondPass: (percentage?: number, tries?: number) =>
    update("SECOND-PASS", percentage, tries),
};
