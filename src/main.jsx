import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { House, Map, PlusSquare, Bell, UserRound, Search, Trophy, Heart, MessageCircle, Bookmark, Send, MapPin, Route, MoreHorizontal, Camera, Video, Navigation, ChevronRight, Languages, Mail, Lock, LogOut } from 'lucide-react'
import { detectLocale, localeOptions, messages } from './i18n'
import { addComment, approvePost, beginWeChatLogin, createPost, exchangeWeChatCode, getCurrentUser, getModerationQueue, getMyPosts, getNotifications, getPointAccount, getReportQueue, hasStoredSession, listComments, listPosts, loginEmail, logout, registerEmail, removePost, reportPost, resolveReport, restoreCurrentUser, setPostBookmark, setPostLike, updatePost, uploadMedia, verifyEmail } from './api'
import './styles.css'

const navIds = ['home', 'map', 'publish', 'messages', 'profile']
const navIcons = [House, Map, PlusSquare, Bell, UserRound]
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
  const points = route ? [route.start, ...route.nodes, route.end].slice(0, 4) : t.nodes.map(name => ({ name }))
  return <div className="map-view"><div className="lake"/><div className="track"/>{points.map((point, index) => <button title={point.name} className={'pin p' + index} key={`${point.name}-${index}`}>{index === 0 ? t.start : index === points.length - 1 ? t.end : index}</button>)}<small>{t.mapSample}</small></div>
}

function samplePost(t) {
  return {
    id: null,
    author_name: '小林去走走',
    title: t.sampleTitle,
    body: t.post,
    like_count: 328,
    liked_by_me: false,
    place: { name: t.location, city: '' },
    route: {
      distance_meters: 3800,
      start: { name: t.nodes[0] },
      end: { name: t.nodes[t.nodes.length - 1] },
      nodes: t.nodes.slice(1, -1).map((name, index) => ({ id: `sample-${index}`, name })),
    },
  }
}

function PostCard({ initialPost, openRoute, t, locale, user, onRequireAuth }) {
  const [post, setPost] = useState(initialPost)
  const [saved, setSaved] = useState(Boolean(initialPost.bookmarked_by_me))
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
  const distance = post.route.distance_meters ? `${(post.route.distance_meters / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} km` : '—'
  return <article className="post"><header><div className="avatar">{post.author_name.slice(0, 1).toUpperCase()}</div><div className="identity"><b>{post.author_name}</b><button className="place"><MapPin/>{post.place.name}</button></div><button className="icon-btn" aria-label="More" onClick={report}><MoreHorizontal/></button></header><Scenic t={t} media={post.media?.[0]}/><div className="post-actions"><button onClick={toggleLike} className={post.liked_by_me ? 'liked' : ''} aria-label="Like"><Heart fill={post.liked_by_me ? 'currentColor' : 'none'}/></button><button aria-label="Comment" onClick={toggleComments}><MessageCircle/></button><button aria-label="Share"><Send/></button><button className="save" onClick={toggleSave} aria-label="Save"><Bookmark fill={saved ? 'currentColor' : 'none'}/></button></div><div className="copy"><b>{post.like_count} {t.likes}</b><p><b>{post.author_name}</b> {post.body}</p>{notice && <small className="inline-notice">{notice}</small>}<button className="comments" onClick={toggleComments}>{post.comment_count ?? 12} {t.commentUnit}</button>{commentsOpen && <div className="comment-panel">{comments === null ? <small>{t.loadingFeed}</small> : comments.length ? comments.map(comment => <p key={comment.id}><b>{comment.author_name}</b> {comment.body}</p>) : <small>{t.noComments}</small>}<form onSubmit={submitComment}><input name="comment" maxLength="2000" placeholder={t.commentHint}/><button>{t.commentSend}</button></form></div>}<button className="route-card" onClick={() => openRoute(post)}><Route/><span><b>{t.viewRoute}</b><small>{distance} · {post.route.nodes.length + 2} {t.editorNodes}</small></span><ChevronRight/></button></div></article>
}

