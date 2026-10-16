// Bounded local cache plus a persistent change cursor. / 有界缓存与持久增量游标。
const DB_NAME = 'study-room-question-cache:v1';
const CACHE_LIMIT = 240;

export function browserCache() {
  const open = () => new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('cache');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return {
    async read() {
      const db = await open();
      try { return await new Promise((resolve,reject) => { const req=db.transaction('cache').objectStore('cache').get('state');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error); }); }
      finally { db.close(); }
    },
    async write(value) {
      const db = await open();
      try { await new Promise((resolve,reject)=>{const tx=db.transaction('cache','readwrite');tx.objectStore('cache').put(value,'state');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);}); }
      finally { db.close(); }
    }
  };
}

export class QuestionFeed {
  constructor(request = fetch, storage = browserCache()) {
    this.request=(url,options)=>request(url,options);this.storage=storage;this.cache=new Map();this.cursor=null;
    this.pending=null;this.queue=Promise.resolve();this.writeQueue=Promise.resolve();
    this.ready=this.restore();
  }
  async restore() {
    try { const state=await this.storage.read();
      if(state?.schema===1 && typeof state.cursor==='string' && Array.isArray(state.rows)){
        this.cursor=state.cursor;
        for(const q of state.rows.slice(-CACHE_LIMIT))if(q && typeof q.id==='string' && typeof q.stem==='string' && Array.isArray(q.options))this.cache.set(q.id,q);
      }
    } catch {}
  }
  persist() {
    const state={schema:1,cursor:this.cursor,rows:[...this.cache.values()].slice(-CACHE_LIMIT)};
    this.writeQueue=this.writeQueue.catch(()=>{}).then(()=>this.storage.write(state)).catch(()=>{});
    return this.writeQueue;
  }
  async json(url, body) {
    const response=await this.request(url, body === undefined ? {cache:'no-store'} : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
    if(response.status===204)return null;
    if(!response.ok)throw new Error('题库暂时连接不上，请重试。');
    return response.json();
  }
  // Serialize sync/query/batch so a late response cannot resurrect invalidated content.
  // 串行处理，避免旧响应覆盖更新后的缓存；快速切换由界面请求编号隔离。
  run(work) {
    const result=this.queue.catch(()=>{}).then(async()=>{await this.ready;return work();});
    this.queue=result;return result;
  }
  sync() {
    if(this.pending)return this.pending;
    this.pending=this.run(()=>this.syncNow()).finally(()=>{this.pending=null;});
    return this.pending;
  }
  async syncNow() {
    let changed=false;
    do {
      const value=await this.json('/api/study/sync'+(this.cursor?'?cursor='+encodeURIComponent(this.cursor):''));
      if(!value)break;
      if(value.reset)this.cache.clear();
      else for(const id of value.changed)this.cache.delete(id);
      this.cursor=value.cursor;changed=true;
      if(!value.hasMore)break;
    } while(true);
    if(changed)await this.persist();
    return changed;
  }
  select(filters) {
    return this.run(async()=>{
      for(let attempt=0;attempt<4;attempt++){
        const result=await this.json('/api/study/query',filters);
        if(result.version===this.cursor)return result;
        await this.syncNow();
      }
      throw new Error('题库正在更新，请重试。');
    });
  }
  load(ids) {
    return this.run(async()=>{
      const absent=new Set();let fetched=false,retries=0;
      while(true){
        const chunk=[...new Set(ids)].filter(id=>!this.cache.has(id)&&!absent.has(id)).slice(0,20);
        if(!chunk.length)break;
        const data=await this.json('/api/study/batch',{ids:chunk});
        if(data.version!==this.cursor){
          if(++retries>4)throw new Error('题库正在更新，请重试。');
          await this.syncNow();
          absent.clear();continue;
        }
        for(const q of data.questions)this.cache.set(q.id,q);
        for(const id of data.missing)absent.add(id);
        fetched=true;
      }
      const result=ids.map(id=>this.cache.get(id)).filter(Boolean);
      for(const q of result){this.cache.delete(q.id);this.cache.set(q.id,q);}
      while(this.cache.size>Math.max(CACHE_LIMIT,result.length))this.cache.delete(this.cache.keys().next().value);
      if(fetched)await this.persist();
      return result;
    });
  }
  accept(questions) {
    return this.run(async()=>{
      await this.syncNow();
      // Fetch after syncing instead of storing a possibly superseded save response.
      // 保存响应之后可能又有新版本，按最新版本重新获取这些题目。
      for(const q of questions)this.cache.delete(q.id);
      await this.persist();
    });
  }
}
