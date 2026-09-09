import { useEffect, useRef, useState } from 'react'
import AMapLoader from '@amap/amap-jsapi-loader'

const amapKey = import.meta.env.VITE_SHANYAO_AMAP_KEY || ''
const securityCode = import.meta.env.VITE_SHANYAO_AMAP_SECURITY_JS_CODE || ''
const serviceHost = import.meta.env.VITE_SHANYAO_AMAP_SERVICE_HOST || ''

export const amapConfigured = Boolean(amapKey)

function plannerFor(AMap, routeMode) {
  if (routeMode === 'walking') return AMap.Walking
  if (routeMode === 'cycling') return AMap.Riding
  return null
}

function planSegment(Planner, start, end) {
  return new Promise((resolve, reject) => {
    const planner = new Planner()
    planner.search(start, end, (status, result) => {
      const route = result?.routes?.[0]
      if (status !== 'complete' || !route) return reject(new Error(result?.info || 'route_unavailable'))
      const path = route.steps?.flatMap(step => step.path || []) || []
      if (path.length < 2) return reject(new Error('route_path_empty'))
      resolve(path)
    })
  })
}

async function planRoadPath(AMap, points, routeMode) {
  const Planner = plannerFor(AMap, routeMode)
  if (!Planner) return null
  const segments = []
  // Each community node remains a required waypoint. / 每个社区节点都作为必须经过的分段点。
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = [points[index].longitude, points[index].latitude]
    const end = [points[index + 1].longitude, points[index + 1].latitude]
    segments.push(await planSegment(Planner, start, end))
  }
  return segments.flatMap((segment, index) => index ? segment.slice(1) : segment)
}

function createRouteMarkerContent(label) {
  // Match the approved prototype's outlined marker without injecting HTML. / 安全复刻已确认原型中的描边圆形节点，不拼接 HTML 字符串。
  const pin = document.createElement('span')
  pin.className = 'route-node-pin'
  const text = document.createElement('span')
  text.textContent = label
  pin.append(text)
  return pin
}

export default function AmapRouteMap({ points, loadingText, pickHint = '', routeMode = null, routeReadyText = '', routeFallbackText = '', locateText = '', locatingText = '', locationErrorText = '', markerStart = 'S', markerEnd = 'E', showPointMarkers = true, onPick, onPointMove, onError }) {
  const containerRef = useRef(null)
  const locateRef = useRef(null)
  const [statusText, setStatusText] = useState(loadingText)
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    let map
    let disposed = false
    setStatusText(loadingText)
    // Production should use serviceHost; the plaintext security code is only a local-development fallback. / 生产环境应使用服务代理，本地开发才使用明文安全密钥。
    window._AMapSecurityConfig = serviceHost ? { serviceHost } : { securityJsCode: securityCode }
    const editable = Boolean(onPick || onPointMove)
    const plugins = ['AMap.Scale', ...(editable ? ['AMap.Geocoder'] : []), ...(locateText ? ['AMap.Geolocation'] : []), ...(routeMode === 'walking' ? ['AMap.Walking'] : routeMode === 'cycling' ? ['AMap.Riding'] : [])]
    AMapLoader.load({ key: amapKey, version: '2.0', plugins })
      .then(async AMap => {
        if (disposed || !containerRef.current) return
        const path = points.map(point => [point.longitude, point.latitude])
        map = new AMap.Map(containerRef.current, { zoom: 15, center: path[0], resizeEnable: true })
        map.addControl(new AMap.Scale())
        const geocoder = editable ? new AMap.Geocoder({ extensions: 'all' }) : null
        const resolvePoint = (lnglat, callback) => {
          const longitude = lnglat.getLng()
          const latitude = lnglat.getLat()
          if (!geocoder) return callback({ longitude, latitude, name: '', city: '' })
          geocoder.getAddress([longitude, latitude], (status, result) => {
            if (disposed) return
            const regeocode = status === 'complete' && result?.info === 'OK' ? result.regeocode : null
            const address = regeocode?.addressComponent || {}
            callback({
              longitude,
              latitude,
              name: regeocode?.pois?.[0]?.name || regeocode?.formattedAddress || '',
              city: Array.isArray(address.city) ? address.province || '' : address.city || address.province || '',
            })
          })
        }
        const markers = showPointMarkers ? points.map((point, index) => {
          const label = index === 0 ? markerStart : index === points.length - 1 ? markerEnd : String(index)
          const marker = new AMap.Marker({ position: path[index], title: point.name, draggable: Boolean(onPointMove), anchor: 'center', content: createRouteMarkerContent(label) })
          if (onPointMove) marker.on('dragend', event => resolvePoint(event.lnglat, resolved => onPointMove(index, resolved)))
          return marker
        }) : []
        if (markers.length) map.add(markers)
        if (onPick) {
          map.setDefaultCursor('crosshair')
          map.on('click', event => resolvePoint(event.lnglat, onPick))
        }
        if (locateText && onPick) {
          const geolocation = new AMap.Geolocation({ enableHighAccuracy: true, timeout: 10_000, convert: true, showMarker: true, panToLocation: true })
          locateRef.current = () => {
            setLocating(true)
            setStatusText(locatingText)
            geolocation.getCurrentPosition((status, result) => {
              if (disposed) return
              setLocating(false)
              if (status !== 'complete' || !result?.position) {
                setStatusText(locationErrorText)
                return
              }
              map.setZoomAndCenter(16, result.position)
              resolvePoint(result.position, resolved => {
                onPick(resolved)
                setStatusText(pickHint)
              })
            })
          }
        }
        if (path.length > 1) {
          let displayPath = path
          if (routeMode) {
            try {
              displayPath = await planRoadPath(AMap, points, routeMode)
              if (!disposed) setStatusText(routeReadyText)
            } catch (error) {
              console.warn('AMap route planning fell back to the community sequence', error)
              if (!disposed) setStatusText(routeFallbackText)
            }
          } else {
            setStatusText(pickHint)
          }
          if (disposed) return
          const routeLine = new AMap.Polyline({ path: displayPath, strokeColor: '#315e43', strokeWeight: 6, strokeOpacity: 0.9, lineJoin: 'round' })
          map.add(routeLine)
          map.setFitView([...markers, routeLine], false, [70, 70, 70, 70])
        } else {
          setStatusText(pickHint)
        }
      })
      .catch(error => {
        console.error('AMap load failed', error)
        onError()
      })
    return () => {
      disposed = true
      locateRef.current = null
      map?.destroy()
    }
  }, [loadingText, locateText, locatingText, locationErrorText, markerEnd, markerStart, onError, onPick, onPointMove, pickHint, points, routeFallbackText, routeMode, routeReadyText, showPointMarkers])

  return <div className="map-view amap-view"><div ref={containerRef} className="amap-container"/>{locateText && <button className="map-locate-button" type="button" disabled={locating || !locateRef.current} onClick={() => locateRef.current?.()}>{locating ? locatingText : locateText}</button>}{statusText && <small>{statusText}</small>}</div>
}
