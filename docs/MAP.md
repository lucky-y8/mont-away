# 山遥 Web 地图接入

当前选择高德地图 JavaScript API 2.0。前端使用高德官方 Loader；配置 Key 后，地图发现和路线详情会显示真实底图、起终点/节点标记。游记编辑页支持点击地图选点、拖动节点、逆地理编码和浏览器当前位置；步行或骑行路线会按所有社区节点依次进行道路规划。没有 Key 或规划失败时继续显示明确标注的顺序折线，不能把回退折线宣称为真实可通行道路。

## 本地配置

复制根目录 `.env.example` 为 `.env`，填写：

```text
VITE_SHANYAO_AMAP_KEY=Web端JS API Key
VITE_SHANYAO_AMAP_SECURITY_JS_CODE=安全密钥
```

只申请 Web 端（JS API）Key，不需要 Android/iOS Key。新 Key 需要配合安全密钥；修改环境变量后重启 Vite。

## 生产配置

高德官方建议不要在生产前端明文放置安全密钥。部署时配置服务端反向代理，并把代理地址写入：

```text
VITE_SHANYAO_AMAP_KEY=Web端JS API Key
VITE_SHANYAO_AMAP_SERVICE_HOST=https://你的域名/_AMapService
```

反向代理要按高德官方规则在服务端附加安全密钥，并限制 Key 的可用域名。“导航到入口”已通过高德 URI API 跳转实现；浏览器端已使用 Walking/Riding 插件预览节点间道路方案。当前尚未把规划结果、距离和耗时持久化到后端，也没有实现轨迹纠偏或全程可通行性审核。

## 后续能力对应的高德服务

- 当前真实底图、标记、点击选点、拖动节点、当前位置、逆地理编码及步行/骑行预览只需要 Web 端（JS API）Key 与安全密钥。
- POI 关键词输入提示和搜索尚未实现；需要时可继续使用 Web JS 插件，或由 FastAPI 统一代理。
- 若需要把道路方案、距离与耗时持久化，或集中控制配额与缓存，再给 FastAPI 配置单独的 Web 服务 API Key；该 Key 不暴露给浏览器。
- 当前不需要 Android/iOS SDK、静态地图、货车路线或猎鹰轨迹服务；恢复原生 App 或确认全程 GPS 纠偏后再评估。

## 海外地图方案（待确认）

若产品面向真正的海外用户，建议中国大陆地点使用高德，其他国家和地区使用 Google Maps Platform；Google 侧最小组合为 Maps JavaScript API、Places API（New）、Routes API 与 Geocoding API。若主要用户仍在中国大陆、只是浏览海外旅行地点，也可先向高德咨询世界地图高级权限，以降低双供应商复杂度。

实现双供应商前需要为地点和路线坐标补充 `map_provider`、`provider_place_id` 与 `coordinate_system`，明确区分高德坐标和 WGS84，不能直接混用两套坐标。地图加载、地点搜索和路线规划通过统一适配层选择供应商，帖子与景点接口不直接绑定高德或 Google 的响应格式。
