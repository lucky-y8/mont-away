import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Question } from '../types';
import { QuestionFeed } from './feed.js';

const emptySummary = { total: 0, mastered: 0, uploads: 0, chapters: {} as Record<string,number>, sourceCounts: {} as Record<string,number>, topics: {} as Record<string,number>, prediction: { paper: [], extended: [] } };

export function useQuestionFeed({ ready, filters, currentId, mode, listLimit }: { ready: boolean; filters: object; currentId: string; mode: string; listLimit: number }) {
  const client = useRef<QuestionFeed | null>(null);
  const getClient = () => client.current ||= new QuestionFeed();
  const [selection, setSelection] = useState({ ids: [] as string[], summary: emptySummary, version: '' });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sync, setSync] = useState<'loading' | 'ok' | 'error'>('loading');
  const [loading, setLoading] = useState(true);
  const [querying, setQuerying] = useState(true);
  const [tick, setTick] = useState(0);
  const requestKey = JSON.stringify(filters);
  // Progress counts change metadata, not the displayed question selection.
  // 掌握进度只更新统计，不卸载正在作答的卡片。
  const { mastered: _mastered, ...contentFilters } = filters as Record<string, unknown>;
  const queryKey = JSON.stringify(contentFilters);
  const filterRef = useRef(filters); filterRef.current = filters;
  const querySerial = useRef(0), loadSerial = useRef(0);
  const lastCheck = useRef(0);
  const [activeKey, setActiveKey] = useState('');
  const refresh = useCallback(async (force = true) => {
    if(!force && Date.now()-lastCheck.current<15000)return;
    lastCheck.current=Date.now();
    try {
      const changed=await getClient().sync();
      if(changed || force)setTick(n=>n+1);
      setSync('ok');
    } catch { setSync('error'); }
  }, []);
  useEffect(()=>{
    if(!ready)return;
    const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh(false);},30000);
    const wake=()=>{if(document.visibilityState==='visible')void refresh(false);};
    window.addEventListener('focus',wake);document.addEventListener('visibilitychange',wake);
    return()=>{clearInterval(timer);window.removeEventListener('focus',wake);document.removeEventListener('visibilitychange',wake);};
  },[ready,refresh]);
  useEffect(()=>{
    if(!ready)return;
    let alive=true;
    const request=++querySerial.current;
    ++loadSerial.current;
    setQuerying(true);
    const timer=setTimeout(async()=>{
      try {
        const feed=getClient();
        await feed.ready;
        if(!feed.cursor)await feed.sync();
        const result=await feed.select(filterRef.current);
        if(!alive || request!==querySerial.current)return;
        setSelection(result);setActiveKey(queryKey);setQuerying(false);setSync('ok');
      } catch { if(alive){setSync('error');setQuerying(false);setLoading(false);} }
    },180);
    return()=>{alive=false;clearTimeout(timer);};
  },[ready,requestKey,tick]);
  const ids=activeKey===queryKey ? selection.ids : [];
  const index=Math.max(0,ids.indexOf(currentId));
  const wanted=useMemo(()=>mode==='list' ? ids.slice(0,listLimit) : ids.slice(Math.floor(index/20)*20,Math.floor(index/20)*20+20),[selection,activeKey,queryKey,mode,listLimit,index]);
  const wantedKey=JSON.stringify(wanted);
  useEffect(()=>{
    if(!ready || querying || activeKey!==queryKey)return;
    let alive=true;
    const request=++loadSerial.current;
    setLoading(true);
    if(!wanted.length){setQuestions([]);setLoading(false);return;}
    getClient().load(wanted).then(rows=>{
      if(!alive || request!==loadSerial.current)return;
      if(getClient().cursor!==selection.version){setTick(n=>n+1);return;}
      setQuestions(rows);setSync('ok');setLoading(false);
    }).catch(()=>{if(alive){setSync('error');setLoading(false);}});
    return()=>{alive=false;};
  },[ready,wantedKey,selection.version,querying,activeKey,queryKey]);
  const accept=useCallback(async(rows: Question[])=>{
    try{await getClient().accept(rows);setTick(n=>n+1);setSync('ok');}
    catch{setSync('error');}
  },[]);
  return { ids, index, summary:selection.summary, questions:activeKey===queryKey ? questions : [], loading:sync!=='error'&&(loading||querying||activeKey!==queryKey), sync, refresh, accept };
}
