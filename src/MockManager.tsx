import { RedoOutlined, DownOutlined, AimOutlined } from "@ant-design/icons";
import { useRequest } from "@umijs/max";
import {
  Badge,
  Button,
  Input,
  List,
  Segmented,
  Space,
  Switch,
  Tag,
  Tree
} from "antd";
import React, { useMemo } from "react";
// 将路径拆分为一个个子目录
function getChildren(path: string) {
  if (!path) return [];
  return path.split("/");
}
const request = async (url: string, options?: RequestInit & { data?: any }) => {
  const { method = "get", data, headers = {}, ...rest } = options || {};
  if (method.toUpperCase() === "POST") {
    //@ts-ignore
    headers["Accept"] = "application/json";
    //@ts-ignore
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url, {
    method,
    headers,
    body: JSON.stringify(data),
    ...rest
  });
  return res.json();
};
export default () => {
  const [query, setQuery] = React.useState("");
  const [mode, setMode] = React.useState("Tree");
  const { data = [], run: fetchMock } = useRequest(
    async () => request("/_mock/_getMock", { method: "get" }),
    {
      // TODO 是否需要轮询更新数据
      // pollingInterval: 5 * 1000,
    }
  );
  const dataSource = useMemo(() => {
    if (!query) {
      return data;
    } else {
      return data.filter((item: any) => item.path.includes(query));
    }
  }, [data, query]);
  const enableRules = useMemo(() => {
    return dataSource.filter((item: any) => item.enable);
  }, [dataSource]);
  // 列表数据
  const listDataSource = useMemo(() => {
    return dataSource;
  }, [dataSource]);
  // 树形结构数据
  const treeDataSource = useMemo(() => {
    const tree: any = {};
    dataSource.forEach((item) => {
      const key = item.file;
      if (tree[key]) {
        tree[key].push(item);
      } else {
        tree[key] = [item];
      }
      // const children = getChildren(item.file || '')
      // console.log('children:',children)
    });
    const result: any[] = [];
    // TODO 优化树形结构
    Object.entries(tree).forEach(([key, val]) => {
      result.push({
        title: key,
        key,
        selectable: false,
        isLeaf: false,
        children: val.map((v) => ({
          title: v.path,
          key: v.id,
          isLeaf: true,
          data: v
        }))
      });
    });
    return result;
  }, [dataSource]);
  const handleToggleEnable = async (item: any) => {
    const { id, enable } = item;
    await request("/_mock/_updateMock", {
      method: "post",
      data: [{ id, enable: !enable }]
    });
    fetchMock();
  };
  const handleToggleAllEnable = async (val: boolean) => {
    await request("/_mock/_updateMock", {
      method: "post",
      data: dataSource.map((item: any) => {
        return { id: item.id, enable: val };
      })
    });
    fetchMock();
  };
  const handleBatchUpdate = async (data: { id: string; enable: boolean }[]) => {
    await request("/_mock/_updateMock", {
      method: "post",
      data
    });
    fetchMock();
  };
  const handleOpenSourceWithEditor = async (item: any) => {
    await request("/_mock/_openSourceWithEditor", {
      method: "post",
      data: item
    });
  };
  const handleReset = () => {
    setQuery("");
    fetchMock();
  };
  return (
    <>
      <div style={{ padding: 20 }}>
        <Space style={{ marginBottom: 10 }}>
          <Button icon={<RedoOutlined />} onClick={handleReset} />
          <Input
            value={query}
            placeholder="请输入"
            style={{ width: 400 }}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Segmented
            value={mode}
            onChange={(val) => setMode(val)}
            options={["Tree", "List"]}
          />
        </Space>
        <div
          style={{ display: "flex", alignItems: "center", padding: "10px 0" }}
        >
          <Switch
            checkedChildren="激活所有"
            unCheckedChildren="关闭所有"
            onChange={(val) => handleToggleAllEnable(val)}
            defaultChecked={enableRules.length > 0}
            disabled={dataSource.length === 0}
            style={{ marginRight: 10 }}
          />
          激活<span style={{ padding: "0 5px" }}>{enableRules.length}</span>条
          ，关闭
          <span style={{ padding: "0 5px" }}>
            {dataSource.length - enableRules.length}
          </span>{" "}
          条 ，共
          <span style={{ padding: "0 5px" }}>{dataSource.length}</span> 条
        </div>
        {mode === "Tree" ? (
          <Tree
            treeData={treeDataSource}
            defaultExpandAll={true}
            switcherIcon={<DownOutlined />}
            checkedKeys={enableRules.map((r) => r.id)}
            onCheck={(checkedKeys, e) => {
              // 如果是子节点，则改变自己即可
              if (e.node.isLeaf) {
                handleBatchUpdate([{ id: e.node.data.id, enable: e.checked }]);
              } else {
                // 如果是父节点，则改变所有的子节点
                handleBatchUpdate(
                  e.node.children.map((item: any) => ({
                    id: item.data.id,
                    enable: e.checked
                  }))
                );
              }
            }}
            titleRender={(item) => {
              if (!item.isLeaf) {
                return (
                  <>
                    {item.title}
                    <Tag style={{ marginLeft: 5 }} color="purple">
                      {item.children.length}
                    </Tag>
                  </>
                );
              } else {
                return (
                  <>
                    <Tag
                      color={
                        item.data.method === "GET" ? "success" : "processing"
                      }
                    >
                      {item.data.method}
                    </Tag>
                    <span style={{ padding: 10 }}>{item.title}</span>
                    <AimOutlined
                    title="点击打开源码查看"
                      onClick={() => handleOpenSourceWithEditor(item.data)}
                    />
                  </>
                );
              }
            }}
            checkable
            showLine
            blockNode
          />
        ) : (
          <List
            bordered
            dataSource={listDataSource}
            renderItem={(item: any) => (
              <List.Item key={item.id}>
                <div>
                  <Tag color={item.method === "GET" ? "success" : "processing"}>
                    {item.method}
                  </Tag>
                  <span onClick={() => handleToggleEnable(item)}>
                    {item.enable ? (
                      <Badge status="success" />
                    ) : (
                      <Badge status="default" />
                    )}
                  </span>
                  <span style={{ padding: 10 }}>{item.path}</span>
                  <Switch
                    checkedChildren="激活"
                    unCheckedChildren="关闭"
                    onChange={() => handleToggleEnable(item)}
                    checked={item.enable}
                    defaultChecked={item.enable}
                  />
                  <AimOutlined
                    title="点击打开源码查看"
                    onClick={() => handleOpenSourceWithEditor(item)}
                  />
                </div>
              </List.Item>
            )}
          />
        )}
      </div>
    </>
  );
};
