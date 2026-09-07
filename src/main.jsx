import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { House, Map, PlusSquare, Bell, UserRound, Search, Trophy, Heart, MessageCircle, Bookmark, Send, MapPin, Route, MoreHorizontal, Camera, Video, Navigation, ChevronRight, Languages, Mail, Lock, LogOut, Gift, PackageCheck } from 'lucide-react'
import { detectLocale, localeOptions, messages } from './i18n'
import { addComment, adminCancelRedemption, approvePost, banUser, beginWeChatLogin, cancelRedemption, createGift, createPost, exchangeWeChatCode, getAdminGifts, getAdminRedemptions, getAdminUsers, getCurrentUser, getModerationQueue, getMyPosts, getNotifications, getPointAccount, getPost, getRedemptions, getReportQueue, hasStoredSession, listComments, listGifts, listPosts, loginEmail, logout, redeemGift, registerEmail, removePost, reportPost, requestPasswordReset, resetPassword, resolveReport, restoreCurrentUser, setPostBookmark, setPostLike, setUserFollow, shipRedemption, unbanUser, updateGift, updatePost, uploadMedia, verifyEmail } from './api'
import AmapRouteMap, { amapConfigured } from './AmapRouteMap'
import './styles.css'

const navIds = ['home', 'map', 'publish', 'messages', 'profile']
const navIcons = [House, Map, PlusSquare, Bell, UserRound]
// Confirmed gift tiers shared by the admin selector. / 管理后台共用已确认的礼品积分档位。
const giftPointTiers = [20, 40, 60, 80, 100]
const Logo = () => <div className="logo">山遥</div>

function Scenic({ small = false, t, media }) {
  if (media?.media_type === 'image') return <div className={'scenic ' + (small ? 'small' : '')}><img src={media.url} alt=""/></div>
  if (media?.media_type === 'video') return <div className={'scenic ' + (small ? 'small' : '')}><video src={media.url} controls preload="metadata"/></div>
  return <div className={'scenic ' + (small ? 'small' : '')}><div className="mountain m1"/><div className="mountain m2"/><div className="water"/><span>{t.sampleMedia}</span></div>
}

function LanguageSwitch({ locale, setLocale, t }) {
  return <label className="language"><Languages/><span>{t.language}</span><select aria-label={t.language} value={locale} onChange={event => setLocale(event.target.value)}>{localeOptions.map(option => <option value={option.code} key={option.code}>{option.label}</option>)}</select></label>
}

function MapView({ t, route }) {
  const [amapFailed, setAmapFailed] = useState(false)
  const fallbackCoordinates = [[120.1439, 30.2465], [120.1451, 30.2471], [120.147, 30.2459], [120.1482, 30.2448]]
  const points = (route ? [route.start, ...route.nodes, route.end] : t.nodes.map(name => ({ name }))).slice(0, 20).map((point, index) => ({ ...point, longitude: point.longitude ?? fallbackCoordinates[index % fallbackCoordinates.length][0], latitude: point.latitude ?? fallbackCoordinates[index % fallbackCoordinates.length][1] }))
  if (amapConfigured && !amapFailed) return <AmapRouteMap points={points} loadingText={t.mapLoading} onError={() => setAmapFailed(true)}/>
  const fallbackPoints = points.slice(0, 4)
  return <div className="map-view"><div className="lake"/><div className="track"/>{fallbackPoints.map((point, index) => <button title={point.name} className={'pin p' + index} key={`${point.name}-${index}`}>{index === 0 ? t.start : index === fallbackPoints.length - 1 ? t.end : index}</button>)}<small>{t.mapSample}</small></div>
}

function PostCard({ initialPost, openRoute, t, locale, user, onRequireAuth }) {
  const [post, setPost] = useState(initialPost)
  const [saved, setSaved] = useState(Boolean(initialPost.bookmarked_by_me))
  const [following, setFollowing] = useState(Boolean(initialPost.following_author))
  const [notice, setNotice] = useState('')
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [comments, setComments] = useState(null)
  const toggleLike = async () => {
    if (!post.id) return setPost(current => ({ ...current, liked_by_me: !current.liked_by_me, like_count: current.like_count + (current.liked_by_me ? -1 : 1) }))
    if (!user) {
      setNotice(t.loginToLike)
      return onRequireAuth()
    }
    try {
      setNotice('')
      setPost(await setPostLike(post.id, !post.liked_by_me, locale))
    } catch (error) {
      setNotice(error.message)
    }
  }
  const toggleSave = async () => {
    if (!post.id) return setSaved(value => !value)
    if (!user) return onRequireAuth()
    try {
      await setPostBookmark(post.id, !saved, locale)
      setSaved(value => !value)
    } catch (error) {
      setNotice(error.message)
    }
  }
  const toggleComments = async () => {
    const opening = !commentsOpen
    setCommentsOpen(opening)
    if (opening && comments === null) {
      if (!post.id) return setComments([])
      try { setComments(await listComments(post.id, locale)) } catch (error) { setNotice(error.message) }
    }
  }
  const submitComment = async event => {
    event.preventDefault()
    if (!user) return onRequireAuth()
    if (!post.id) return
    const form = event.currentTarget
    const body = new FormData(form).get('comment')?.trim()
    if (!body) return
    try {
      const created = await addComment(post.id, body, locale)
      setComments(current => [...(current || []), created])
      setPost(current => ({ ...current, comment_count: (current.comment_count || 0) + 1 }))
      form.reset()
    } catch (error) {
      setNotice(error.message)
    }
  }
  const report = async () => {
    if (!post.id) return
    if (!user) return onRequireAuth()
    const reason = window.prompt(t.reportReason)
    if (!reason?.trim()) return
    try { await reportPost(post.id, reason.trim(), locale); setNotice(t.reportDone) } catch (error) { setNotice(error.message) }
  }
  const toggleFollow = async () => {
    if (!user) return onRequireAuth()
    if (!post.author_id || post.author_id === user.id) return
    try {
      const state = await setUserFollow(post.author_id, !following, locale)
      setFollowing(state.following)
    } catch (error) {
      setNotice(error.message)
    }
  }
  const sharePost = async () => {
    if (!post.id) return
    const url = `${window.location.origin}/posts/${post.id}`
    try {
      if (navigator.share) {
        await navigator.share({ title: post.title, text: post.body.slice(0, 140), url })
        setNotice(t.shared)
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        setNotice(t.linkCopied)
      } else {
        window.prompt(t.copyLink, url)
      }
    } catch (error) {
      // Cancelling the native share sheet is not an application error. / 用户取消系统分享面板不视为应用错误。
      if (error.name !== 'AbortError') setNotice(error.message)
    }
  }
  const distance = post.route.distance_meters ? `${(post.route.distance_meters / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} km` : '—'
  return <article className="post"><header><div className="avatar">{post.author_name.slice(0, 1).toUpperCase()}</div><div className="identity"><b>{post.author_name}</b><button className="place"><MapPin/>{post.place.name}</button></div>{post.author_id && post.author_id !== user?.id && <button className={'follow-button ' + (following ? 'following' : '')} onClick={toggleFollow}>{following ? t.unfollow : t.follow}</button>}<button className="icon-btn" aria-label="More" onClick={report}><MoreHorizontal/></button></header><Scenic t={t} media={post.media?.[0]}/><div className="post-actions"><button onClick={toggleLike} className={post.liked_by_me ? 'liked' : ''} aria-label="Like"><Heart fill={post.liked_by_me ? 'currentColor' : 'none'}/></button><button aria-label="Comment" onClick={toggleComments}><MessageCircle/></button><button aria-label="Share" onClick={sharePost}><Send/></button><button className="save" onClick={toggleSave} aria-label="Save"><Bookmark fill={saved ? 'currentColor' : 'none'}/></button></div><div className="copy"><b>{post.like_count} {t.likes}</b><p><b>{post.author_name}</b> {post.body}</p>{notice && <small className="inline-notice">{notice}</small>}<button className="comments" onClick={toggleComments}>{post.comment_count ?? 0} {t.commentUnit}</button>{commentsOpen && <div className="comment-panel">{comments === null ? <small>{t.loadingFeed}</small> : comments.length ? comments.map(comment => <p key={comment.id}><b>{comment.author_name}</b> {comment.body}</p>) : <small>{t.noComments}</small>}<form onSubmit={submitComment}><input name="comment" maxLength="2000" placeholder={t.commentHint}/><button>{t.commentSend}</button></form></div>}<button className="route-card" onClick={() => openRoute(post)}><Route/><span><b>{t.viewRoute}</b><small>{distance} · {post.route.nodes.length + 2} {t.editorNodes}</small></span><ChevronRight/></button></div></article>
}

