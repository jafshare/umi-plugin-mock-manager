# umi-plugin-mock-manager

`mock`管理插件，在已有的`mock`基础功能上，增加页面用来更细粒度的`mock`控制，可以精确到某一条`mock`启用状态。

## 功能

- [x] 提供`ui`页面可以更精确的控制`mock`状态

- [x] 缓存记录每一次的配置修改

- [x] 统一增加前缀,适配`request`的`baseURL`功能

- [x] 点击跳转到对应的源码文件

## 安装

`npm install -D umi-plugin-mock-manager`

## 配置

`config.ts`文件增加如下配置

```ts
export default {
  // 插件的相关配置
  mockManager: {
    // mock 文件夹是默认包含在内的，如果有需要可以手动添加, 支持通配符
    include: ["src/**/mock/**.mock.ts"],
    // 如果 request 设置了 baseURL,则需要增加该前缀，如果定义的每个 mock 记录已包含，则可以不用设置
    prefix: "/api",
    // 默认的 mock 管理页面路由是 /_mock ，可以自定义前缀 /abc , 则访问的路由变为 /abc/_mock
    routeBasename: "",
    // 是否禁用默认的 umi mock 插件, 默认禁用
    autoDisableUmiMock: true,
  },
  // 添加插件
  plugins: ["umi-plugin-mock-manager"]
};
```

## 启动项目


新增`package.json`的`script`
```json
{
  "script":{
    "dev:run-mock": "cross-env REACT_APP_ENV=dev UMI_ENV=dev MOCK_MANAGER=enable max dev"
  }
}
```

启动项目后，访问`/_mock`地址即可

注意：执行的`npm`命令需要保证`umi`的启动命令名是`dev`且`MOCK_MANAGER`变量需要是`enable`(默认是不启用的)，当本插件启用后会禁用`umi`的预设插件`mock`