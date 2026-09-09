import { useEffect } from 'react'

const SITE_URL = (import.meta.env.VITE_SHANYAO_SITE_URL || 'https://sy.chexi.tech').replace(/\/$/, '')
const DEFAULT_IMAGE = `${SITE_URL}/og-cover.png`

const localePrefixes = { 'zh-CN': '', en: '/en', ja: '/ja' }
const ogLocales = { 'zh-CN': 'zh_CN', en: 'en_US', ja: 'ja_JP' }

const seoCopy = {
  'zh-CN': {
    siteName: '山遥',
    home: {
      title: '山遥｜发现小众旅行地点、路线与真实地图游记',
      description: '山遥是小众旅行地点与路线分享社区。发现真实用户发布的景点、徒步与骑行路线、地图节点、图片和视频，收藏下一次出发。',
      keywords: '山遥,小众旅行,旅行攻略,小众景点,徒步路线,骑行路线,地图游记,周边游',
    },
    map: {
      title: '地图发现｜附近小众景点与旅行路线｜山遥',
      description: '在山遥地图中发现附近的小众景点、徒步路线、骑行路线与真实旅行记录，按地点查看游记和沿途节点。',
      keywords: '旅行地图,附近景点,小众景点,徒步路线,骑行路线,山遥',
    },
    ranking: {
      title: '热门旅行地点与游记榜单｜山遥',
      description: '查看山遥社区近期最受欢迎的小众旅行地点、路线和地图游记，找到值得收藏的下一站。',
      keywords: '热门景点,旅行榜单,热门游记,小众旅行,山遥',
    },
    postSuffix: '旅行游记与路线',
    placeSuffix: '旅行攻略与游玩路线',
    routeSuffix: '游玩路线',
  },
  en: {
    siteName: 'Mont Away',
    home: {
      title: 'Mont Away | Discover Quiet Places, Travel Routes and Map Stories',
      description: 'Mont Away is a travel community for discovering lesser-known places, walking and cycling routes, map-based stories, photos and videos shared by real travelers.',
      keywords: 'Mont Away,hidden travel places,travel routes,walking routes,cycling routes,map stories,local travel',
    },
    map: {
      title: 'Explore Travel Places and Routes on the Map | Mont Away',
      description: 'Discover nearby places, walking and cycling routes, and authentic travel stories on the Mont Away map.',
      keywords: 'travel map,hidden places,walking routes,cycling routes,Mont Away',
    },
    ranking: {
      title: 'Popular Travel Places and Map Stories | Mont Away',
      description: 'Explore the travel places, routes and map stories most loved by the Mont Away community.',
      keywords: 'popular travel places,travel stories,travel routes,Mont Away',
    },
    postSuffix: 'Travel Story and Route',
    placeSuffix: 'Travel Guide and Routes',
    routeSuffix: 'Travel Route',
  },
  ja: {
    siteName: '山遥',
    home: {
      title: '山遥｜静かな旅先・ルート・地図旅行記を見つけよう',
      description: '山遥は、知られざる旅先、徒歩・自転車ルート、地図旅行記、写真や動画を共有する旅行コミュニティです。',
      keywords: '山遥,穴場旅行,旅行ルート,散歩ルート,サイクリング,地図旅行記',
    },
    map: {
      title: '地図で旅先とルートを探す｜山遥',
      description: '山遥の地図から、近くの静かな旅先、徒歩・自転車ルート、旅行記を見つけられます。',
      keywords: '旅行地図,穴場スポット,散歩ルート,山遥',
    },
    ranking: {
      title: '人気の旅先と旅行記｜山遥',
      description: '山遥コミュニティで人気の旅先、ルート、地図旅行記を紹介します。',
      keywords: '人気旅行,旅行記,旅先ランキング,山遥',
    },
    postSuffix: '旅行記とルート',
    placeSuffix: '旅行ガイドとルート',
    routeSuffix: '旅行ルート',
  },
}

const publicPages = new Set(['home', 'map', 'ranking', 'post', 'route', 'place'])

export function stripLocalePrefix(pathname) {
  const stripped = pathname.replace(/^\/(?:en|ja)(?=\/|$)/, '')
  return stripped || '/'
}