function Home({ openRoute, t, locale, user, onRequireAuth, refreshKey }) {
  const [posts, setPosts] = useState(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState(0)
  const [nearbyLocation, setNearbyLocation] = useState(null)
  const [nearbyStatus, setNearbyStatus] = useState('')
  const load = () => {
    setPosts(null)
    setError('')
    if (activeTab === 1 && !nearbyLocation) {
      if (nearbyStatus && nearbyStatus !== t.locating) setPosts([])
      return
    }
    listPosts(locale, '', 'recent', activeTab === 2 ? 'following' : 'all', activeTab === 1 ? nearbyLocation : null).then(setPosts).catch(error => { setError(error.message); setPosts([]) })
  }
  useEffect(load, [locale, refreshKey, activeTab, user?.id, nearbyLocation, nearbyStatus])
  const selectTab = index => {
    if (index === 2 && !user) return onRequireAuth()
    setActiveTab(index)
    setNearbyStatus('')
    if (index === 1 && !nearbyLocation) {
      setNearbyStatus(t.locating)
      if (!navigator.geolocation) return setNearbyStatus(t.locationUnavailable)
      navigator.geolocation.getCurrentPosition(
        position => { setNearbyLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude, radiusKm: 50 }); setNearbyStatus('') },
        () => setNearbyStatus(t.locationDenied),
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
      )
    }
  }
  const emptyText = activeTab === 1 ? nearbyStatus || t.nearbyEmpty : activeTab === 2 ? t.followingEmpty : t.demoPost
  return <div className="feed"><div className="feed-tabs">{t.tabs.map((tab, index) => <button className={index === activeTab ? 'selected' : ''} onClick={() => selectTab(index)} key={tab}>{tab}</button>)}</div>{activeTab === 1 && <small className="location-note">{t.locationUse}</small>}{posts === null ? <p className="feed-status">{nearbyStatus || t.loadingFeed}</p> : <>{error && <p className="feed-status error">{t.feedError}: {error} <button onClick={load}>{t.retry}</button></p>}{!error && posts.length === 0 && <p className="feed-status">{emptyText}</p>}<div className="post-stack">{posts.map(post => <PostCard key={post.id} initialPost={post} openRoute={openRoute} t={t} locale={locale} user={user} onRequireAuth={onRequireAuth}/>)}</div></>}</div>
}

function Discover({ openRoute, t, locale }) {
  const [posts, setPosts] = useState(null)
  const [selected, setSelected] = useState(null)
  const [notice, setNotice] = useState('')
  useEffect(() => { listPosts(locale, '', 'popular').then(items => { setPosts(items); setSelected(items[0] || null) }).catch(error => { setPosts([]); setNotice(error.message) }) }, [locale])
  return <div className="surface split discover-page"><MapView t={t} route={selected?.route}/><aside className="panel"><h1>{t.mapTitle}</h1><p className="muted">{t.mapIntro}</p>{notice && <p className="feed-status error">{notice}</p>}{posts === null ? <p className="feed-status">{t.loadingFeed}</p> : posts.length ? <div className="map-results">{posts.map(post => <button className={selected?.id === post.id ? 'selected' : ''} onClick={() => setSelected(post)} key={post.id}><Scenic small t={t} media={post.media?.[0]}/><span><b>{post.place.name}</b><small>{post.title} · {post.like_count} {t.likes}</small></span></button>)}</div> : <p className="feed-status">{t.mapEmpty}</p>}{selected && <button className="primary" onClick={() => openRoute(selected)}>{t.viewPlace}</button>}</aside></div>
}

function RoutePage({ t, post }) {
  const route = post?.route
  const nodes = route ? [route.start, ...route.nodes, route.end] : t.nodes.map(name => ({ name }))
  const navigate = () => {
    if (!route) return
    const mode = post?.transport_mode === 'cycling' ? 'ride' : 'walk'
    const params = new URLSearchParams({ to: `${route.start.longitude},${route.start.latitude},${route.start.name}`, mode, src: 'shanyao-web', callnative: '1' })
    window.open(`https://uri.amap.com/navigation?${params}`, '_blank', 'noopener,noreferrer')
  }
  return <div className="surface split route-page"><MapView t={t} route={route}/><aside className="panel"><span className="place static"><MapPin/>{post?.place.name || t.names[0]}</span><h1>{post?.title || t.routeTitle}</h1><p className="muted">{route?.distance_meters ? `${(route.distance_meters / 1000).toFixed(1)} km` : t.duration}</p><div className="node-list">{nodes.map((node, index) => <article className="node-detail" key={`${node.name}-${index}`}><div className="node"><i>{index === 0 ? t.start : index === nodes.length - 1 ? t.end : index}</i><span><b>{node.name}</b><small>{node.description || (node.media?.length ? `${node.media.length} ${t.nodeMedia}` : '')}</small></span><ChevronRight/></div>{node.media?.length > 0 && <div className="media-previews">{node.media.map(item => item.media_type === 'image' ? <img src={item.url} alt="" key={item.id}/> : <video src={item.url} controls key={item.id}/>)}</div>}</article>)}</div><button className="primary" disabled={!route} onClick={navigate}><Navigation/>{t.navigate}</button>{route && <small className="muted">{t.navigateHint}</small>}</aside></div>
}

