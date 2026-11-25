/* ---------- trang bài viết ---------- */
const EM=["👍","❤️","😂","😮","😢","😡"],PAGE=10,MAXIMG=4;
const feed={posts:[],rx:[],cm:[],limit:PAGE,more:false,err:null,loaded:false,busy:false,openC:new Set(),reply:null,focus:null,ft:0,tag:null};
const uuid=()=>crypto.randomUUID?crypto.randomUUID():"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==="x"?r:r&3|8).toString(16)});
let pend=[],lb={l:[],i:0};
const imgUrl=p=>SB.storage.from("post-images").getPublicUrl(p).data.publicUrl;
const ini=n=>esc((n||"?").trim().charAt(0).toUpperCase());
function ago(s){const sec=Math.floor((Date.now()-new Date(s))/1000);
  if(sec<60)return"Vừa xong";if(sec<3600)return Math.floor(sec/60)+" phút trước";if(sec<86400)return Math.floor(sec/3600)+" giờ trước";if(sec<604800)return Math.floor(sec/86400)+" ngày trước";return dt(s);}
async function shrink(file){
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>no(new Error("Không đọc được ảnh này."));i.src=url;});
    const sc=Math.min(1,1280/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.max(1,Math.round(img.naturalWidth*sc)),h=Math.max(1,Math.round(img.naturalHeight*sc));
    const c=document.createElement("canvas");c.width=w;c.height=h;const g=c.getContext("2d");g.fillStyle="#fff";g.fillRect(0,0,w,h);g.drawImage(img,0,0,w,h);
    return await new Promise((ok,no)=>c.toBlob(b=>b?ok(b):no(new Error("Không nén được ảnh.")),"image/jpeg",.82));
  }finally{URL.revokeObjectURL(url)}
}
function openLb(l,i){if(!l.length)return;lb={l,i:i||0};showLb();$("lb").hidden=false;}
function showLb(){$("lbi").src=lb.l[lb.i];$("lbp").hidden=$("lbn").hidden=lb.l.length<2;}
document.addEventListener("keydown",e=>{const m=$("lb");if(!m||m.hidden||lb.l.length<2)return;
  if(e.key==="ArrowLeft"){lb.i=(lb.i+lb.l.length-1)%lb.l.length;showLb()}else if(e.key==="ArrowRight"){lb.i=(lb.i+1)%lb.l.length;showLb()}});

