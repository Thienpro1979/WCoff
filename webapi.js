// Cầu nối dữ liệu cho bản web/iPhone: thay thế phần Python (pywebview) bằng fetch trong trình duyệt.
// Thử gọi trực tiếp nguồn dữ liệu; nếu bị chặn (CORS) thì đi qua Cloudflare Worker (cài đặt ⚙).
(function(){
 if(window.pywebview&&window.pywebview.api)return;
 const H={dchart:'https://dchart-api.vndirect.com.vn/dchart/history',vps:'https://histdatafeed.vps.com.vn/tradingview/history',
  quote:'https://bgapidatafeed.vps.com.vn/getliststockdata/',finfo:['https://api-finfo.vndirect.com.vn/v4/stocks','https://finfo-api.vndirect.com.vn/v4/stocks']};
 const TFS={'1':6,'5':25,'15':50,'30':90,'60':200,'D':1500,'W':3800,'M':7600},MINB={M:12,W:30};
 const proxy=()=>(localStorage.getItem('wy_proxy')||'').trim().replace(/\/$/,'');
 let mode=localStorage.getItem('wy_mode')||'direct';           // direct | proxy
 async function getJson(url,ms){
  const one=async u=>{const c=new AbortController(),t=setTimeout(()=>c.abort(),ms||15000);try{const r=await fetch(u,{signal:c.signal});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(t)}};
  const px=proxy(),via=()=>one(px+'/?u='+encodeURIComponent(url));
  if(mode==='proxy'&&px)return via();
  try{return await one(url)}catch(e){
   if(!px)throw new Error('Trình duyệt bị chặn truy cập nguồn dữ liệu (CORS). Hãy vào ⚙ Cài đặt và nhập địa chỉ Cloudflare Worker.');
   const j=await via();mode='proxy';try{localStorage.setItem('wy_mode','proxy')}catch(_){}return j}}
 const udf=j=>{if(j.s!=='ok'||!j.t||!j.t.length)throw new Error('không có dữ liệu');return j.t.map((t,i)=>[t,j.o[i],j.h[i],j.l[i],j.c[i],j.v[i]])};
 const clean=rows=>{const m=new Map();rows.forEach(r=>m.set(Math.floor(r[0]),r));return[...m.values()].sort((a,b)=>a[0]-b[0]).filter(r=>r.every(x=>x!=null)&&r[4]>0)};
 const gapOk=(rows,tf)=>{if((tf!=='W'&&tf!=='M')||rows.length<3)return true;const g=[];for(let i=0;i<rows.length-1;i++)g.push(rows[i+1][0]-rows[i][0]);g.sort((a,b)=>a-b);return g[g.length>>1]>=(tf==='W'?5:25)*86400};
 const srcs=[['VNDirect',(s,a,b,tf)=>getJson(H.dchart+'?resolution='+tf+'&symbol='+s+'&from='+a+'&to='+b).then(udf)],
             ['VPS',(s,a,b,tf)=>getJson(H.vps+'?symbol='+s+'&resolution='+tf+'&from='+a+'&to='+b).then(udf)]];
 const RES={W:['W','1W'],M:['M','1M']};
 async function fetchRows(sym,a,b,tf,errs,minb){
  for(const [n,f] of srcs)for(const r of (RES[tf]||[tf])){
   try{const rows=clean(await f(sym,a,b,r));if(rows.length<minb)throw new Error('chỉ có '+rows.length+' nến');if(!gapOk(rows,tf))throw new Error('sai khung');return[n,rows]}catch(e){errs.push(n+': '+(e.message||e))}}
  return[null,null]}
 function aggregate(rows,tf){const B=new Map();
  for(const r of rows){const d=new Date((r[0]+7*3600)*1000);let key;
   if(tf==='M')key=d.getUTCFullYear()*100+d.getUTCMonth();
   else{const t=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));const dn=(t.getUTCDay()+6)%7;t.setUTCDate(t.getUTCDate()-dn+3);const y=t.getUTCFullYear(),f=new Date(Date.UTC(y,0,4));key=y*100+1+Math.round(((t-f)/864e5-3+((f.getUTCDay()+6)%7))/7)}
   const b=B.get(key);if(!b)B.set(key,[r[0],r[1],r[2],r[3],r[4],r[5]||0]);else{b[2]=Math.max(b[2],r[2]);b[3]=Math.min(b[3],r[3]);b[4]=r[4];b[5]+=r[5]||0}}
  return[...B.values()]}
 const pack=(name,rows,tf)=>{const med=rows.map(r=>r[4]).sort((a,b)=>a-b)[rows.length>>1],k=med>1000?1000:1;
  return JSON.stringify({s:'ok',src:name,tf,t:rows.map(r=>Math.floor(r[0])),o:rows.map(r=>r[1]/k),h:rows.map(r=>r[2]/k),l:rows.map(r=>r[3]/k),c:rows.map(r=>r[4]/k),v:rows.map(r=>r[5])})};
 const okSym=s=>/^[A-Z0-9]{2,10}$/.test(s);
 const api={
  async history(sym,tf){sym=(sym||'').trim().toUpperCase();tf=TFS[tf]?tf:'D';if(!okSym(sym))return JSON.stringify({s:'error',err:'Mã không hợp lệ'});
   const t1=Math.floor(Date.now()/1000)+86400,errs=[];let[n,rows]=await fetchRows(sym,t1-86400*TFS[tf],t1,tf,errs,MINB[tf]||80);
   if(!rows&&(tf==='W'||tf==='M')){const[n2,d]=await fetchRows(sym,t1-86400*7600,t1,'D',errs,80);if(d){rows=aggregate(d,tf);n=n2+'+gộp';if(rows.length<MINB[tf]){rows=null}}}
   return rows?pack(n,rows,tf):JSON.stringify({s:'error',err:errs.slice(-6).join(' | ')})},
  async history_scan(sym){sym=(sym||'').trim().toUpperCase();if(!okSym(sym))return JSON.stringify({s:'error'});
   const t1=Math.floor(Date.now()/1000)+86400,errs=[],[n,rows]=await fetchRows(sym,t1-86400*900,t1,'D',errs,120);return rows?pack(n,rows,'D'):JSON.stringify({s:'error',err:'không có dữ liệu'})},
  async symbols(floor){const fl={HOSE:'HOSE',HNX:'HNX',UPCOM:'UPCOM'}[floor]||'HOSE,HNX,UPCOM',errs=[];
   for(const u of H.finfo){try{const j=await getJson(u+'?q=type:STOCK,IFC~status:LISTED~floor:'+fl+'&fields=code,floor&size=3000',20000);
     const out=[...new Set((j.data||[]).map(b=>b.code).filter(c=>/^[A-Z0-9]{3}$/.test(c||'')))].sort();if(out.length)return JSON.stringify({s:'ok',list:out});errs.push('danh sách rỗng')}catch(e){errs.push(e.message||String(e))}}
   return JSON.stringify({s:'error',err:errs.join(' | ')})},
  async quote(sym){sym=(sym||'').trim().toUpperCase();if(!okSym(sym))return JSON.stringify({s:'error'});
   try{const j=await getJson(H.quote+sym,8000),r=Array.isArray(j)?j[0]:j,num=(...ks)=>{for(const k of ks){const v=parseFloat(String(r[k]).replace(/,/g,''));if(v>0)return v}return 0};
    const p=num('lastPrice','last','c');if(p<=0)return JSON.stringify({s:'na'});return JSON.stringify({s:'ok',p,h:num('highPrice','hi','h'),l:num('lowPrice','lo','l'),o:num('openPrice','open','o')})}catch(e){return JSON.stringify({s:'error',err:String(e.message||e)})}},
  async save_png(dataurl,sym){const a=document.createElement('a');a.href=dataurl;a.download='Wyckoff_'+(sym||'CP')+'.png';document.body.appendChild(a);a.click();a.remove();return 'tải xuống (xem trong Tệp/Ảnh)'},
  async open_external(u){window.open(u,'_blank')}};
 window.pywebview={api};
})();