function Publish({ t, locale, user, initialPost, onRequireAuth, onPublished }) {
  const startName = initialPost?.route.start.name || t.startName
  const endName = initialPost?.route.end.name || t.endName
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [media, setMedia] = useState(initialPost?.media || [])
  const [nodes, setNodes] = useState(() => initialPost?.route.nodes.map(node => ({ name: node.name, description: node.description || '', latitude: node.latitude, longitude: node.longitude, media: node.media || [] })) || [])
  const [draftId, setDraftId] = useState(initialPost?.id || null)
  if (!user) return <div className="surface empty"><h1>{t.editor}</h1><p>{t.loginRequired}</p><button className="primary centered" onClick={onRequireAuth}>{t.goLogin}</button></div>
  const submit = async event => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const publishing = event.nativeEvent.submitter?.value !== 'draft'
    const number = name => {
      const value = Number(data.get(name))
      if (!initialPost) return value
      const sampleValues = { startLat: 30.2465, startLng: 120.1439, endLat: 30.2448, endLng: 120.1482 }
      const originalValues = { startLat: initialPost.route.start.latitude, startLng: initialPost.route.start.longitude, endLat: initialPost.route.end.latitude, endLng: initialPost.route.end.longitude }
      return value === sampleValues[name] ? originalValues[name] : value
    }
    const payload = {
      title: data.get('title'), body: data.get('body'), content_language: locale, publish: publishing,
      transport_mode: data.get('transport') || null, route_source: 'manual', media_ids: media.map(item => item.id),
      place: { name: data.get('place'), city: initialPost && ['杭州', 'Hangzhou'].includes(data.get('city')) ? initialPost.place.city : data.get('city'), country_code: initialPost?.place.country_code || 'CN', latitude: number('startLat'), longitude: number('startLng') },
      route: {
        start: { name: data.get('startName'), latitude: number('startLat'), longitude: number('startLng') },
        end: { name: data.get('endName'), latitude: number('endLat'), longitude: number('endLng') },
        nodes: nodes.map(node => ({ name: node.name, description: node.description, latitude: Number(node.latitude), longitude: Number(node.longitude), source: 'edited', media_ids: node.media.map(item => item.id) })),
      },
    }
    setLoading(true)
    setNotice('')
    try {
      const created = draftId ? await updatePost(draftId, payload, locale) : await createPost(payload, locale)
      if (publishing) {
        setNotice(t.publishSuccess)
        onPublished(created)
      } else {
        setDraftId(created.id)
        setNotice(t.draftSaved)
      }
    } catch (error) {
      setNotice(error.message)
    } finally {
      setLoading(false)
    }
  }
  const selectMedia = async event => {
    const files = [...event.target.files].slice(0, 20 - media.length)
    if (!files.length) return
    setUploading(true)
    setNotice('')
    try {
      const uploaded = []
      for (const file of files) uploaded.push(await uploadMedia(file, locale))
      setMedia(current => [...current, ...uploaded])
    } catch (error) {
      setNotice(error.message)
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }
  const addNode = () => setNodes(current => [...current, { name: '', description: '', latitude: 30.2465, longitude: 120.1439, media: [] }])
  const updateNode = (index, field, value) => setNodes(current => current.map((node, nodeIndex) => nodeIndex === index ? { ...node, [field]: value } : node))
  const removeNode = index => setNodes(current => current.filter((_, nodeIndex) => nodeIndex !== index))
  const selectNodeMedia = async (index, event) => {
    const currentMedia = nodes[index].media
    const files = [...event.target.files].slice(0, 10 - currentMedia.length)
    if (!files.length) return
    setUploading(true)
    setNotice('')
    try {
      const uploaded = []
      for (const file of files) uploaded.push(await uploadMedia(file, locale))
      setNodes(current => current.map((node, nodeIndex) => nodeIndex === index ? { ...node, media: [...node.media, ...uploaded] } : node))
    } catch (error) { setNotice(error.message) } finally { setUploading(false); event.target.value = '' }
  }
  const mapRoute = { start: { name: startName, latitude: initialPost?.route.start.latitude ?? 30.2465, longitude: initialPost?.route.start.longitude ?? 120.1439 }, nodes, end: { name: endName, latitude: initialPost?.route.end.latitude ?? 30.2448, longitude: initialPost?.route.end.longitude ?? 120.1482 } }
  return <div className="surface editor">
    <aside className="editor-list"><h2>{t.editorNodes}</h2><div className="node"><i>{t.start}</i><span><b>{startName}</b></span></div>{nodes.map((node, index) => <div className="node" key={`${index}-${node.name}`}><i>{index + 1}</i><span><b>{node.name || t.nodeName}</b></span></div>)}<div className="node"><i>{t.end}</i><span><b>{endName}</b></span></div><button className="secondary" type="button" onClick={addNode}>{t.addNode}</button></aside>
    <MapView t={t} route={mapRoute}/>
    <form className="form" onSubmit={submit}><h1>{t.editor}</h1><label>{t.title}<input name="title" required maxLength="120" defaultValue={initialPost?.title || ''} placeholder={t.sampleTitle}/></label><label>{t.intro}<textarea name="body" required maxLength="20000" defaultValue={initialPost?.body || ''} placeholder={t.introText}/></label><div className="field-grid"><label>{t.placeName}<input name="place" required defaultValue={initialPost?.place.name || ''}/></label><label>{t.city}<input name="city" required defaultValue={initialPost?.place.city || ''}/></label></div><label>{t.transport}<select name="transport" defaultValue={initialPost?.transport_mode || ''}><option value="">{t.none}</option><option value="walking">{t.walk}</option><option value="cycling">{t.ride}</option></select></label><div className="field-grid"><label>{t.startName}<input name="startName" required defaultValue={initialPost?.route.start.name || ''}/></label><label>{t.endName}<input name="endName" required defaultValue={initialPost?.route.end.name || ''}/></label><label>{t.latitude} · {t.start}<input name="startLat" type="number" step="any" min="-90" max="90" required defaultValue={initialPost?.route.start.latitude ?? 30.2465}/></label><label>{t.longitude} · {t.start}<input name="startLng" type="number" step="any" min="-180" max="180" required defaultValue={initialPost?.route.start.longitude ?? 120.1439}/></label><label>{t.latitude} · {t.end}<input name="endLat" type="number" step="any" min="-90" max="90" required defaultValue={initialPost?.route.end.latitude ?? 30.2448}/></label><label>{t.longitude} · {t.end}<input name="endLng" type="number" step="any" min="-180" max="180" required defaultValue={initialPost?.route.end.longitude ?? 120.1482}/></label></div><small className="muted">{t.coordinateHint}</small>
      <section className="route-node-editor"><div className="section-heading"><h2>{t.editorNodes}</h2><button className="secondary" type="button" onClick={addNode}>{t.addNode}</button></div>{nodes.map((node, index) => <article key={index}><div className="section-heading"><b>{index + 1}</b><button className="danger text-button" type="button" onClick={() => removeNode(index)}>{t.removeNode}</button></div><label>{t.nodeName}<input required value={node.name} onChange={event => updateNode(index, 'name', event.target.value)}/></label><label>{t.nodeDescription}<textarea value={node.description} onChange={event => updateNode(index, 'description', event.target.value)}/></label><div className="field-grid"><label>{t.latitude}<input type="number" step="any" min="-90" max="90" required value={node.latitude} onChange={event => updateNode(index, 'latitude', event.target.value)}/></label><label>{t.longitude}<input type="number" step="any" min="-180" max="180" required value={node.longitude} onChange={event => updateNode(index, 'longitude', event.target.value)}/></label></div><label className="upload compact"><Camera/><Video/>{uploading ? t.uploading : t.nodeMedia}<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" multiple onChange={event => selectNodeMedia(index, event)} disabled={uploading}/></label>{node.media.length > 0 && <div className="media-previews">{node.media.map(item => item.media_type === 'image' ? <img src={item.url} alt="" key={item.id}/> : <video src={item.url} key={item.id}/>)}</div>}</article>)}</section>
      <label className="upload"><Camera/><Video/>{uploading ? t.uploading : t.addMedia}<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" multiple onChange={selectMedia} disabled={uploading}/></label>{media.length > 0 && <div className="media-previews"><b>{t.uploadedMedia} · {media.length}</b>{media.map(item => item.media_type === 'image' ? <img src={item.url} alt="" key={item.id}/> : <video src={item.url} key={item.id}/>)}</div>}<div className="form-actions"><button className="secondary" type="submit" name="intent" value="draft" disabled={loading || uploading}>{t.draft}</button><button className="primary" type="submit" name="intent" value="publish" disabled={loading || uploading}>{loading ? t.auth.loading : t.publish}</button></div>{notice && <p className="auth-notice" role="status">{notice}</p>}<small className="muted">{t.publishHint}</small></form>
  </div>
}

function SearchPage({ t, locale, openRoute, user, onRequireAuth }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searched, setSearched] = useState(false)
  const [notice, setNotice] = useState('')
  const submit = async event => {
    event.preventDefault()
    setNotice(t.loadingFeed)
    try {
      setResults(await listPosts(locale, query.trim()))
      setSearched(true)
      setNotice('')
    } catch (error) {
      setNotice(error.message)
    }
  }
  return <div className="feed search-page"><h1>{t.searchTitle}</h1><form className="search-box" onSubmit={submit}><Search/><input value={query} onChange={event => setQuery(event.target.value)} placeholder={t.searchHint}/><button className="primary">{t.searchAction}</button></form>{notice && <p className="feed-status">{notice}</p>}{searched && results.length === 0 && <p className="feed-status">{t.searchEmpty}</p>}<div className="post-stack">{results.map(post => <PostCard key={post.id} initialPost={post} openRoute={openRoute} t={t} locale={locale} user={user} onRequireAuth={onRequireAuth}/>)}</div></div>
}

function RankingPage({ t, locale, openRoute, user, onRequireAuth }) {
  const [posts, setPosts] = useState(null)
  const [notice, setNotice] = useState('')
  useEffect(() => { listPosts(locale, '', 'popular').then(setPosts).catch(error => { setPosts([]); setNotice(error.message) }) }, [locale])
  return <div className="feed search-page"><h1>{t.rankingTitle}</h1><p className="muted">{t.rankingIntro}</p>{posts === null && <p className="feed-status">{t.loadingFeed}</p>}{notice && <p className="feed-status error">{notice}</p>}{posts?.length === 0 && !notice && <p className="feed-status">{t.searchEmpty}</p>}<div className="post-stack">{posts?.map(post => <PostCard key={post.id} initialPost={post} openRoute={openRoute} t={t} locale={locale} user={user} onRequireAuth={onRequireAuth}/>)}</div></div>
}

function ActivityPage({ t, locale, user, onRequireAuth, onOpenGifts }) {
  const [notifications, setNotifications] = useState(null)
  const [points, setPoints] = useState(null)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    if (!user) return
    Promise.all([getNotifications(locale), getPointAccount(locale)]).then(([items, account]) => { setNotifications(items); setPoints(account) }).catch(error => setNotice(error.message))
  }, [locale, user])
  if (!user) return <div className="surface empty"><h1>{t.activityTitle}</h1><p>{t.loginRequired}</p><button className="primary centered" onClick={onRequireAuth}>{t.goLogin}</button></div>
  const entryText = type => t.pointEntryTypes[type] || type
  const date = value => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  return <div className="surface activity-page"><h1>{t.activityTitle}</h1><section className="point-card"><span>{t.pointBalance}</span><b>{points?.balance ?? '—'}</b><small>{t.pointPending}</small><button onClick={onOpenGifts}><Gift/>{t.openGifts}</button></section>{notice && <p className="feed-status error">{notice}</p>}<h2 className="section-title">{t.pointHistory}</h2>{points?.entries?.length ? <div className="point-ledger">{points.entries.map(entry => <article key={entry.id}><span><b>{entryText(entry.entry_type)}</b><small>{date(entry.created_at)}</small></span><strong className={entry.amount > 0 ? 'positive' : ''}>{entry.amount > 0 ? '+' : ''}{entry.amount}</strong></article>)}</div> : <p className="feed-status">{t.noPointHistory}</p>}<h2 className="section-title">{t.notificationTitle}</h2>{notifications === null && !notice ? <p className="feed-status">{t.loadingFeed}</p> : notifications?.length ? <div className="notification-list">{notifications.map(item => <article key={item.id}><Bell/><div><p>{item.message}</p><small>{date(item.created_at)}</small></div></article>)}</div> : <p className="feed-status">{t.noActivity}</p>}</div>
}