function postsView(){
  ctx={cell:()=>({cls:""})};
  $("body").innerHTML=`<div class="community-shell"><div class="community-hero"><span class="community-hero-icon" aria-hidden="true">✍️</span><div><h1>Bài viết</h1><p>Chia sẻ thông tin và kết nối với mọi người trong cộng đồng</p></div></div><div class="feedgrid community-layout"><div class="feedwrap"><div class="fcol">
   <div class="card composer"><div class="row" style="align-items:flex-start;flex-wrap:nowrap;gap:10px"><i class="av">${avInner(avUrl(),uname())}</i><textarea id="pbx" rows="2" maxlength="5000" placeholder="Bạn đang nghĩ gì?"></textarea></div>
    <div class="pimgs" id="ppv"></div>
    <div class="tpx" id="tpx"><span class="mut">Chủ đề:</span>${TOPICS.map(t=>`<button type="button" class="tg" data-ins="#${t.replace(/\s+/g,"-")} ">#${t}</button>`).join("")}</div><div class="tpx" id="tmn"></div>
    <div class="row" style="margin-top:10px"><label class="filebtn" for="pfi">🖼️ Thêm ảnh</label><input type="file" id="pfi" accept="image/*" multiple hidden><button type="button" id="pcode" title="Chèn mã nhóm của bạn vào bài viết">🔑 Chèn mã nhóm</button>${meta().phone?`<button type="button" id="pph" title="Chèn số điện thoại trong hồ sơ">📞 Chèn SĐT</button>`:""}<span class="mut" id="pcn"></span><span class="sp"></span><button class="p" id="pgo2">Đăng bài</button></div></div>
   <div id="plist"></div></div></div>${peopleCard()}</div></div>`;
  initPeople();
  const tx=$("pbx");tx.oninput=()=>{tx.style.height="auto";tx.style.height=Math.min(tx.scrollHeight+2,260)+"px"};
  $("pfi").onchange=async e=>{const fs=[...e.target.files];e.target.value="";
    for(const f of fs){if(pend.length>=MAXIMG){say("Tối đa "+MAXIMG+" ảnh mỗi bài.");break;}
      if(!/^image\//.test(f.type)){say("Chỉ chọn được file ảnh.");continue;}
      try{const b=await shrink(f);pend.push({blob:b,url:URL.createObjectURL(b)});renderPrev();}catch(er){say(er.message)}}};
  $("pgo2").onclick=submitPost;
  const ins=v=>{const x=$("pbx");x.value+=(x.value&&!/\s$/.test(x.value)?" ":"")+v;x.focus();x.oninput()};
  $("tpx").onclick=e=>{const b=e.target.closest("[data-ins]");if(b&&!$("pbx").value.includes(b.dataset.ins.trim()))ins(b.dataset.ins)};
  $("pcode").onclick=async()=>{const r=await SB.from("teams").select("name,code");if(r.error)return say("Lỗi: "+r.error.message);
    const L=r.data||[];if(!L.length)return say("Bạn chưa tham gia nhóm nào.");
    if(L.length===1)return ins("Mã nhóm: "+L[0].code+" ("+L[0].name+") ");
    $("tmn").innerHTML=L.map(t=>`<button type="button" class="tg" data-ins="Mã nhóm: ${esc(t.code)} (${esc(t.name)}) ">🔑 ${esc(t.name)} · ${esc(t.code)}</button>`).join("");
    $("tmn").onclick=e=>{const b=e.target.closest("[data-ins]");if(b){ins(b.dataset.ins);$("tmn").innerHTML=""}};};
  if($("pph"))$("pph").onclick=()=>ins("SĐT: "+meta().phone+" ");
  const pl=$("plist");pl.onclick=ev=>{const t=ev.target.closest("[data-tag]");if(t){feed.tag=t.dataset.tag||null;renderFeed();return;}
    const c=ev.target.closest("[data-copy]");if(c){copyText(c.dataset.copy);return;}feedClick(ev);};
  pl.onkeydown=e=>{const d=e.target.dataset&&e.target.dataset.draft;if(e.key==="Enter"&&!e.isComposing&&d){e.preventDefault();
    d[0]==="r"?sendComment(feed.reply&&feed.reply.pid,d.slice(2)):sendComment(d.slice(2),null);}};
  renderPrev();renderFeed();loadFeed();
}
function renderPrev(){const el=$("ppv");if(!el)return;
  el.innerHTML=pend.map((x,i)=>`<div class="pthumb"><img src="${x.url}" alt=""><button data-rm="${i}" title="Bỏ ảnh">×</button></div>`).join("");
  el.onclick=e=>{const b=e.target.closest("[data-rm]");if(!b)return;const[x]=pend.splice(+b.dataset.rm,1);URL.revokeObjectURL(x.url);renderPrev();};
  $("pcn").textContent=pend.length?pend.length+"/"+MAXIMG+" ảnh":"";}
async function submitPost(){
  const t=$("pbx").value.trim();if(!t&&!pend.length)return say("Hãy viết nội dung hoặc thêm ảnh.");
  const btn=$("pgo2");btn.disabled=true;btn.textContent="Đang đăng…";
  const up=[],bk=()=>{btn.disabled=false;btn.textContent="Đăng bài"};
  try{
    for(let i=0;i<pend.length;i++){
      const path=user.id+"/"+Date.now()+"_"+i+"_"+Math.random().toString(36).slice(2,8)+".jpg";
      const r=await SB.storage.from("post-images").upload(path,pend[i].blob,{contentType:"image/jpeg",cacheControl:"31536000"});
      if(r.error)throw new Error(/bucket|not found/i.test(r.error.message)?"Chưa tạo kho ảnh trên Supabase: hãy chạy đoạn SQL bài viết.":r.error.message);
      up.push(path);}
    const r=await SB.from("posts").insert({user_name:uname(),content:t,images:up}).select().single();
    if(r.error)throw r.error;
    pend.forEach(x=>URL.revokeObjectURL(x.url));pend=[];$("pbx").value="";$("pbx").style.height="auto";renderPrev();
    say("✓ Đã đăng bài");await loadFeed();
  }catch(e){if(up.length)SB.storage.from("post-images").remove(up);say("Lỗi: "+(e.message||e));}
  finally{bk()}
}
async function loadFeed(){
  if(!user||feed.busy)return;feed.busy=true;
  try{
    const n=feed.limit,r=await SB.from("posts").select("*").order("created_at",{ascending:false}).limit(n+1);
    if(r.error){feed.err=r.error.message;feed.posts=[];feed.rx=[];feed.cm=[];}
    else{feed.err=null;feed.more=r.data.length>n;feed.posts=r.data.slice(0,n);feed.rx=[];feed.cm=[];
      const ids=feed.posts.map(p=>p.id);
      if(ids.length){const[a,b]=await Promise.all([SB.from("post_reactions").select("*").in("post_id",ids),SB.from("post_comments").select("*").in("post_id",ids).order("created_at",{ascending:true})]);
        if(a.error||b.error)feed.err=(a.error||b.error).message;else{feed.rx=a.data||[];feed.cm=b.data||[];}}}
  }finally{feed.busy=false;feed.loaded=true;}
  if(feed.focus&&feed.more&&!feed.err&&!feed.posts.some(p=>p.id===feed.focus)&&feed.ft<5){feed.ft++;feed.limit+=PAGE;return loadFeed();}
  if(view==="posts")renderFeed();
}
function cmtHtml(c,p,isRep){
  const can=c.user_id===user.id||p.user_id===user.id;
  return `<div class="cmt"><i class="av">${ini(c.user_name)}</i><div class="cmc"><div class="cbub"><b>${esc(c.user_name)}</b>${c.user_id===p.user_id?`<span class="tag">Tác giả</span>`:""}<div class="ctx">${esc(c.content)}</div></div><div class="cmeta"><span title="${dt(c.created_at)}">${ago(c.created_at)}</span><button class="lk" data-a="rep" data-c="${c.id}">Trả lời</button>${can?`<button class="lk" data-a="dc" data-c="${c.id}">Xoá</button>`:""}</div></div></div>`;
}
function postHtml(p){
  const rx=feed.rx.filter(x=>x.post_id===p.id),cm=feed.cm.filter(x=>x.post_id===p.id),my=(rx.find(x=>x.user_id===user.id)||{}).emoji,imgs=p.images||[];
  const roots=cm.filter(c=>!c.parent_id),open=feed.openC.has(p.id),kids=id=>cm.filter(c=>c.parent_id===id);
  const bar=EM.map(e=>{const l=rx.filter(x=>x.emoji===e),n=l.length;return `<button class="rx ${my===e?"on":""}" data-a="rx" data-e="${e}" title="${esc(l.map(x=>x.user_name||"?").join(", "))}">${e}${n?" "+n:""}</button>`}).join("");
  const rbox=r=>feed.reply&&feed.reply.root===r?`<div class="cmt"><i class="av">${ini(uname())}</i><div class="cbox"><input data-draft="r:${r}" maxlength="1000" autocomplete="off" value="${esc(feed.reply.pre)}" placeholder="Trả lời ${esc(feed.reply.to)}…"><button class="p" data-a="send" data-r="${r}">Gửi</button><button data-a="cancel">Hủy</button></div></div>`:"";
  return `<article class="card post" data-p="${p.id}"><div class="phd"><i class="av">${ini(p.user_name)}</i><div class="sp"><b>${esc(p.user_name)}</b><div class="pmeta" title="${dt(p.created_at)}">${ago(p.created_at)}</div></div>${p.user_id===user.id?`<button class="pa dg" data-a="del" title="Xoá bài viết">🗑️ Xoá</button>`:""}</div>
   ${p.content?`<div class="pbody">${rich(p.content)}</div>${quick(p)}`:""}
   ${imgs.length?`<div class="pgrid g${Math.min(imgs.length,4)}">${imgs.map((x,i)=>`<img class="pim" loading="lazy" src="${esc(imgUrl(x))}" data-i="${i}" alt="">`).join("")}</div>`:""}
   <div class="row rxr">${bar}<span class="sp"></span><button class="pa" data-a="tgl">💬 ${cm.length} bình luận</button></div>
   ${open?`<div class="cms">${roots.map(c=>cmtHtml(c,p)+`<div class="reps">${kids(c.id).map(r=>cmtHtml(r,p)).join("")}${rbox(c.id)}</div>`).join("")}<div class="cbox"><input data-draft="c:${p.id}" maxlength="1000" autocomplete="off" placeholder="Viết bình luận…"><button class="p" data-a="send">Gửi</button></div></div>`:""}</article>`;
}
function renderFeed(){
  const el=$("plist");if(!el)return;
  const fp=feed.tag?feed.posts.filter(p=>tagsOf(p).includes(feed.tag)):feed.posts;const dr={},ae=document.activeElement,af=ae&&ae.dataset&&ae.dataset.draft;
  el.querySelectorAll("[data-draft]").forEach(i=>{dr[i.dataset.draft]=i.value});
  el.innerHTML=feed.err?`<div class="card mut">⚠️ Chưa dùng được bài viết: ${esc(feed.err)}.<br>Hãy chạy đoạn SQL bài viết trong Supabase → SQL Editor.</div>`
   :!feed.loaded?`<div class="card mut">Đang tải…</div>`
   :!feed.posts.length?`<div class="card mut" style="text-align:center">Chưa có bài viết nào. Hãy là người đăng bài đầu tiên ✍️</div>`
   :tagBar()+(fp.length?fp.map(postHtml).join(""):"<div class='card mut' style='text-align:center'>Không có bài viết nào với chủ đề này.</div>")+(feed.more?`<button data-a="more">Xem thêm bài viết</button>`:"");
  for(const k in dr){const i=el.querySelector('[data-draft="'+k+'"]');if(i&&dr[k])i.value=dr[k];}
  if(af){const i=el.querySelector('[data-draft="'+af+'"]');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length);}}
  if(feed.focus&&feed.loaded){const a=el.querySelector('[data-p="'+feed.focus+'"]');
    if(a){a.scrollIntoView({block:"center"});a.classList.add("flash");feed.focus=null;}
    else if(!feed.more){feed.focus=null;say("Bài viết này không còn tồn tại.");}}
}
function feedClick(ev){
  const im=ev.target.closest("img.pim");
  if(im){const c=im.closest("[data-p]"),p=feed.posts.find(x=>x.id===c.dataset.p);if(p)openLb((p.images||[]).map(imgUrl),+im.dataset.i);return;}
  const b=ev.target.closest("[data-a]");if(!b)return;
  const c=b.closest("[data-p]"),pid=c&&c.dataset.p,a=b.dataset.a;
  if(a==="more"){feed.limit+=PAGE;loadFeed();}
  else if(a==="rx")toggleRx(pid,b.dataset.e);
  else if(a==="tgl"){feed.openC.has(pid)?feed.openC.delete(pid):feed.openC.add(pid);renderFeed();}
  else if(a==="del")deletePost(pid);
  else if(a==="rep"){const cm=feed.cm.find(x=>x.id===b.dataset.c);if(!cm)return;
    feed.reply={pid,root:cm.parent_id||cm.id,to:cm.user_name,uid:cm.user_id,pre:cm.parent_id?"@"+cm.user_name+" ":""};renderFeed();
    const i=document.querySelector('#plist [data-draft="r:'+feed.reply.root+'"]');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length);}}
  else if(a==="cancel"){feed.reply=null;renderFeed();}
  else if(a==="send")sendComment(pid,b.dataset.r||null);
  else if(a==="dc")deleteComment(b.dataset.c);
}
async function toggleRx(pid,e){
  const m=feed.rx.find(x=>x.post_id===pid&&x.user_id===user.id);let r;
  if(m&&m.emoji===e){feed.rx=feed.rx.filter(x=>x!==m);renderFeed();r=await SB.from("post_reactions").delete().eq("post_id",pid).eq("user_id",user.id);}
  else{if(m)m.emoji=e;else feed.rx.push({post_id:pid,user_id:user.id,emoji:e,user_name:uname()});renderFeed();
    r=await SB.from("post_reactions").upsert({post_id:pid,user_id:user.id,emoji:e,user_name:uname()},{onConflict:"post_id,user_id"});}
  if(r.error){say("Lỗi: "+r.error.message);await loadFeed();}
}
async function sendComment(pid,root){
  if(!pid)return;
  const key=root?"r:"+root:"c:"+pid,inp=document.querySelector('#plist [data-draft="'+key+'"]'),t=inp&&inp.value.trim();if(!t)return;
  inp.disabled=true;
  const row={id:uuid(),post_id:pid,parent_id:root||null,user_id:user.id,user_name:uname(),content:t};
  if(root&&feed.reply&&feed.reply.uid)row.reply_to=feed.reply.uid;
  let r=await SB.from("post_comments").insert(row);
  if(r.error&&/reply_to/i.test(r.error.message)){delete row.reply_to;r=await SB.from("post_comments").insert(row);}
  if(r.error){inp.disabled=false;return say("Lỗi: "+r.error.message);}
  feed.cm.push({...row,created_at:new Date().toISOString()});inp.value="";if(root)feed.reply=null;feed.openC.add(pid);renderFeed();
  if(!root){const n=document.querySelector('#plist [data-draft="c:'+pid+'"]');if(n)n.focus();}
}
async function deleteComment(cid){
  if(!confirm("Xoá bình luận này (kèm các phản hồi của nó)?"))return;
  const r=await SB.from("post_comments").delete().eq("id",cid);if(r.error)return say("Lỗi: "+r.error.message);
  feed.cm=feed.cm.filter(x=>x.id!==cid&&x.parent_id!==cid);if(feed.reply&&feed.reply.root===cid)feed.reply=null;renderFeed();
}
async function deletePost(pid){
  const p=feed.posts.find(x=>x.id===pid);if(!p||!confirm("Xoá bài viết này? Bình luận và cảm xúc của bài cũng sẽ bị xoá."))return;
  const r=await SB.from("posts").delete().eq("id",pid);if(r.error)return say("Lỗi: "+r.error.message);
  if((p.images||[]).length)SB.storage.from("post-images").remove(p.images);
  feed.posts=feed.posts.filter(x=>x.id!==pid);feed.rx=feed.rx.filter(x=>x.post_id!==pid);feed.cm=feed.cm.filter(x=>x.post_id!==pid);renderFeed();say("✓ Đã xoá bài viết");
}
setInterval(()=>{if(!user||view!=="posts"||feed.busy)return;
  if([...document.querySelectorAll("#plist [data-draft]")].some(i=>i.value.trim()))return;loadFeed();},20000);

/* ---------- chủ đề · sao chép mã nhóm · gọi nhanh ---------- */
const TOPICS=["Thông báo","Họp","Học tập","Công việc","Chia sẻ","Hỏi đáp"];
const TAGRE=/(?:^|\s)#[\p{L}\p{N}_-]+/gu,PH=/(?:\+?84|0)(?:[\s.-]?\d){8,10}/g,CD=/m[ãa]\s*(?:nhóm|nhom)?\s*[:：]?\s*([A-Za-z0-9]{6})\b/i;
const tagsOf=p=>[...new Set(((p.content||"").match(TAGRE)||[]).map(x=>x.trim().slice(1)))];
const rich=t=>esc(t).replace(/(^|\s)#([\p{L}\p{N}_-]+)/gu,'$1<button class="htag" data-tag="$2">#$2</button>');
function tagBar(){const c={};feed.posts.forEach(p=>tagsOf(p).forEach(t=>c[t]=(c[t]||0)+1));const ks=Object.keys(c).sort((a,b)=>c[b]-c[a]);
  if(!ks.length)return"<div class='mut' style='margin:0 2px 10px;font-size:13px'>💡 Thêm #chủ-đề vào bài viết để mọi người lọc theo chủ đề.</div>";
  return"<div class='tfb'><span class='mut'>Lọc:</span><button class='tg "+(!feed.tag?"on":"")+"' data-tag=''>Tất cả ("+feed.posts.length+")</button>"+ks.map(t=>"<button class='tg "+(feed.tag===t?"on":"")+"' data-tag='"+esc(t)+"'>#"+esc(t)+" ("+c[t]+")</button>").join("")+"</div>";}
function quick(p){const t=p.content||"",out=[],seen=new Set();
  (t.match(PH)||[]).forEach(x=>{const n=x.replace(/[^\d+]/g,"");if(n.length>=9&&!seen.has(n)&&seen.size<2){seen.add(n);out.push(`<a class="btn qa" href="tel:${n}">📞 Gọi ${esc(x.trim())}</a>`)}});
  const c=t.match(CD);if(c){const code=c[1].toUpperCase();out.push(`<button class="qa" data-copy="${esc(code)}">📋 Sao chép mã ${esc(code)}</button>`);}
  return out.length?`<div class="row qrow">${out.join("")}</div>`:"";}
function copyText(t){const ok=()=>say("✓ Đã sao chép: "+t.slice(0,40));
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(ok,()=>say("Không sao chép được."));
  else{const a=document.createElement("textarea");a.value=t;document.body.appendChild(a);a.select();try{document.execCommand("copy");ok()}catch(e){say("Không sao chép được.")}a.remove()}}