export function localeFromPath(pathname) {
  if (/^\/en(?:\/|$)/.test(pathname)) return 'en'
  if (/^\/ja(?:\/|$)/.test(pathname)) return 'ja'
  return 'zh-CN'
}

export function localizePath(pathname, locale) {
  const cleanPath = stripLocalePrefix(pathname)
  const prefix = localePrefixes[locale] ?? ''
  return cleanPath === '/' ? `${prefix}/` || '/' : `${prefix}${cleanPath}`
}

function absoluteUrl(value) {
  if (!value) return DEFAULT_IMAGE
  try { return new URL(value, SITE_URL).href } catch { return DEFAULT_IMAGE }
}

function compact(value, maximum = 160) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (text.length <= maximum) return text
  return `${text.slice(0, maximum - 1).trimEnd()}…`
}

function setMeta(attribute, key, content) {
  const selector = `meta[${attribute}="${key}"]`
  let element = document.head.querySelector(selector)
  if (!content) {
    element?.remove()
    return
  }
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }
  element.setAttribute('content', content)
}

function setLink(rel, href, hreflang = '') {
  const selector = hreflang ? `link[rel="${rel}"][hreflang="${hreflang}"]` : `link[rel="${rel}"]:not([hreflang])`
  let element = document.head.querySelector(selector)
  if (!element) {
    element = document.createElement('link')
    element.rel = rel
    if (hreflang) element.hreflang = hreflang
    document.head.appendChild(element)
  }
  element.href = href
}

function setStructuredData(data) {
  let element = document.getElementById('shanyao-structured-data')
  if (!element) {
    element = document.createElement('script')
    element.id = 'shanyao-structured-data'
    element.type = 'application/ld+json'
    document.head.appendChild(element)
  }
  element.textContent = JSON.stringify(data).replace(/<\//g, '<\\/')
}

function pagePath(page, post, place) {
  if ((page === 'post' || page === 'route') && post?.id) return `/posts/${encodeURIComponent(post.id)}`
  if (page === 'place' && place?.place?.id) return `/places/${encodeURIComponent(place.place.id)}`
  if (page === 'map') return '/map'
  if (page === 'ranking') return '/ranking'
  return '/'
}

function metadataFor({ page, locale, post, place, hasError }) {
  const copy = seoCopy[locale] || seoCopy['zh-CN']
  const path = pagePath(page, post, place)
  const base = copy[page] || copy.home
  let title = base.title
  let description = base.description
  let keywords = base.keywords
  let image = DEFAULT_IMAGE
  let type = 'website'
  let author = ''
  let structuredData
  let indexable = publicPages.has(page) && !hasError

  if ((page === 'post' || page === 'route') && post) {
    const placeName = post.place?.name || ''
    const suffix = page === 'route' ? copy.routeSuffix : copy.postSuffix
    title = compact(`${post.title}｜${placeName} ${suffix}｜${copy.siteName}`, 70)
    description = compact(`${post.body} ${placeName ? `— ${placeName}` : ''}`, 160)
    keywords = compact(`${placeName},${post.place?.city || ''},${suffix},${copy.siteName}`, 160)
    image = absoluteUrl(post.media?.find(item => item.media_type === 'image')?.url)
    type = 'article'
    author = post.author_name || ''
    indexable = indexable && post.visibility_status === 'public' && post.moderation_status === 'approved'
    structuredData = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description,
      image: [image],
      datePublished: post.created_at,
      author: { '@type': 'Person', name: author },
      publisher: { '@type': 'Organization', name: copy.siteName, url: SITE_URL },
      mainEntityOfPage: `${SITE_URL}${localizePath(path, locale)}`,
      inLanguage: locale,
      contentLocation: post.place ? {
        '@type': 'Place',
        name: post.place.name,
        address: post.place.city,
        geo: { '@type': 'GeoCoordinates', latitude: post.place.latitude, longitude: post.place.longitude },
      } : undefined,
    }
  } else if (page === 'place' && place?.place) {
    const item = place.place
    title = compact(`${item.name}｜${item.city} ${copy.placeSuffix}｜${copy.siteName}`, 70)
    description = compact(`${item.name}位于${item.city || ''}。在${copy.siteName}查看这里的真实旅行记录、图片、路线节点与游玩灵感。`, 160)
    if (locale === 'en') description = compact(`Explore authentic travel stories, photos, route stops and trip ideas for ${item.name}${item.city ? ` in ${item.city}` : ''} on Mont Away.`, 160)
    if (locale === 'ja') description = compact(`${item.name}${item.city ? `（${item.city}）` : ''}の旅行記、写真、ルート地点、旅のアイデアを山遥で見つけましょう。`, 160)
    keywords = compact(`${item.name},${item.city || ''},${copy.placeSuffix},${copy.siteName}`, 160)
    image = absoluteUrl(place.posts?.flatMap(item => item.media || []).find(item => item.media_type === 'image')?.url)
    structuredData = {
      '@context': 'https://schema.org',
      '@type': 'TouristAttraction',
      name: item.name,
      description,
      url: `${SITE_URL}${localizePath(path, locale)}`,
      image,
      address: item.city,
      geo: { '@type': 'GeoCoordinates', latitude: item.latitude, longitude: item.longitude },
    }
  } else if (page === 'home') {
    structuredData = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: copy.siteName, description, inLanguage: locale },
        { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, url: `${SITE_URL}/`, name: copy.siteName, logo: `${SITE_URL}/icon.svg` },
      ],
    }
  } else if (page === 'map' || page === 'ranking') {
    structuredData = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description, url: `${SITE_URL}${localizePath(path, locale)}`, inLanguage: locale }
  }

  if ((page === 'post' || page === 'route') && !post) indexable = false
  if (page === 'place' && !place) indexable = false
  return { title, description, keywords, image, type, author, path, indexable, structuredData, siteName: copy.siteName }
}