function GiftPage({ t, locale, user, onRequireAuth }) {
  const [gifts, setGifts] = useState(null)
  const [points, setPoints] = useState(null)
  const [redemptions, setRedemptions] = useState(null)
  const [selected, setSelected] = useState(null)
  const [notice, setNotice] = useState('')
  const load = () => Promise.all([listGifts(locale), getPointAccount(locale), getRedemptions(locale)]).then(([giftItems, account, redemptionItems]) => { setGifts(giftItems); setPoints(account); setRedemptions(redemptionItems) }).catch(error => { setNotice(error.message); setGifts([]); setRedemptions([]) })
  useEffect(() => { if (user) load() }, [locale, user?.id])
  if (!user) return <div className="surface empty"><h1>{t.giftTitle}</h1><p>{t.loginRequired}</p><button className="primary centered" onClick={onRequireAuth}>{t.goLogin}</button></div>
  const submit = async event => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    try {
      await redeemGift(selected.id, { quantity: Number(data.get('quantity')), recipient_name: data.get('recipientName'), phone: data.get('phone'), shipping_address: data.get('shippingAddress') }, locale)
      setSelected(null)
      setNotice('')
      await load()
    } catch (error) { setNotice(error.message) }
  }
  const cancel = async item => {
    try { setNotice((await cancelRedemption(item.id, locale)).message); await load() } catch (error) { setNotice(error.message) }
  }
  const statusText = status => status === 'shipped' ? t.shipped : status === 'cancelled' ? t.cancelled : t.pendingFulfillment
  return <div className="surface gift-page"><header className="page-heading"><div><span>{t.pointBalance}: <b>{points?.balance ?? '—'}</b></span><h1>{t.giftTitle}</h1><p>{t.giftIntro}</p></div><Gift/></header>{notice && <p className="auth-notice">{notice}</p>}{gifts === null ? <p className="feed-status">{t.loadingFeed}</p> : gifts.length ? <div className="gift-grid">{gifts.map(gift => { const insufficient = points && points.balance < gift.point_cost; return <article key={gift.id}>{gift.image_url ? <img src={gift.image_url} alt=""/> : <div className="gift-placeholder"><Gift/></div>}<div><h2>{gift.name}</h2><p>{gift.description}</p><small>{t.stock}: {gift.stock}</small><b>{gift.point_cost} {t.pointCost}</b><button className="primary" disabled={!gift.stock || insufficient} onClick={() => setSelected(gift)}>{!gift.stock ? t.outOfStock : insufficient ? t.notEnoughPoints : t.redeem}</button></div></article> })}</div> : <p className="feed-status">{t.giftEmpty}</p>}{selected && <form className="redemption-form" onSubmit={submit}><h2>{selected.name} · {selected.point_cost} {t.pointCost}</h2><div className="field-grid"><label>{t.recipientName}<input name="recipientName" autoComplete="name" required maxLength="120"/></label><label>{t.phone}<input name="phone" type="tel" autoComplete="tel" pattern="[0-9+() -]{7,32}" required maxLength="32"/></label><label>{t.quantity}<input name="quantity" type="number" min="1" max={Math.min(selected.stock, 10)} defaultValue="1" required/></label></div><label>{t.shippingAddress}<textarea name="shippingAddress" autoComplete="street-address" required maxLength="2000"/></label><div className="form-actions"><button type="button" className="secondary" onClick={() => setSelected(null)}>{t.cancel}</button><button className="primary">{t.confirmRedeem}</button></div></form>}<h2 className="admin-subtitle">{t.redemptionTitle}</h2>{redemptions?.length ? <div className="redemption-list">{redemptions.map(item => <article key={item.id}><div><b>{item.gift.name} × {item.quantity}</b><span>{item.points_cost} {t.pointCost} · {statusText(item.status)}</span>{item.tracking_number && <small>{t.trackingNumber}: {item.tracking_number}</small>}</div>{item.status === 'pending_fulfillment' && <button className="secondary" onClick={() => cancel(item)}>{t.cancel}</button>}</article>)}</div> : <p className="feed-status">{t.noRedemptions}</p>}</div>
}

