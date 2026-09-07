# 山遥 Web 地图接入

当前选择高德地图 JavaScript API 2.0。前端使用高德官方 Loader；配置 Key 后，地图发现和路线详情会显示真实底图、起终点/节点标记及按游玩顺序连接的折线。没有 Key 或加载失败时继续显示明确标注的示意地图，不能把示意折线宣称为真实可通行道路。

## 本地配置

复制根目录 `.env.example` 为 `.env`，填写：

```text
VITE_AMAP_KEY=Web端JS API Key
VITE_AMAP_SECURITY_JS_CODE=安全密钥
```

只申请 Web 端（JS API）Key，不需要 Android/iOS Key。新 Key 需要配合安全密钥；修改环境变量后重启 Vite。

## 生产配置

高德官方建议不要在生产前端明文放置安全密钥。部署时配置服务端反向代理，并把代理地址写入：

```text
VITE_AMAP_KEY=Web端JS API Key
VITE_AMAP_SERVICE_HOST=https://你的域名/_AMapService
```

反向代理要按高德官方规则在服务端附加安全密钥，并限制 Key 的可用域名。当前折线只表示用户记录或手动编辑的节点顺序；“导航到入口”已通过高德 URI API 跳转实现，节点间道路规划、轨迹纠偏和可通行性判断仍需后续单独接入对应服务。
