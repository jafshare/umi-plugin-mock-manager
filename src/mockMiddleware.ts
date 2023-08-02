import { logger } from "@umijs/utils";
import { json, urlencoded } from "body-parser";
import multer from "multer";
import { pathToRegexp } from "path-to-regexp";

import { openWithEditor } from "./openWithEditor";

import { type Context } from "./index";

import type { MockRecord, MockRecords } from "./mock";
import type { NextFunction, Request, Response } from "express";

function getPathReAndKeys(path: string) {
  const keys: any[] = [];
  const re = pathToRegexp(path, keys);
  return { re, keys };
}

function decodeParam(val: any) {
  if (typeof val !== "string" || val.length === 0) {
    return val;
  }
  try {
    return decodeURIComponent(val);
  } catch (err) {
    if (err instanceof URIError) {
      err.message = `Failed to decode param ' ${val} '`;
      // @ts-expect-error
      err.status = 400;
      // @ts-expect-error
      err.statusCode = 400;
    }
    throw err;
  }
}
export function mockMiddleware(context: Context) {
  return (req: Request, res: Response, next: NextFunction) => {
    const method = req.method.toUpperCase();
    // 统一增加mock的请求头标识
    res.setHeader("Mock", "true");
    // 增加 mock 自带的接口
    const mockApi = {
      "GET /_mock/_getMock": {
        id: "GET /_mock/_getMock",
        method: "GET",
        path: "/_mock/_getMock",
        handler: getMock(context),
        enable: true,
        type: "mockApi"
      },
      "POST /_mock/_updateMock": {
        id: "POST /_mock/_updateMock",
        method: "POST",
        path: "/_mock/_updateMock",
        handler: updateMock(context),
        enable: true,
        type: "mockApi"
      },
      "POST /_mock/_openSourceWithEditor": {
        id: "POST /_mock/_openSourceWithEditor",
        method: "POST",
        path: "/_mock/_openSourceWithEditor",
        handler: openEditor(context),
        enable: true,
        type: "mockApi"
      }
    };
    const mockRecords: MockRecords = { ...context.mockData, ...mockApi };
    for (const k in mockRecords) {
      const mock = mockRecords[k];
      if (mock.method !== method || !mock.enable) continue;
      let mockPath = mock.path;
      // 如果指定了前缀，需要给每个 url 增加前缀, 排除 mock 内部使用的api
      if (mock.type !== "mockApi" && context.prefix) {
        mockPath = `${context.prefix}${mockPath}`;
      }
      const { keys, re } = getPathReAndKeys(mockPath);
      const m = re.exec(req.path);
      if (m) {
        // 控制是否需要输出被拦截的mock请求
        if (context.config?.log?.match ?? true) {
          logger.info(`[Mock] match -> ${req.url}`);
        }
        context.onMock?.({ mock, isInnerApi: mock.type === "mockApi" });
        if (typeof mock.handler === "function") {
          // 解析params,如果有动态路由参数的话
          const params: Record<string, any> = {};
          for (let i = 1; i < m.length; i += 1) {
            const key = keys[i - 1];
            const prop = key.name;
            const val = decodeParam(m[i]);
            if (val !== undefined) {
              params[prop] = val;
            }
          }
          req.params = params;
          if (method === "GET") {
            mock.handler(req, res, next);
          } else {
            // json 传参格式处理
            json({ limit: "5mb", strict: false })(req, res, () => {
              // urlencoded 传参格式处理
              urlencoded({ limit: "5mb", extended: true })(req, res, () => {
                // form-data 传参格式处理
                multer().any()(req, res, () => {
                  mock.handler(req, res, next);
                });
              });
            });
          }
        } else {
          // 直接返回 json 数据
          res.status(200).json(mock.handler);
        }
        return;
      }
    }
    next();
  };
}

// 获取mock数据
function getMock(context: Context) {
  return (req: Request, res: Response) => {
    const data: (MockRecord & { id: string })[] = [];
    Object.entries(context.mockData).forEach(([key, value]) => {
      data.push({ ...value, id: key });
    });
    res.json({
      code: 1,
      message: "success",
      data
    });
  };
}

// 变更mock数据
function updateMock(context: Context) {
  return (req: Request, res: Response) => {
    const updates = req.body || [];
    // 循环更新
    updates.forEach((u: Pick<MockRecord, "id" | "enable">) => {
      const mock = context.mockData[u.id];
      if (mock) {
        mock.enable = u.enable;
      }
    });
    context.updateTime = Date.now();
    // 同步更新缓存
    context.onCacheUpdate?.();
    res.json({ code: 1, message: "success" });
  };
}
// 打开源码
function openEditor(context: Context) {
  return (req: Request, res: Response) => {
    const data = req.body;
    openWithEditor({ filename: data.file });
    res.json({ code: 1, message: "success" });
  };
}