function AdminPage({ t, locale, openRoute }) {
  const [posts, setPosts] = useState(null)
  const [reports, setReports] = useState(null)
  const [users, setUsers] = useState(null)
  const [gifts, setGifts] = useState(null)
  const [redemptions, setRedemptions] = useState(null)
  const [giftImage, setGiftImage] = useState(null)
  const [giftImageLoading, setGiftImageLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const load = () => Promise.all([getModerationQueue(locale), getReportQueue(locale), getAdminUsers(locale), getAdminGifts(locale), getAdminRedemptions(locale)]).then(([postItems, reportItems, userItems, giftItems, redemptionItems]) => { setPosts(postItems); setReports(reportItems); setUsers(userItems); setGifts(giftItems); setRedemptions(redemptionItems) }).catch(error => { setPosts([]); setReports([]); setUsers([]); setGifts([]); setRedemptions([]); setNotice(error.message) })
  useEffect(() => { load() }, [locale])
  const approve = async post => {
    try { setNotice((await approvePost(post.id, '', locale)).message); load() } catch (error) { setNotice(error.message) }
  }
  const remove = async post => {
    const reason = window.prompt(t.removalReason)
    if (!reason?.trim()) return
    try { setNotice((await removePost(post.id, reason.trim(), locale)).message); load() } catch (error) { setNotice(error.message) }
  }
  const resolve = async report => {
    const resolution = window.prompt(t.resolutionPrompt)
    if (!resolution?.trim()) return
    try { setNotice((await resolveReport(report.id, resolution.trim(), locale)).message); load() } catch (error) { setNotice(error.message) }
  }
  const ban = async user => {
    const reason = window.prompt(t.banReason)
    if (!reason?.trim()) return
    const durationInput = window.prompt(t.banDurationPrompt, '')
    if (durationInput === null) return
    const duration = durationInput.trim() ? Number(durationInput) : null
    if (duration !== null && (!Number.isInteger(duration) || duration < 1 || duration > 8760)) return setNotice(t.invalidBanDuration)
    try { setNotice((await banUser(user.id, reason.trim(), duration, locale)).message); load() } catch (error) { setNotice(error.message) }
  }
  const unban = async user => {
    try { setNotice((await unbanUser(user.id, locale)).message); load() } catch (error) { setNotice(error.message) }
  }
  const addGift = async event => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const payload = {
      slug: data.get('slug'), name_zh: data.get('nameZh'), name_en: data.get('nameEn'), name_ja: data.get('nameJa'),
      description_zh: data.get('descriptionZh'), description_en: data.get('descriptionEn'), description_ja: data.get('descriptionJa'),
      point_cost: Number(data.get('pointCost')), stock: Number(data.get('stock')), image_url: giftImage?.url || null, is_active: true,
    }
    try { await createGift(payload, locale); event.currentTarget.reset(); setGiftImage(null); setNotice(''); load() } catch (error) { setNotice(error.message) }
  }
  // Reuse the authenticated media pipeline for gift images. / 礼品图片复用已有的鉴权媒体上传流程。
  const selectGiftImage = async event => {
    const file = event.target.files?.[0]
    if (!file) return
    setGiftImageLoading(true)
    setNotice('')
    try {
      const uploaded = await uploadMedia(file, locale)
      if (uploaded.media_type !== 'image') throw new Error(t.giftImageOnly)
      setGiftImage(uploaded)
    } catch (error) { setNotice(error.message) } finally { setGiftImageLoading(false); event.target.value = '' }
  }
  const toggleGift = async gift => {
    try { await updateGift(gift.id, { is_active: !gift.is_active }, locale); load() } catch (error) { setNotice(error.message) }
  }
  const changeStock = async gift => {
    const value = window.prompt(`${t.stock}:`, String(gift.stock))
    if (value === null || !Number.isInteger(Number(value)) || Number(value) < 0) return
    try { await updateGift(gift.id, { stock: Number(value) }, locale); load() } catch (error) { setNotice(error.message) }
  }
  const ship = async item => {
    const tracking = window.prompt(t.trackingPrompt)
    if (!tracking?.trim()) return
    try { setNotice((await shipRedemption(item.id, tracking.trim(), locale)).message); load() } catch (error) { setNotice(error.message) }
  }
  const cancelOrder = async item => {
    if (!window.confirm(t.cancel)) return
    try { setNotice((await adminCancelRedemption(item.id, locale)).message); load() } catch (error) { setNotice(error.message) }
  }
  const accountStatus = user => user.is_banned ? user.banned_until ? `${t.bannedUntil} ${new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(user.banned_until))}` : t.bannedPermanent : t.accountActive
  const redemptionStatus = status => status === 'shipped' ? t.shipped : status === 'cancelled' ? t.cancelled : t.pendingFulfillment
  return <div className="surface admin-page"><h1>{t.adminTitle}</h1>{notice && <p className="auth-notice">{notice}</p>}<h2 className="admin-subtitle first">{t.adminTitle}</h2>{posts === null ? <p className="feed-status">{t.loadingFeed}</p> : posts.length === 0 ? <p className="feed-status">{t.noReview}</p> : <div className="review-list">{posts.map(post => <article key={post.id}><div><b>{post.title}</b><span><MapPin/>{post.place.name} · {post.author_name}</span><p>{post.body}</p></div><div><button className="secondary" onClick={() => openRoute(post)}>{t.viewRoute}</button><button className="primary" onClick={() => approve(post)}>{t.approve}</button><button className="secondary danger" onClick={() => remove(post)}>{t.remove}</button></div></article>)}</div>}<h2 className="admin-subtitle">{t.reportQueue}</h2>{reports === null ? <p className="feed-status">{t.loadingFeed}</p> : reports.length === 0 ? <p className="feed-status">{t.noReports}</p> : <div className="report-list">{reports.map(report => <article key={report.id}><div><b>{report.category}</b><p>{report.reason}</p></div><button className="secondary" onClick={() => resolve(report)}>{t.resolve}</button></article>)}</div>}<h2 className="admin-subtitle">{t.userManagement}</h2>{users === null ? <p className="feed-status">{t.loadingFeed}</p> : <div className="user-list">{users.map(user => <article key={user.id}><div><b>{user.display_name}</b><span>{user.email}</span><small className={user.is_banned ? 'account-banned' : ''}>{accountStatus(user)}</small>{user.ban_reason && <p>{user.ban_reason}</p>}</div>{!user.is_admin && (user.is_banned ? <button className="secondary" onClick={() => unban(user)}>{t.unban}</button> : <button className="secondary danger" onClick={() => ban(user)}>{t.ban}</button>)}</article>)}</div>}<h2 className="admin-subtitle">{t.giftManagement}</h2><form className="admin-gift-form" onSubmit={addGift}><div className="field-grid"><label>{t.giftSlug}<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*"/></label><label>{t.pointCost}<select name="pointCost" required>{giftPointTiers.map(tier => <option value={tier} key={tier}>{tier}</option>)}</select><small>{t.giftTierHint}</small></label><label>{t.stock}<input name="stock" type="number" min="0" required/></label><label>{t.giftNameZh}<input name="nameZh" required/></label><label>{t.giftNameEn}<input name="nameEn" required/></label><label>{t.giftNameJa}<input name="nameJa" required/></label><label>{t.giftDescriptionZh}<textarea name="descriptionZh"/></label><label>{t.giftDescriptionEn}<textarea name="descriptionEn"/></label><label>{t.giftDescriptionJa}<textarea name="descriptionJa"/></label></div><label className="gift-image-field">{t.giftImage}<span className="upload compact"><Camera/>{giftImageLoading ? t.uploading : t.uploadGiftImage}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectGiftImage}/></span></label>{giftImage && <div className="gift-image-preview"><img src={giftImage.url} alt=""/><button type="button" className="secondary danger" onClick={() => setGiftImage(null)}>{t.removeGiftImage}</button></div>}<button className="primary" disabled={giftImageLoading}><Gift/>{t.createGift}</button></form>{gifts?.length ? <div className="admin-gift-list">{gifts.map(gift => <article key={gift.id}><div>{gift.image_url && <img className="admin-gift-thumb" src={gift.image_url} alt=""/>}<b>{gift.name_zh}</b><span>{gift.slug} · {gift.point_cost} {t.pointCost} · {t.stock} {gift.stock}</span><small>{gift.is_active ? t.active : t.inactive}</small></div><div><button className="secondary" onClick={() => changeStock(gift)}>{t.stock}</button><button className="secondary" onClick={() => toggleGift(gift)}>{t.setActive}</button></div></article>)}</div> : <p className="feed-status">{t.giftEmpty}</p>}<h2 className="admin-subtitle">{t.fulfillment}</h2>{redemptions?.length ? <div className="admin-redemption-list">{redemptions.map(item => <article key={item.id}><div><b>{item.gift.name} × {item.quantity}</b><span>{item.recipient_name} · {item.phone}</span><small>{item.shipping_address}</small><small>{redemptionStatus(item.status)}{item.tracking_number ? ` · ${item.tracking_number}` : ''}</small></div>{item.status === 'pending_fulfillment' && <div><button className="primary" onClick={() => ship(item)}><PackageCheck/>{t.ship}</button><button className="secondary danger" onClick={() => cancelOrder(item)}>{t.cancel}</button></div>}</article>)}</div> : <p className="feed-status">{t.noFulfillment}</p>}</div>
}

