import { RedoOutlined } from "@ant-design/icons";
import { request, useRequest } from "@umijs/max";
import { Badge, Button, Input, List, Space, Switch, Tag } from "antd";
import React, { useMemo } from "react";

export default () => {
  const [query, setQuery] = React.useState("");
  const { data = [], run: fetchMock } = useRequest("/_mock/_getMock", {
    // TODO 是否需要轮询更新数据
    // pollingInterval: 5 * 1000,
  });
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
  const handleReset = () => {
    setQuery("");
    fetchMock();
  };
  return (
    <>
      <List
        header={
          <Space>
            <Button icon={<RedoOutlined />} onClick={handleReset} />
            <Input
              value={query}
              placeholder="请输入"
              style={{ width: 400 }}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Space>
        }
        footer={
          <div style={{ display: "flex", alignItems: "center" }}>
            <Switch
              checkedChildren="激活所有"
              unCheckedChildren="关闭所有"
              onChange={(val) => handleToggleAllEnable(val)}
              defaultChecked={enableRules.length > 0}
              disabled={dataSource.length === 0}
              style={{ marginRight: 10 }}
            />
            激活 {enableRules.length} 条 ，关闭{" "}
            {dataSource.length - enableRules.length} 条 ，共
            {dataSource.length} 条
          </div>
        }
        bordered
        dataSource={dataSource}
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
            </div>
          </List.Item>
        )}
      />
    </>
  );
};