function Home({ openRoute, t, locale, user, onRequireAuth, refreshKey }) {
  const [posts, setPosts] = useState(null)
  const [error, setError] = useState('')
  const load = () => {
    setPosts(null)
    setError('')
    listPosts(locale).then(setPosts).catch(error => { setError(error.message); setPosts([]) })
  }
  useEffect(load, [locale, refreshKey])
  const displayed = posts?.length ? posts : [samplePost(t)]
  return <div className="feed"><div className="feed-tabs">{t.tabs.map((tab, index) => <button className={index === 0 ? 'selected' : ''} key={tab}>{tab}</button>)}</div>{posts === null ? <p className="feed-status">{t.loadingFeed}</p> : <>{error && <p className="feed-status error">{t.feedError}: {error} <button onClick={load}>{t.retry}</button></p>}{!error && posts.length === 0 && <p className="feed-status">{t.demoPost}</p>}<div className="post-stack">{displayed.map((post, index) => <PostCard key={post.id || `sample-${index}`} initialPost={post} openRoute={openRoute} t={t} locale={locale} user={user} onRequireAuth={onRequireAuth}/>)}</div></>}</div>
}

function Discover({ openRoute, t }) {
  return <div className="surface split"><MapView t={t}/><aside className="panel"><h1>{t.mapTitle}</h1><p className="muted">{t.mapIntro}</p><div className="chips">{t.filters.map(filter => <button key={filter}>{filter}</button>)}</div><div className="result"><Scenic small t={t}/><span><b>{t.names[0]}</b><small>24 {t.routes}</small></span></div><button className="primary" onClick={() => openRoute(null)}>{t.viewPlace}</button></aside></div>
}

function RoutePage({ t, post }) {
  const route = post?.route
  const nodes = route ? [route.start, ...route.nodes, route.end] : t.nodes.map(name => ({ name }))
  return <div className="surface split route-page"><MapView t={t} route={route}/><aside className="panel"><span className="place static"><MapPin/>{post?.place.name || t.names[0]}</span><h1>{post?.title || t.routeTitle}</h1><p className="muted">{route?.distance_meters ? `${(route.distance_meters / 1000).toFixed(1)} km` : t.duration}</p><div className="node-list">{nodes.map((node, index) => <button className="node" key={`${node.name}-${index}`}><i>{index === 0 ? t.start : index === nodes.length - 1 ? t.end : index}</i><span><b>{node.name}</b><small>{node.description || (index === 2 ? t.media5 : t.photo2)}</small></span><ChevronRight/></button>)}</div><button className="primary"><Navigation/>{t.navigate}</button></aside></div>
}

