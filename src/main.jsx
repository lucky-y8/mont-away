import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { House, Map, PlusSquare, Bell, UserRound, Search, Trophy, Heart, MessageCircle, Bookmark, Send, MapPin, Route, MoreHorizontal, Camera, Video, Navigation, ChevronRight, Languages } from 'lucide-react'
import { detectLocale, localeOptions, messages } from './i18n'
import './styles.css'

const navIds = ['home', 'map', 'publish', 'messages', 'profile']
const navIcons = [House, Map, PlusSquare, Bell, UserRound]
const Logo = () => <div className="logo">山遥</div>

function Scenic({ small = false, t }) {
  return <div className={'scenic ' + (small ? 'small' : '')}><div className="mountain m1"/><div className="mountain m2"/><div className="water"/><span>{t.sampleMedia}</span></div>
}
function LanguageSwitch({ locale, setLocale, t }) {
  return <label className="language"><Languages/><span>{t.language}</span><select aria-label={t.language} value={locale} onChange={e => setLocale(e.target.value)}>{localeOptions.map(x => <option value={x.code} key={x.code}>{x.label}</option>)}</select></label>
}
function MapView({ t }) {
  return <div className="map-view"><div className="lake"/><div className="track"/>{t.nodes.map((_, i) => <button className={'pin p' + i} key={i}>{i === 0 ? t.start : i === 3 ? t.end : i}</button>)}<small>{t.mapSample}</small></div>
}
function Home({ openRoute, t }) {
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  return <div className="feed"><div className="feed-tabs">{t.tabs.map((x, i) => <button className={i === 0 ? 'selected' : ''} key={x}>{x}</button>)}</div><article className="post"><header><div className="avatar">林</div><div className="identity"><b>小林去走走</b><button className="place"><MapPin/>{t.location}</button></div><button className="icon-btn" aria-label="More"><MoreHorizontal/></button></header><Scenic t={t}/><div className="post-actions"><button onClick={() => setLiked(!liked)} className={liked ? 'liked' : ''} aria-label="Like"><Heart fill={liked ? 'currentColor' : 'none'}/></button><button aria-label="Comment"><MessageCircle/></button><button aria-label="Share"><Send/></button><button className="save" onClick={() => setSaved(!saved)} aria-label="Save"><Bookmark fill={saved ? 'currentColor' : 'none'}/></button></div><div className="copy"><b>{liked ? '329' : '328'} {t.likes}</b><p><b>小林去走走</b> {t.post}</p><button className="comments">{t.comments}</button><button className="route-card" onClick={openRoute}><Route/><span><b>{t.viewRoute}</b><small>{t.routeMeta}</small></span><ChevronRight/></button></div></article></div>
}
function Discover({ openRoute, t }) {
  return <div className="surface split"><MapView t={t}/><aside className="panel"><h1>{t.mapTitle}</h1><p className="muted">{t.mapIntro}</p><div className="chips">{t.filters.map(x => <button key={x}>{x}</button>)}</div><div className="result"><Scenic small t={t}/><span><b>{t.names[0]}</b><small>24 {t.routes}</small></span></div><button className="primary" onClick={openRoute}>{t.viewPlace}</button></aside></div>
}
function RoutePage({ t }) {
  return <div className="surface split route-page"><MapView t={t}/><aside className="panel"><span className="place static"><MapPin/>{t.names[0]}</span><h1>{t.routeTitle}</h1><p className="muted">{t.duration}</p><div className="node-list">{t.nodes.map((n, i) => <button className="node" key={n}><i>{i === 0 ? t.start : i === 3 ? t.end : i}</i><span><b>{n}</b><small>{i === 2 ? t.media5 : t.photo2}</small></span><ChevronRight/></button>)}</div><button className="primary"><Navigation/>{t.navigate}</button></aside></div>
}
function Publish({ t }) {
  return <div className="surface editor"><aside className="editor-list"><h2>{t.editorNodes}</h2>{t.nodes.map((n, i) => <button className="node" key={n}><i>{i === 0 ? t.start : i === 3 ? t.end : i}</i><span><b>{n}</b></span></button>)}<button className="secondary">{t.addNode}</button></aside><MapView t={t}/><aside className="form"><h1>{t.editor}</h1><label>{t.title}<input defaultValue={t.sampleTitle} key={'title-' + t.sampleTitle}/></label><label>{t.intro}<textarea defaultValue={t.introText} key={'intro-' + t.introText}/></label><label>{t.transport}<select><option>{t.none}</option><option>{t.walk}</option><option>{t.ride}</option></select></label><button className="upload"><Camera/><Video/>{t.addMedia}</button><div className="form-actions"><button className="secondary">{t.draft}</button><button className="primary">{t.publish}</button></div><small className="muted">{t.publishHint}</small></aside></div>
}
function Placeholder({ title, t }) {
  return <div className="surface empty"><h1>{title}</h1><p>{t.empty}</p></div>
}
function App() {
  const [page, setPage] = useState('home')
  const [locale, setLocale] = useState(detectLocale)
  const t = messages[locale]
  useEffect(() => { localStorage.setItem('shanyao-locale', locale); document.documentElement.lang = locale }, [locale])
  const go = id => { setPage(id); scrollTo(0, 0) }
  const content = page === 'home' ? <Home openRoute={() => go('route')} t={t}/> : page === 'map' ? <Discover openRoute={() => go('route')} t={t}/> : page === 'route' ? <RoutePage t={t}/> : page === 'publish' ? <Publish t={t}/> : <Placeholder title={page === 'messages' ? t.nav[3] : t.nav[4]} t={t}/>
  return <div className="app"><aside className="desktop-nav"><Logo/><nav>{t.nav.map((name, i) => { const Icon = navIcons[i]; const id = navIds[i]; return <button className={page === id ? 'active' : ''} onClick={() => go(id)} key={id}><Icon/>{name}</button> })}</nav><LanguageSwitch locale={locale} setLocale={setLocale} t={t}/><div className="account"><div className="avatar">林</div><span>小林去走走</span></div></aside><header className="mobile-head"><Logo/><div><LanguageSwitch locale={locale} setLocale={setLocale} t={t}/><button aria-label="Search"><Search/></button><button aria-label="Ranking"><Trophy/></button></div></header><main className="main">{content}</main><aside className="right-rail"><div className="profile"><div className="avatar">林</div><span><b>小林去走走</b><small>{t.bio}</small></span></div><h3>{t.weekly}</h3>{t.names.map((x, i) => <div className="mini" key={x}><i>{i + 1}</i><span><b>{x}</b><small>{24 - i * 6} {t.routes}</small></span></div>)}<small className="muted">{t.sampleData}</small></aside><nav className="mobile-nav">{t.nav.map((name, i) => { const Icon = navIcons[i]; const id = navIds[i]; return <button className={page === id ? 'active' : ''} onClick={() => go(id)} key={id}><Icon/><small>{name}</small></button> })}</nav></div>
}

createRoot(document.getElementById('root')).render(<App/>)
