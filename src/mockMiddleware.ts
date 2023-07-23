import { logger } from "@umijs/utils";
import { json, urlencoded } from "body-parser";
import multer from "multer";
import { pathToRegexp } from "path-to-regexp";

import { type Context, saveMockCache } from "./index";

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
        enable: true
      },
      "POST /_mock/_updateMock": {
        id: "POST /_mock/_updateMock",
        method: "POST",
        path: "/_mock/_updateMock",
        handler: updateMock(context),
        enable: true
      }
    };
    const mockRecords: MockRecords = { ...context.mockData, ...mockApi };
    for (const k in mockRecords) {
      const mock = mockRecords[k];
      if (mock.method !== method || !mock.enable) continue;
      const { keys, re } = getPathReAndKeys(mock.path);
      const m = re.exec(req.path);
      if (m) {
        // TODO 参数控制是否需要输出被拦截的mock请求
        logger.info(`[Mock] ${req.url}`);
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
    res.json({ code: 1, message: "success", data });
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
    // 同步更新缓存
    saveMockCache(context.mockData);
    res.json({ code: 1, message: "success" });
  };
}