export function useSeo({ page, locale, post, place, hasError = false }) {
  useEffect(() => {
    const seo = metadataFor({ page, locale, post, place, hasError })
    const canonical = `${SITE_URL}${localizePath(seo.path, locale)}`
    const alternateLocale = locale === 'en' ? 'zh_CN' : 'en_US'

    document.title = seo.title
    document.documentElement.lang = locale
    setMeta('name', 'description', seo.description)
    setMeta('name', 'keywords', seo.keywords)
    setMeta('name', 'robots', seo.indexable ? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' : 'noindex,nofollow')
    setMeta('name', 'author', seo.author)
    setMeta('property', 'og:title', seo.title)
    setMeta('property', 'og:description', seo.description)
    setMeta('property', 'og:type', seo.type)
    setMeta('property', 'og:url', canonical)
    setMeta('property', 'og:site_name', seo.siteName)
    setMeta('property', 'og:locale', ogLocales[locale] || ogLocales['zh-CN'])
    setMeta('property', 'og:locale:alternate', alternateLocale)
    setMeta('property', 'og:image', seo.image)
    setMeta('property', 'og:image:width', seo.image === DEFAULT_IMAGE ? '1731' : '')
    setMeta('property', 'og:image:height', seo.image === DEFAULT_IMAGE ? '909' : '')
    setMeta('property', 'og:image:alt', seo.title)
    setMeta('name', 'twitter:card', 'summary_large_image')
    setMeta('name', 'twitter:title', seo.title)
    setMeta('name', 'twitter:description', seo.description)
    setMeta('name', 'twitter:image', seo.image)

    setLink('canonical', canonical)
    setLink('alternate', `${SITE_URL}${localizePath(seo.path, 'zh-CN')}`, 'zh-CN')
    setLink('alternate', `${SITE_URL}${localizePath(seo.path, 'en')}`, 'en')
    setLink('alternate', `${SITE_URL}${localizePath(seo.path, 'ja')}`, 'ja')
    setLink('alternate', `${SITE_URL}${localizePath(seo.path, 'zh-CN')}`, 'x-default')
    setStructuredData(seo.structuredData || { '@context': 'https://schema.org', '@type': 'WebPage', name: seo.title, description: seo.description, url: canonical })
  }, [hasError, locale, page, place, post])
}
