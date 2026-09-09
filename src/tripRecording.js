const EARTH_RADIUS_METERS = 6_371_000
const MIN_SAMPLE_DISTANCE_METERS = 2
const MIN_SAMPLE_INTERVAL_MS = 5_000
const MAX_TRACK_POINTS = 5_000

function radians(value) {
  return value * Math.PI / 180
}

export function distanceBetween(first, second) {
  // Haversine keeps distance calculation independent from the map SDK. / 使用 Haversine 计算，避免距离逻辑依赖地图 SDK。
  const latitudeDelta = radians(second.latitude - first.latitude)
  const longitudeDelta = radians(second.longitude - first.longitude)
  const startLatitude = radians(first.latitude)
  const endLatitude = radians(second.latitude)
  const haversine = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine))
}

export function appendTrackPoint(points, point) {
  if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || points.length >= MAX_TRACK_POINTS) return points
  const previous = points.at(-1)
  if (previous) {
    // Drop near-duplicate samples to control payload size and GPS jitter. / 丢弃过近的重复采样，控制请求大小和 GPS 漂移。
    const interval = new Date(point.recorded_at).getTime() - new Date(previous.recorded_at).getTime()
    if (interval < MIN_SAMPLE_INTERVAL_MS && distanceBetween(previous, point) < MIN_SAMPLE_DISTANCE_METERS) return points
  }
  return [...points, point]
}

export function trackDistance(points) {
  return points.slice(1).reduce((total, point, index) => total + distanceBetween(points[index], point), 0)
}

export function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':')
}