function VerifyEmailPage({ t, locale, onLogin }) {
  const [notice, setNotice] = useState(t.auth.loading)
  const [success, setSuccess] = useState(false)
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token')
    if (!token) return setNotice(t.auth.verifyTitle)
    verifyEmail(token, locale).then(() => { setSuccess(true); setNotice(t.auth.verifySuccess) }).catch(error => setNotice(error.message))
  }, [locale])
  return <div className="surface empty verify-email"><Mail/><h1>{t.auth.verifyTitle}</h1><p>{notice}</p>{success && <button className="primary centered" onClick={onLogin}>{t.auth.backToLogin}</button>}</div>
}

function ResetPasswordPage({ t, locale, onLogin }) {
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const token = new URLSearchParams(window.location.search).get('token')
  const submit = async event => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const password = String(data.get('password'))
    if (!token) return setNotice(t.auth.invalidResetLink)
    if (password.length < 8) return setNotice(t.auth.invalidPassword)
    if (password !== data.get('passwordConfirm')) return setNotice(t.auth.passwordMismatch)
    setLoading(true)
    setNotice('')
    try {
      const result = await resetPassword(token, password, locale)
      setSuccess(true)
      setNotice(result.message)
    } catch (error) {
      setNotice(error.message)
    } finally {
      setLoading(false)
    }
  }
  return <div className="surface empty auth-action-page"><Lock/><h1>{t.auth.resetTitle}</h1>{!success && <form onSubmit={submit}><label>{t.auth.newPassword}<input name="password" type="password" autoComplete="new-password" placeholder={t.auth.passwordHint}/></label><label>{t.auth.confirmPassword}<input name="passwordConfirm" type="password" autoComplete="new-password" placeholder={t.auth.passwordHint}/></label><button className="primary" disabled={loading}>{loading ? t.auth.loading : t.auth.resetAction}</button></form>}{notice && <p className="auth-notice" role="status">{notice}</p>}{success && <button className="primary centered" onClick={onLogin}>{t.auth.backToLogin}</button>}</div>
}

