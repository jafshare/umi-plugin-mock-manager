import fs from "node:fs";
import path from "node:path";

import { chalk, lodash, logger, portfinder } from "@umijs/utils";

import { getMockData } from "./mock";
import { mockMiddleware } from "./mockMiddleware";
import { watch } from "./watch";

import type { MockRecord, MockRecords, RawMockRecord } from "./mock";
import type { IApi } from "@umijs/max";

const mockPageFile = "MockManager.tsx";
const pluginDir = "plugin-mockManager";
let mockCacheDir = "node_modules/.cache/mock";
function getFileContent(filename: string) {
  return fs.readFileSync(path.join(__dirname, filename), "utf-8");
}
function getComponentPath(filename: string) {
  return path.join(process.cwd(), "src", ".umi", pluginDir, filename);
}
export function readMockCache(): { data: MockRecords; updateTime?: number } {
  const mockCachePath = path.join(process.cwd(), mockCacheDir, "mock.json");
  if (fs.existsSync(mockCachePath)) {
    return JSON.parse(fs.readFileSync(mockCachePath, "utf-8"));
  }
  return { data: {} };
}
export function saveMockCache(data: MockRecords, time: number) {
  const mockCachePath = path.join(process.cwd(), mockCacheDir, "mock.json");
  // 不存在则先创建对应的目录
  if (!fs.existsSync(mockCachePath)) {
    fs.mkdirSync(path.join(process.cwd(), mockCacheDir));
  }
  fs.writeFileSync(
    path.join(process.cwd(), mockCacheDir, "mock.json"),
    JSON.stringify({ data, updateTime: time }, null, 2)
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
function enableBy(api: IApi) {
  // 只有 dev 才默认开启
  if (api.name !== "dev") {
    return false;
  }
  return process.env.MOCK_MANAGER === "enable";
}
export interface Context {
  mockData: MockRecords;
  lastUpdateDate?: string;
  prefix: string;
  updateTime?: number;
  config: Record<string, any>;
  onMock?: (data: { mock: MockRecord; isInnerApi: boolean }) => void;
  // 保存缓存
  onCacheUpdate?: () => void;
}
export default (api: IApi) => {
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
          routeBasename: joi.string(),
          // debug 配置控制
          log: joi.object({
            // 是否开启mock匹配的日志输出
            match: joi.boolean().default(true)
          }),
          /**
           * 统一给 url 增加前缀, 考虑到请求库可以统一设置 baseURL,这里增加一个参数统一做处理
           */
          prefix: joi.string().default(""),
          autoDisableUmiMock: joi.boolean().default(true)
        });
      }
    },
    enableBy: () => enableBy(api)
  });
  // 禁用默认的mock插件
  if (api.userConfig?.autoDisableUmiMock !== false && enableBy(api)) {
    api.skipPlugins(["mock"]);
  }
  //  获取 mock 相关的配置
  const mockConfig = api.userConfig.mockManager || {};
  const { data: mockData, updateTime } = readMockCache();
  const context: Context = {
    mockData,
    prefix: mockConfig?.prefix || "",
    updateTime,
    config: mockConfig,
    onCacheUpdate: () => {
      saveMockCache(context.mockData, context.updateTime as number);
    },
    onMock: (data) => {
      const { mock, isInnerApi } = data;
      if (!isInnerApi) {
        // TODO 缓存历史记录数据
      }
    }
  };
  mockCacheDir = mockConfig?.cacheOutput || mockCacheDir;
  const mockRoutePath = `${mockConfig?.routeBasename || ""}/_mock`;
  const updateMockData = () => {
    context.mockData = mergeMockData(
      context.mockData,
      getMockData({ cwd: api.cwd, mockConfig })
    );
    context.updateTime = Date.now();
    // 缓存数据
    context.onCacheUpdate?.();
  };

  api.onStart(async () => {
    const port = await portfinder.getPortPromise({
      port: Number.parseInt(String(process.env.PORT || 8000))
    });
    logger.info(
      chalk.greenBright(
        `mock-manager 插件启动, 请访问 http://localhost:${port}${mockRoutePath} 页面进行 mock 管理`
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
      path: mockPageFile,
      content: getFileContent(mockPageFile)
    });
  });
  // 增加单独的 _mock 页面
  api.modifyConfig((memo) => {
    // TODO 增加 mock 页面的路由,需要手动输入地址跳入，后续看能不能直接加一个菜单
    // 这里只是为了占位，实际的对应组件是在 modifyRoutes 中生成的,原因是这里会对 component 的文件路径进行校验，导致无法通过
    memo.routes.unshift({
      path: mockRoutePath,
      name: "_mock",
      layout: false
    });
    return memo;
  });
  api.modifyRoutes((memo) => {
    Object.keys(memo).forEach((key) => {
      if (memo[key].name === "_mock") {
        memo[key].file = getComponentPath(mockPageFile);
      }
    });
    return memo;
  });
};
