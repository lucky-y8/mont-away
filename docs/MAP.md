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

## 后续能力对应的高德服务

- 当前真实底图、标记和用户节点折线只需要 Web 端（JS API）Key 与安全密钥。
- 地图选点建议增加输入提示、POI 搜索、地理编码与逆地理编码。
- 节点间真实道路方案建议由 FastAPI 使用单独的 Web 服务 API Key 调用步行、骑行或驾车路径规划，避免把服务端 Key 暴露给浏览器。
- 当前不需要 Android/iOS SDK、静态地图、货车路线或猎鹰轨迹服务；恢复原生 App 或确认全程 GPS 纠偏后再评估。

## 海外地图方案（待确认）

若产品面向真正的海外用户，建议中国大陆地点使用高德，其他国家和地区使用 Google Maps Platform；Google 侧最小组合为 Maps JavaScript API、Places API（New）、Routes API 与 Geocoding API。若主要用户仍在中国大陆、只是浏览海外旅行地点，也可先向高德咨询世界地图高级权限，以降低双供应商复杂度。

实现双供应商前需要为地点和路线坐标补充 `map_provider`、`provider_place_id` 与 `coordinate_system`，明确区分高德坐标和 WGS84，不能直接混用两套坐标。地图加载、地点搜索和路线规划通过统一适配层选择供应商，帖子与景点接口不直接绑定高德或 Google 的响应格式。