function Publish({ t, locale, user, initialPost, onRequireAuth, onPublished }) {
  if (initialPost) {
    const routeNames = [initialPost.route.start.name, ...initialPost.route.nodes.map(node => node.name), initialPost.route.end.name]
    t = { ...t, sampleTitle: initialPost.title, introText: initialPost.body, names: [initialPost.place.name, ...t.names.slice(1)], nodes: routeNames }
  }
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [media, setMedia] = useState(initialPost?.media || [])
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
        nodes: [],
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
  return <div className="surface editor"><aside className="editor-list"><h2>{t.editorNodes}</h2>{t.nodes.map((node, index) => <button className="node" key={node}><i>{index === 0 ? t.start : index === t.nodes.length - 1 ? t.end : index}</i><span><b>{node}</b></span></button>)}<button className="secondary" type="button">{t.addNode}</button></aside><MapView t={t}/><form className="form" onSubmit={submit}><h1>{t.editor}</h1><label>{t.title}<input name="title" required maxLength="120" defaultValue={t.sampleTitle}/></label><label>{t.intro}<textarea name="body" required maxLength="20000" defaultValue={t.introText}/></label><div className="field-grid"><label>{t.placeName}<input name="place" required defaultValue={t.names[0]}/></label><label>{t.city}<input name="city" required defaultValue={locale === 'en' ? 'Hangzhou' : '杭州'}/></label></div><label>{t.transport}<select name="transport"><option value="">{t.none}</option><option value="walking">{t.walk}</option><option value="cycling">{t.ride}</option></select></label><div className="field-grid"><label>{t.startName}<input name="startName" required defaultValue={t.nodes[0]}/></label><label>{t.endName}<input name="endName" required defaultValue={t.nodes[t.nodes.length - 1]}/></label><label>{t.latitude} · {t.start}<input name="startLat" type="number" step="any" min="-90" max="90" required defaultValue="30.2465"/></label><label>{t.longitude} · {t.start}<input name="startLng" type="number" step="any" min="-180" max="180" required defaultValue="120.1439"/></label><label>{t.latitude} · {t.end}<input name="endLat" type="number" step="any" min="-90" max="90" required defaultValue="30.2448"/></label><label>{t.longitude} · {t.end}<input name="endLng" type="number" step="any" min="-180" max="180" required defaultValue="120.1482"/></label></div><small className="muted">{t.coordinateHint}</small><label className="upload"><Camera/><Video/>{uploading ? t.uploading : t.addMedia}<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" multiple onChange={selectMedia} disabled={uploading}/></label>{media.length > 0 && <div className="media-previews"><b>{t.uploadedMedia} · {media.length}</b>{media.map(item => item.media_type === 'image' ? <img src={item.url} alt="" key={item.id}/> : <video src={item.url} key={item.id}/>)}</div>}<div className="form-actions"><button className="secondary" type="submit" name="intent" value="draft" disabled={loading || uploading}>{t.draft}</button><button className="primary" type="submit" name="intent" value="publish" disabled={loading || uploading}>{loading ? t.auth.loading : t.publish}</button></div>{notice && <p className="auth-notice" role="status">{notice}</p>}<small className="muted">{t.publishHint}</small></form></div>
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

function ActivityPage({ t, locale, user, onRequireAuth }) {
  const [notifications, setNotifications] = useState(null)
  const [points, setPoints] = useState(null)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    if (!user) return
    Promise.all([getNotifications(locale), getPointAccount(locale)]).then(([items, account]) => { setNotifications(items); setPoints(account) }).catch(error => setNotice(error.message))
  }, [locale, user])
  if (!user) return <div className="surface empty"><h1>{t.activityTitle}</h1><p>{t.loginRequired}</p><button className="primary centered" onClick={onRequireAuth}>{t.goLogin}</button></div>
  return <div className="surface activity-page"><h1>{t.activityTitle}</h1><section className="point-card"><span>{t.pointBalance}</span><b>{points?.balance ?? '—'}</b><small>{t.pointPending}</small></section>{notice && <p className="feed-status error">{notice}</p>}{notifications === null && !notice ? <p className="feed-status">{t.loadingFeed}</p> : notifications?.length ? <div className="notification-list">{notifications.map(item => <article key={item.id}><Bell/><div><p>{item.message}</p><small>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.created_at))}</small></div></article>)}</div> : <p className="feed-status">{t.noActivity}</p>}</div>
}

function AdminPage({ t, locale, openRoute }) {
  const [posts, setPosts] = useState(null)
  const [reports, setReports] = useState(null)
  const [notice, setNotice] = useState('')
  const load = () => Promise.all([getModerationQueue(locale), getReportQueue(locale)]).then(([postItems, reportItems]) => { setPosts(postItems); setReports(reportItems) }).catch(error => { setPosts([]); setReports([]); setNotice(error.message) })
  useEffect(load, [locale])
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
  return <div className="surface admin-page"><h1>{t.adminTitle}</h1>{notice && <p className="auth-notice">{notice}</p>}{posts === null ? <p className="feed-status">{t.loadingFeed}</p> : posts.length === 0 ? <p className="feed-status">{t.noReview}</p> : <div className="review-list">{posts.map(post => <article key={post.id}><div><b>{post.title}</b><span><MapPin/>{post.place.name} · {post.author_name}</span><p>{post.body}</p></div><div><button className="secondary" onClick={() => openRoute(post)}>{t.viewRoute}</button><button className="primary" onClick={() => approve(post)}>{t.approve}</button><button className="secondary danger" onClick={() => remove(post)}>{t.remove}</button></div></article>)}</div>}<h2 className="admin-subtitle">{t.reportQueue}</h2>{reports === null ? <p className="feed-status">{t.loadingFeed}</p> : reports.length === 0 ? <p className="feed-status">{t.noReports}</p> : <div className="report-list">{reports.map(report => <article key={report.id}><div><b>{report.category}</b><p>{report.reason}</p></div><button className="secondary" onClick={() => resolve(report)}>{t.resolve}</button></article>)}</div>}</div>
}