function AuthPage({ t, locale, onSignedIn, onLocalReset }) {
  const [mode, setMode] = useState('login')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async event => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    if (!/^\S+@\S+\.\S+$/.test(data.get('email'))) return setNotice(t.auth.invalidEmail)
    if (mode !== 'forgot' && String(data.get('password')).length < 8) return setNotice(t.auth.invalidPassword)
    setLoading(true)
    setNotice('')
    try {
      if (mode === 'forgot') {
        const result = await requestPasswordReset(data.get('email'), locale)
        if (result.reset_token) return onLocalReset(result.reset_token)
        setNotice(result.message)
      } else if (mode === 'register') {
        const result = await registerEmail(data.get('email'), data.get('password'), locale)
        if (result.verification_token) await verifyEmail(result.verification_token, locale)
        setMode('login')
        setNotice(result.verification_token ? t.auth.localVerified : t.auth.checkEmail)
      } else {
        await loginEmail(data.get('email'), data.get('password'), locale)
        const current = await getCurrentUser(locale)
        onSignedIn(current)
        setNotice(t.auth.signedIn)
      }
    } catch (error) {
      setNotice(error.message)
    } finally {
      setLoading(false)
    }
  }
  const heading = mode === 'register' ? t.auth.register : mode === 'forgot' ? t.auth.forgotTitle : t.auth.welcome
  return <div className="auth-shell"><section className="auth-visual"><Logo/><div><span className="auth-kicker">MONT AWAY</span><h2>{t.auth.intro}</h2></div></section><section className="auth-card"><h1>{heading}</h1>{mode === 'login' && <><div className="providers"><button onClick={beginWeChatLogin}><i className="wechat">微</i>{t.auth.wechat}</button></div><div className="auth-divider"><span>{t.auth.divider}</span></div></>}<form onSubmit={submit} noValidate><label><span><Mail/>{t.auth.email}</span><input name="email" type="email" autoComplete="email" placeholder={t.auth.emailHint}/></label>{mode !== 'forgot' && <label><span><Lock/>{t.auth.password}</span><input name="password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} placeholder={t.auth.passwordHint}/></label>}<button className="primary" type="submit" disabled={loading}>{loading ? t.auth.loading : mode === 'register' ? t.auth.register : mode === 'forgot' ? t.auth.sendReset : t.auth.signIn}</button></form>{mode === 'login' && <button className="auth-switch compact" onClick={() => { setMode('forgot'); setNotice('') }}>{t.auth.forgotPassword}</button>}<button className="auth-switch" onClick={() => { setMode(mode === 'register' ? 'login' : mode === 'forgot' ? 'login' : 'register'); setNotice('') }}>{mode === 'register' || mode === 'forgot' ? t.auth.switchIn : t.auth.switchUp}</button>{notice && <p className="auth-notice" role="status">{notice}</p>}<p className="terms">{t.auth.terms}</p></section></div>
}

function ProfilePage({ t, locale, user, setUser, onAdmin, onEdit, onLocalReset }) {
  const [posts, setPosts] = useState(null)
  useEffect(() => {
    if (user) getMyPosts(locale).then(setPosts).catch(() => setPosts([]))
  }, [locale, user])
  if (!user) return <AuthPage t={t} locale={locale} onSignedIn={setUser} onLocalReset={onLocalReset}/>
  const signOut = async () => {
    try { await logout(locale) } finally { setUser(null) }
  }
  const statusText = post => post.visibility_status === 'draft' ? t.statusDraft : post.visibility_status === 'removed' ? t.statusRemoved : post.moderation_status === 'approved' ? t.statusApproved : t.statusPending
  return <div className="surface profile-page"><div className="profile-avatar">{user.display_name.slice(0, 1).toUpperCase()}</div><h1>{t.profileTitle}</h1><p className="muted">{t.signedInAs}</p><b>{user.display_name}</b><span>{user.email}</span>{user.is_admin && <button className="primary profile-action" onClick={onAdmin}>{t.adminEntry}</button>}<button className="secondary danger profile-action" onClick={signOut}><LogOut/>{t.signOut}</button><section className="my-posts"><h2>{t.myPosts}</h2>{posts?.map(post => <article key={post.id}><Scenic small t={t} media={post.media?.[0]}/><div><b>{post.title}</b><small>{statusText(post)}</small><button onClick={() => onEdit(post)}>{t.editPost}</button></div></article>)}</section></div>
}

function Placeholder({ title, t }) {
  return <div className="surface empty"><h1>{title}</h1><p>{t.empty}</p></div>
}

function PostDetailPage({ post, error, openRoute, t, locale, user, onRequireAuth }) {
  if (error) return <div className="surface empty"><h1>{t.postUnavailable}</h1><p>{error}</p></div>
  if (!post) return <div className="feed"><p className="feed-status">{t.loadingFeed}</p></div>
  return <div className="feed post-detail-page"><PostCard initialPost={post} openRoute={openRoute} t={t} locale={locale} user={user} onRequireAuth={onRequireAuth}/></div>
}

function TrendingRail({ t, locale, openRoute, onOpenRanking }) {
  const [posts, setPosts] = useState(null)
  useEffect(() => { listPosts(locale, '', 'popular').then(setPosts).catch(() => setPosts([])) }, [locale])
  return <><button className="rail-ranking" onClick={onOpenRanking}><Trophy/>{t.weekly}</button>{posts === null ? <small className="muted">{t.loadingFeed}</small> : posts.length ? posts.slice(0, 3).map((post, index) => <button className="mini" onClick={() => openRoute(post)} key={post.id}><i>{index + 1}</i><span><b>{post.place.name}</b><small>{post.like_count} {t.likes}</small></span></button>) : <small className="muted">{t.noPopular}</small>}</>
}

const pagePaths = { home: '/', map: '/map', publish: '/publish', messages: '/messages', gifts: '/gifts', profile: '/profile', search: '/search', ranking: '/ranking', admin: '/admin' }

