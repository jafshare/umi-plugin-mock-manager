import { copyFileSync } from "node:fs";
import { basename, join } from "node:path";

import type { IApi } from "father";

function copy(api: IApi) {
  api.onCheck(() => {
    console.log("check");
  });
  api.onStart(() => {
    const { cjs } = api.config;
    cjs?.ignores?.forEach((origin: string) => {
      const target = join(api.paths.absOutputPath, basename(origin));
      copyFileSync(origin, target);
    });
  });
  api.modifyConfig((config) => {
    console.log("config:", config);
    return config;
  });
}
export default copy;
