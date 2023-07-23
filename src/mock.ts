import { join } from "node:path";

import esbuild from "@umijs/bundler-utils/compiled/esbuild";
import { chalk, glob, lodash, logger, register } from "@umijs/utils";

import { DEFAULT_METHOD, MOCK_FILE_GLOB, VALID_METHODS } from "./constant";

export interface MockRecord {
  id: string;
  method: string;
  path: string;
  handler: any;
  // 是否启用
  enable: boolean;
  // 文件位置
  file?: string;
  // 对应的行
  line?: number;
}
export type RawMockRecord = Omit<MockRecord, "enable">;
export type MockRecords = Record<string, MockRecord>;
function parse(mockKey: string) {
  const spliced = mockKey.split(/\s+/);
  const len = spliced.length;
  if (len === 1) {
    return { method: DEFAULT_METHOD, path: mockKey };
  } else {
    const [method, path] = spliced;
    const upperCaseMethod = method.toUpperCase();
    if (!VALID_METHODS.includes(upperCaseMethod)) {
      logger.error(`method ${method} is not supported`);
    }
    if (!path) {
      logger.error(path, `${mockKey}, path is undefined`);
    }
    return { method: upperCaseMethod, path };
  }
}
export function getMock({ key, obj, file }: any): RawMockRecord {
  const { method, path } = parse(key);
  return {
    method,
    path,
    handler: obj[key],
    file,
    id: `${method} ${path}`
  };
}

export function getMockData(opts: {
  cwd: string;
  mockConfig: { exclude?: string[]; include?: string[] };
}): Record<string, RawMockRecord> {
  register.register({
    implementor: esbuild
  });
  register.clearFiles();

  function normalizeMockFile(file: string) {
    const cwd = opts.cwd.endsWith("/") ? opts.cwd : `${opts.cwd}/`;
    return chalk.yellow(file.replace(cwd, ""));
  }

  const ret = [MOCK_FILE_GLOB, ...(opts.mockConfig.include || [])]
    .reduce<string[]>((memo, pattern) => {
      memo.push(
        ...glob.sync(pattern, {
          cwd: opts.cwd,
          ignore: ["**/*.d.ts", ...(opts.mockConfig.exclude || [])]
        })
      );
      return memo;
    }, [])
    .reduce<Record<string, any>>((memo, file) => {
      const mockFile = join(opts.cwd, file);
      let m;
      try {
        delete require.cache[mockFile];
        m = require(mockFile);
      } catch (e) {
        throw new Error(
          `Mock file ${mockFile} parse failed.\n${(e as Error).message}`,
          {
            cause: e
          }
        );
      }
      // Cannot convert undefined or null to object
      // Support esm and cjs
      const obj = m?.default || m || {};
      for (const key of Object.keys(obj)) {
        const mock = getMock({ key, obj, file });
        // check conflict
        const id = mock.id;
        if (
          !(
            lodash.isArray(mock.handler) ||
            lodash.isPlainObject(mock.handler) ||
            typeof mock.handler === "function"
          )
        ) {
          logger.error(
            `Mock handler must be function or array or object, but got ${typeof mock.handler} for ${
              mock.method
            } in ${mock.file}`
          );
        }

        if (memo[id]) {
          logger.warn(
            `${id} is duplicated in ${normalizeMockFile(
              mockFile
            )} and ${normalizeMockFile(memo[id].file)}`
          );
        }
        memo[id] = mock;
      }
      return memo;
    }, {});
  for (const file of register.getFiles()) {
    delete require.cache[file];
  }
  register.restore();
  return ret;
}