function locationState() {
  const path = window.location.pathname
  if (path.startsWith('/auth/verify')) return { page: 'verify-email' }
  if (path.startsWith('/auth/reset-password')) return { page: 'reset-password' }
  if (path.startsWith('/auth/callback')) return { page: 'home' }
  const postMatch = path.match(/^\/posts\/([^/]+)(\/route)?\/?$/)
  if (postMatch) return { page: postMatch[2] ? 'route' : 'post', postId: postMatch[1] }
  const page = Object.entries(pagePaths).find(([, value]) => value !== '/' && path.startsWith(value))?.[0]
  return { page: page || 'home' }
}

function App() {
  const initialLocation = locationState()
  const [page, setPage] = useState(initialLocation.page)
  const [locale, setLocale] = useState(detectLocale)
  const [user, setUser] = useState(null)
  const [selectedPost, setSelectedPost] = useState(null)
  const [postError, setPostError] = useState('')
  const [editingPost, setEditingPost] = useState(null)
  const [feedVersion, setFeedVersion] = useState(0)
  const t = messages[locale]

  useEffect(() => {
    localStorage.setItem('shanyao-locale', locale)
    document.documentElement.lang = locale
    if (hasStoredSession()) restoreCurrentUser(locale).then(setUser).catch(() => setUser(null))
  }, [locale])

  useEffect(() => {
    const applyLocation = () => {
      const next = locationState()
      setPage(next.page)
      if (next.postId) {
        setSelectedPost(null)
        setPostError('')
        getPost(next.postId, locale).then(setSelectedPost).catch(error => setPostError(error.message))
      }
    }
    if (initialLocation.postId) getPost(initialLocation.postId, locale).then(setSelectedPost).catch(error => setPostError(error.message))
    window.addEventListener('popstate', applyLocation)
    return () => window.removeEventListener('popstate', applyLocation)
  }, [locale])

  // Complete the one-time OAuth exchange after WeChat redirects back. / 微信回跳后完成一次性交换码登录。
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    if (!window.location.pathname.startsWith('/auth/callback') || !code) return
    exchangeWeChatCode(code, locale).then(() => getCurrentUser(locale)).then(current => { setUser(current); setPage('profile') }).finally(() => window.history.replaceState({}, '', '/'))
  }, [])

  const go = (id, explicitPath) => {
    if (id === 'publish') setEditingPost(null)
    setPage(id)
    const path = explicitPath || pagePaths[id]
    if (path && window.location.pathname !== path) window.history.pushState({}, '', path)
    window.scrollTo(0, 0)
  }
  const openRoute = post => { setSelectedPost(post); setPostError(''); go('route', post?.id ? `/posts/${post.id}/route` : undefined) }
  const editPost = post => { setEditingPost(post); setPage('publish'); window.scrollTo(0, 0) }
  const openLocalReset = token => { window.history.replaceState({}, '', `/auth/reset-password?token=${encodeURIComponent(token)}`); setPage('reset-password'); window.scrollTo(0, 0) }
  const returnToLogin = () => { setUser(null); window.history.replaceState({}, '', '/'); go('profile') }
  const requireAuth = () => go('profile')
  const content = page === 'home'
    ? <Home openRoute={openRoute} t={t} locale={locale} user={user} onRequireAuth={requireAuth} refreshKey={feedVersion}/>
    : page === 'map' ? <Discover openRoute={openRoute} t={t} locale={locale}/>
      : page === 'route' ? postError ? <PostDetailPage error={postError} t={t}/> : selectedPost ? <RoutePage t={t} post={selectedPost}/> : <PostDetailPage t={t}/>
        : page === 'post' ? <PostDetailPage post={selectedPost} error={postError} openRoute={openRoute} t={t} locale={locale} user={user} onRequireAuth={requireAuth}/>
        : page === 'publish' ? <Publish key={editingPost?.id || 'new'} t={t} locale={locale} user={user} initialPost={editingPost} onRequireAuth={requireAuth} onPublished={() => { setEditingPost(null); setFeedVersion(value => value + 1); go('home') }}/>
          : page === 'messages' ? <ActivityPage t={t} locale={locale} user={user} onRequireAuth={requireAuth} onOpenGifts={() => go('gifts')}/>
            : page === 'gifts' ? <GiftPage t={t} locale={locale} user={user} onRequireAuth={requireAuth}/>
            : page === 'profile' ? <ProfilePage t={t} locale={locale} user={user} setUser={setUser} onAdmin={() => go('admin')} onEdit={editPost} onLocalReset={openLocalReset}/>
            : page === 'search' ? <SearchPage t={t} locale={locale} openRoute={openRoute} user={user} onRequireAuth={requireAuth}/>
              : page === 'ranking' ? <RankingPage t={t} locale={locale} openRoute={openRoute} user={user} onRequireAuth={requireAuth}/>
                : page === 'admin' ? <AdminPage t={t} locale={locale} openRoute={openRoute}/>
                  : page === 'verify-email' ? <VerifyEmailPage t={t} locale={locale} onLogin={returnToLogin}/>
                    : page === 'reset-password' ? <ResetPasswordPage t={t} locale={locale} onLogin={returnToLogin}/>
                      : <Placeholder title={t.nav[3]} t={t}/>

  const navActive = id => page === id || (id === 'messages' && page === 'gifts')
  return <div className="app"><aside className="desktop-nav"><Logo/><nav>{t.nav.map((name, index) => { const Icon = navIcons[index]; const id = navIds[index]; return <button className={navActive(id) ? 'active' : ''} onClick={() => go(id)} key={id}><Icon/>{name}</button> })}</nav><LanguageSwitch locale={locale} setLocale={setLocale} t={t}/><div className="account"><div className="avatar">{user ? user.display_name.slice(0, 1).toUpperCase() : '山'}</div><span>{user?.display_name || t.auth.welcome}</span></div></aside><header className="mobile-head"><Logo/><div><LanguageSwitch locale={locale} setLocale={setLocale} t={t}/><button aria-label="Search" onClick={() => go('search')}><Search/></button><button aria-label="Ranking" onClick={() => go('ranking')}><Trophy/></button></div></header><main className="main">{content}</main><aside className="right-rail"><div className="profile"><div className="avatar">{user ? user.display_name.slice(0, 1).toUpperCase() : '山'}</div><span><b>{user?.display_name || t.auth.welcome}</b><small>{t.bio}</small></span></div><button className="rail-search" onClick={() => go('search')}><Search/>{t.searchHint}</button>{user && <button className="rail-search rail-gift" onClick={() => go('gifts')}><Gift/>{t.openGifts}</button>}<TrendingRail t={t} locale={locale} openRoute={openRoute} onOpenRanking={() => go('ranking')}/></aside><nav className="mobile-nav">{t.nav.map((name, index) => { const Icon = navIcons[index]; const id = navIds[index]; return <button className={navActive(id) ? 'active' : ''} onClick={() => go(id)} key={id}><Icon/><small>{name}</small></button> })}</nav></div>
}

// Reuse the development root across hot updates. / 开发热更新时复用 React 根节点。
window.__shanyaoRoot ||= createRoot(document.getElementById('root'))
window.__shanyaoRoot.render(<App/>)