function AuthPage({ t, locale, onSignedIn }) {
  const [register, setRegister] = useState(false)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async event => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    if (!/^\S+@\S+\.\S+$/.test(data.get('email'))) return setNotice(t.auth.invalidEmail)
    if (String(data.get('password')).length < 8) return setNotice(t.auth.invalidPassword)
    setLoading(true)
    setNotice('')
    try {
      if (register) {
        const result = await registerEmail(data.get('email'), data.get('password'), locale)
        if (result.verification_token) await verifyEmail(result.verification_token, locale)
        setRegister(false)
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
  return <div className="auth-shell"><section className="auth-visual"><Logo/><div><span className="auth-kicker">MONT AWAY</span><h2>{t.auth.intro}</h2></div></section><section className="auth-card"><h1>{register ? t.auth.register : t.auth.welcome}</h1><div className="providers"><button onClick={beginWeChatLogin}><i className="wechat">微</i>{t.auth.wechat}</button></div><div className="auth-divider"><span>{t.auth.divider}</span></div><form onSubmit={submit} noValidate><label><span><Mail/>{t.auth.email}</span><input name="email" type="email" autoComplete="email" placeholder={t.auth.emailHint}/></label><label><span><Lock/>{t.auth.password}</span><input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} placeholder={t.auth.passwordHint}/></label><button className="primary" type="submit" disabled={loading}>{loading ? t.auth.loading : register ? t.auth.register : t.auth.signIn}</button></form><button className="auth-switch" onClick={() => { setRegister(!register); setNotice('') }}>{register ? t.auth.switchIn : t.auth.switchUp}</button>{notice && <p className="auth-notice" role="status">{notice}</p>}<p className="terms">{t.auth.terms}</p></section></div>
}

function ProfilePage({ t, locale, user, setUser, onAdmin, onEdit }) {
  const [posts, setPosts] = useState(null)
  useEffect(() => {
    if (user) getMyPosts(locale).then(setPosts).catch(() => setPosts([]))
  }, [locale, user])
  if (!user) return <AuthPage t={t} locale={locale} onSignedIn={setUser}/>
  const signOut = async () => {
    try { await logout(locale) } finally { setUser(null) }
  }
  const statusText = post => post.visibility_status === 'draft' ? t.statusDraft : post.visibility_status === 'removed' ? t.statusRemoved : post.moderation_status === 'approved' ? t.statusApproved : t.statusPending
  return <div className="surface profile-page"><div className="profile-avatar">{user.display_name.slice(0, 1).toUpperCase()}</div><h1>{t.profileTitle}</h1><p className="muted">{t.signedInAs}</p><b>{user.display_name}</b><span>{user.email}</span>{user.is_admin && <button className="primary profile-action" onClick={onAdmin}>{t.adminEntry}</button>}<button className="secondary danger profile-action" onClick={signOut}><LogOut/>{t.signOut}</button><section className="my-posts"><h2>{t.myPosts}</h2>{posts?.map(post => <article key={post.id}><Scenic small t={t} media={post.media?.[0]}/><div><b>{post.title}</b><small>{statusText(post)}</small><button onClick={() => onEdit(post)}>{t.editPost}</button></div></article>)}</section></div>
}

function Placeholder({ title, t }) {
  return <div className="surface empty"><h1>{title}</h1><p>{t.empty}</p></div>
}

function App() {
  const [page, setPage] = useState('home')
  const [locale, setLocale] = useState(detectLocale)
  const [user, setUser] = useState(null)
  const [selectedPost, setSelectedPost] = useState(null)
  const [editingPost, setEditingPost] = useState(null)
  const [feedVersion, setFeedVersion] = useState(0)
  const t = messages[locale]

  useEffect(() => {
    localStorage.setItem('shanyao-locale', locale)
    document.documentElement.lang = locale
    if (hasStoredSession()) restoreCurrentUser(locale).then(setUser).catch(() => setUser(null))
  }, [locale])

  // Complete the one-time OAuth exchange after WeChat redirects back. / 微信回跳后完成一次性交换码登录。
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    if (!window.location.pathname.startsWith('/auth/callback') || !code) return
    exchangeWeChatCode(code, locale).then(() => getCurrentUser(locale)).then(current => { setUser(current); setPage('profile') }).finally(() => window.history.replaceState({}, '', '/'))
  }, [])

  const go = id => { if (id === 'publish') setEditingPost(null); setPage(id); window.scrollTo(0, 0) }
  const openRoute = post => { setSelectedPost(post); go('route') }
  const editPost = post => { setEditingPost(post); setPage('publish'); window.scrollTo(0, 0) }
  const requireAuth = () => go('profile')
  const content = page === 'home'
    ? <Home openRoute={openRoute} t={t} locale={locale} user={user} onRequireAuth={requireAuth} refreshKey={feedVersion}/>
    : page === 'map' ? <Discover openRoute={openRoute} t={t}/>
      : page === 'route' ? <RoutePage t={t} post={selectedPost}/>
        : page === 'publish' ? <Publish key={editingPost?.id || 'new'} t={t} locale={locale} user={user} initialPost={editingPost} onRequireAuth={requireAuth} onPublished={() => { setEditingPost(null); setFeedVersion(value => value + 1); go('home') }}/>
          : page === 'messages' ? <ActivityPage t={t} locale={locale} user={user} onRequireAuth={requireAuth}/>
            : page === 'profile' ? <ProfilePage t={t} locale={locale} user={user} setUser={setUser} onAdmin={() => go('admin')} onEdit={editPost}/>
            : page === 'search' ? <SearchPage t={t} locale={locale} openRoute={openRoute} user={user} onRequireAuth={requireAuth}/>
              : page === 'ranking' ? <RankingPage t={t} locale={locale} openRoute={openRoute} user={user} onRequireAuth={requireAuth}/>
                : page === 'admin' ? <AdminPage t={t} locale={locale} openRoute={openRoute}/>
                  : <Placeholder title={t.nav[3]} t={t}/>

  return <div className="app"><aside className="desktop-nav"><Logo/><nav>{t.nav.map((name, index) => { const Icon = navIcons[index]; const id = navIds[index]; return <button className={page === id ? 'active' : ''} onClick={() => go(id)} key={id}><Icon/>{name}</button> })}</nav><LanguageSwitch locale={locale} setLocale={setLocale} t={t}/><div className="account"><div className="avatar">{user ? user.display_name.slice(0, 1).toUpperCase() : '山'}</div><span>{user?.display_name || t.auth.welcome}</span></div></aside><header className="mobile-head"><Logo/><div><LanguageSwitch locale={locale} setLocale={setLocale} t={t}/><button aria-label="Search" onClick={() => go('search')}><Search/></button><button aria-label="Ranking" onClick={() => go('ranking')}><Trophy/></button></div></header><main className="main">{content}</main><aside className="right-rail"><div className="profile"><div className="avatar">{user ? user.display_name.slice(0, 1).toUpperCase() : '山'}</div><span><b>{user?.display_name || t.auth.welcome}</b><small>{t.bio}</small></span></div><button className="rail-search" onClick={() => go('search')}><Search/>{t.searchHint}</button><button className="rail-ranking" onClick={() => go('ranking')}><Trophy/>{t.weekly}</button>{t.names.map((name, index) => <div className="mini" key={name}><i>{index + 1}</i><span><b>{name}</b><small>{24 - index * 6} {t.routes}</small></span></div>)}<small className="muted">{t.sampleData}</small></aside><nav className="mobile-nav">{t.nav.map((name, index) => { const Icon = navIcons[index]; const id = navIds[index]; return <button className={page === id ? 'active' : ''} onClick={() => go(id)} key={id}><Icon/><small>{name}</small></button> })}</nav></div>
}

createRoot(document.getElementById('root')).render(<App/>)
