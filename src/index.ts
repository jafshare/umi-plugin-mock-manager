import fs from "node:fs";
import path from "node:path";

import { chalk, lodash, logger } from "@umijs/utils";

import { getMockData } from "./mock";
import { mockMiddleware } from "./mockMiddleware";
import { watch } from "./watch";

import type { MockRecords, RawMockRecord } from "./mock";
import type { IApi } from "@umijs/max";

const pluginDir = "plugin-mockManager";
const mockCacheDir = "node_modules/.cache/mock";
function getFileContent(filename: string) {
  return fs.readFileSync(path.join(__dirname, filename), "utf-8");
}
function getComponentPath(filename: string) {
  return path.join(process.cwd(), "src", ".umi", pluginDir, filename);
}
export function readMockCache(): MockRecords {
  const mockCachePath = path.join(process.cwd(), mockCacheDir, "mock.json");
  if (fs.existsSync(mockCachePath)) {
    return JSON.parse(fs.readFileSync(mockCachePath, "utf-8"));
  }
  return {};
}
export function saveMockCache(data: MockRecords) {
  const mockCachePath = path.join(process.cwd(), mockCacheDir, "mock.json");
  // 不存在则先创建对应的目录
  if (!fs.existsSync(mockCachePath)) {
    fs.mkdirSync(path.join(process.cwd(), mockCacheDir));
  }
  fs.writeFileSync(
    path.join(process.cwd(), mockCacheDir, "mock.json"),
    JSON.stringify(data, null, 2)
  );
}
function mergeMockData(
  oldData: MockRecords,
  newData: Record<string, RawMockRecord>
) {
  const result: MockRecords = {};
  for (const key in newData) {
    const newMock = newData[key];
    const oldMock = oldData[key];
    if (oldMock) {
      result[key] = lodash.defaults(lodash.assign({}, oldMock, newMock), {
        enable: true
      });
    } else {
      result[key] = lodash.defaults(newMock, { enable: true });
    }
  }
  // TODO 考虑删除的场景,目前是直接丢弃了,是否需要保留删除的记录
  return result;
}
export interface Context {
  mockData: MockRecords;
}
export default (api: IApi) => {
  const { mock } = api.userConfig;
  // TODO 扫描mock目录，生成mock完整的配置
  api.describe({
    key: "mockManager",
    config: {
      schema(joi) {
        return joi.object({
          exclude: joi
            .array()
            .items(joi.string())
            .description("exclude files not parse mock"),
          include: joi.array().items(joi.string()),
          // 缓存的mock数据
          cacheOutput: joi.string().default(mockCacheDir),
          log: joi.object({
            // 是否开启mock匹配的日志输出
            match: joi.boolean().default(true)
          })
        });
      }
      // TODO debug 配置控制
    },
    enableBy() {
      // 只有 dev 才默认开启
      return api.name === "dev";
    }
  });
  const context: Context = { mockData: readMockCache() };
  //  获取 mock 相关的配置
  const mockConfig = api.config.mock || {};
  const updateMockData = () => {
    context.mockData = mergeMockData(
      context.mockData,
      getMockData({ cwd: api.cwd, mockConfig })
    );
    // 缓存数据
    saveMockCache(context.mockData);
  };

  // TODO 禁用默认的mock插件
  api.onStart(() => {
    logger.info(
      chalk.greenBright(
        "mock-manger 插件启动, 请访问 /_mock 页面进行 mock 管理"
      )
    );
    const { include = [] } = mockConfig;
    // 初始化mock数据
    updateMockData();
    // 监听 mock 文件变化
    watch({
      path: ["mock", ...include].map((pattern) =>
        path.resolve(api.cwd, pattern)
      ),
      addToUnWatches: true,
      onChange: () => {
        // 更新
        updateMockData();
        logger.info("[Mock] file update successful");
      }
    });
  });
  api.addBeforeMiddlewares(() => {
    return [mockMiddleware(context)];
  });

  api.onGenerateFiles(() => {
    api.writeTmpFile({
      path: `mockManger.tsx`,
      content: getFileContent("mockManager.tsx")
    });
  });
  // 增加单独的 _mock 页面
  api.modifyConfig((memo) => {
    // TODO 增加 mock 页面的路由,需要手动输入地址跳入，后续看能不能直接加一个菜单
    memo.routes.unshift({
      path: "/_mock",
      name: "_mock",
      layout: false,
      component: getComponentPath("mockManger.tsx")
    });
    return memo;
  });
};
