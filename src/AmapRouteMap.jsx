import { useEffect, useRef } from 'react'
import AMapLoader from '@amap/amap-jsapi-loader'

const amapKey = import.meta.env.VITE_AMAP_KEY || ''
const securityCode = import.meta.env.VITE_AMAP_SECURITY_JS_CODE || ''
const serviceHost = import.meta.env.VITE_AMAP_SERVICE_HOST || ''

export const amapConfigured = Boolean(amapKey)

export default function AmapRouteMap({ points, loadingText, onError }) {
  const containerRef = useRef(null)

  useEffect(() => {
    let map
    let disposed = false
    // Production should use serviceHost; the plaintext security code is only a local-development fallback. / 生产环境应使用服务代理，本地开发才使用明文安全密钥。
    window._AMapSecurityConfig = serviceHost ? { serviceHost } : { securityJsCode: securityCode }
    AMapLoader.load({ key: amapKey, version: '2.0', plugins: ['AMap.Scale'] })
      .then(AMap => {
        if (disposed || !containerRef.current) return
        const path = points.map(point => [point.longitude, point.latitude])
        map = new AMap.Map(containerRef.current, { zoom: 15, center: path[0], resizeEnable: true })
        map.addControl(new AMap.Scale())
        const markers = points.map((point, index) => new AMap.Marker({ position: path[index], title: point.name, label: { content: `${index === 0 ? 'S' : index === points.length - 1 ? 'E' : index}`, direction: 'top' } }))
        map.add(markers)
        if (path.length > 1) {
          map.add(new AMap.Polyline({ path, strokeColor: '#315e43', strokeWeight: 6, strokeOpacity: 0.9, lineJoin: 'round' }))
          map.setFitView(markers, false, [70, 70, 70, 70])
        }
      })
      .catch(error => {
        console.error('AMap load failed', error)
        onError()
      })
    return () => {
      disposed = true
      map?.destroy()
    }
  }, [points, onError])

  return <div className="map-view amap-view"><div ref={containerRef} className="amap-container"/><small>{loadingText}</small></div>
}
