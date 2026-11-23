/* ===================================================================
   Cột "Trò chuyện" ở trang Bài viết: danh sách người dùng + đang hoạt động,
   chat riêng 1-1 và chat nhóm. Cần chạy migrate_v4.sql.
   =================================================================== */
const ONLINE_MS=150000;
let ppl={users:[],teams:[],unread:{},q:"",chat:null,msgs:[],err:null,loaded:false};
const pOnline=u=>!!u.last_seen&&Date.now()-new Date(u.last_seen).getTime()<ONLINE_MS;
const peopleCard=()=>`<aside class="card side people" id="ppl"></aside>`;
async function beat(){if(!user||!SB)return;try{await SB.from("profiles").upsert({user_id:user.id,name:uname(),avatar_url:avUrl()||null,last_seen:new Date().toISOString()},{onConflict:"user_id"});}catch(e){}}
function paintBadge(){const n=Object.values(ppl.unread).reduce((a,b)=>a+b,0),tp=$("tp");if(tp)tp.innerHTML="📰 Bài viết"+(n?` <i class="ubadge">${n>9?"9+":n}</i>`:"");}
async function pollUnread(){if(!user||!SB)return;
  const r=await SB.from("direct_messages").select("sender").eq("recipient",user.id).is("read_at",null).limit(500);if(r.error)return;
  const u={};(r.data||[]).forEach(x=>u[x.sender]=(u[x.sender]||0)+1);ppl.unread=u;paintBadge();
  if(view==="posts"&&!ppl.chat)renderPList();}
setInterval(()=>{if(user&&document.visibilityState==="visible")beat();},60000);
setInterval(()=>{if(user)pollUnread();},20000);
setInterval(()=>{if(user&&view==="posts"&&ppl.chat)pollChatP();},3000);
setInterval(()=>{if(user&&view==="posts"&&!ppl.chat&&document.visibilityState==="visible")loadPeople();},20000);
document.addEventListener("visibilitychange",()=>{if(user&&document.visibilityState==="visible")beat();});

function initPeople(){ppl.chat=null;paintPeople();loadPeople();pollUnread();}
async function loadPeople(){
  const[u,t]=await Promise.all([SB.from("profiles").select("user_id,name,avatar_url,last_seen").order("name").limit(500),SB.from("teams").select("id,name").order("created_at")]);
  ppl.err=u.error?u.error.message:null;ppl.users=(u.data||[]).filter(x=>x.user_id!==user.id);ppl.teams=t.data||[];ppl.loaded=true;
  if(view==="posts"&&$("ppl")&&!ppl.chat)renderPList();}
function paintPeople(){const el=$("ppl");if(!el)return;ppl.chat?paintChat(el):paintList(el);}
function paintList(el){
  el.innerHTML=`<div class="row"><h2 style="margin:0">💬 Trò chuyện</h2><span class="sp"></span><span class="mut" id="pon"></span></div>
   <input id="pq" placeholder="Tìm người dùng hoặc nhóm…" value="${esc(ppl.q)}" autocomplete="off"><div class="plist" id="pll"></div>`;
  $("pq").oninput=e=>{ppl.q=e.target.value;renderPList();};
  $("pll").onclick=ev=>{
    const u=ev.target.closest("[data-u]");if(u){const x=ppl.users.find(z=>z.user_id===u.dataset.u);if(x)openChat({kind:"dm",id:x.user_id,name:x.name,avatar:x.avatar_url,online:pOnline(x)});return;}
    const g=ev.target.closest("[data-g]");if(g){const x=ppl.teams.find(z=>z.id===g.dataset.g);if(x)openChat({kind:"team",id:x.id,name:x.name});}};
  renderPList();}
function renderPList(){const el=$("pll");if(!el)return;
  if(ppl.err){el.innerHTML=`<div class="mut" style="padding:8px">⚠️ ${esc(dbErr({message:ppl.err}))}<br>Hãy chạy file <b>migrate_v4.sql</b> trong Supabase → SQL Editor.</div>`;return;}
  if(!ppl.loaded){el.innerHTML="<div class='mut' style='padding:8px'>Đang tải…</div>";return;}
  const q=ppl.q.trim().toLowerCase(),f=n=>!q||(n||"").toLowerCase().includes(q);
  const us=ppl.users.filter(u=>f(u.name)),on=us.filter(pOnline),off=us.filter(u=>!pOnline(u)),ts=ppl.teams.filter(t=>f(t.name));
  const badge=n=>n?`<i class="ubadge">${n>9?"9+":n}</i>`:"";
  const row=u=>`<div class="prow" data-u="${u.user_id}"><span class="pw"><i class="av">${avInner(u.avatar_url,u.name)}</i><i class="odot ${pOnline(u)?"on":""}"></i></span><span class="mn">${esc(u.name||"Người dùng")}</span>${badge(ppl.unread[u.user_id])}</div>`;
  const nOn=ppl.users.filter(pOnline).length;if($("pon"))$("pon").textContent="🟢 "+nOn+" đang hoạt động";
  el.innerHTML=(ts.length?`<div class="psec">Nhóm của tôi</div>`+ts.map(t=>`<div class="prow" data-g="${t.id}"><span class="pw"><i class="av">👥</i></span><span class="mn">${esc(t.name)}</span><small class="mut">chat nhóm</small></div>`).join(""):"")
   +`<div class="psec">Đang hoạt động (${on.length})</div>`+(on.length?on.map(row).join(""):"<div class='mut' style='padding:4px 8px'>Chưa có ai đang hoạt động.</div>")
   +`<div class="psec">Ngoại tuyến (${off.length})</div>`+(off.length?off.slice(0,150).map(row).join(""):"<div class='mut' style='padding:4px 8px'>—</div>");}
function paintChat(el){const c=ppl.chat;
  el.innerHTML=`<div class="row" style="flex-wrap:nowrap"><button class="pa" id="pback" type="button" title="Quay lại danh sách">←</button>
   <span class="pw">${c.kind==="dm"?`<i class="av">${avInner(c.avatar,c.name)}</i><i class="odot ${c.online?"on":""}"></i>`:`<i class="av">👥</i>`}</span>
   <div class="sp" style="min-width:0"><b class="mn" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name||"Người dùng")}</b><span class="mut" style="font-size:12px">${c.kind==="team"?"Chat nhóm · mọi thành viên cùng thấy":c.online?"🟢 Đang hoạt động":"Ngoại tuyến"}</span></div></div>
   <div class="cl" id="pcl"></div><div class="row cin"><input id="pci" class="sp" maxlength="500" placeholder="Nhập tin nhắn…" autocomplete="off"><button class="p" id="pcs" type="button">Gửi</button></div>`;
  $("pback").onclick=()=>{ppl.chat=null;paintPeople();loadPeople();};
  $("pcs").onclick=sendP;$("pci").onkeydown=e=>{if(e.key==="Enter"&&!e.isComposing){e.preventDefault();sendP();}};}
async function fetchChat(since){
  const c=ppl.chat,me=user.id;let q;
  if(c.kind==="dm")q=SB.from("direct_messages").select("*").or("and(sender.eq."+me+",recipient.eq."+c.id+"),and(sender.eq."+c.id+",recipient.eq."+me+")");
  else q=SB.from("team_messages").select("*").eq("team_id",c.id);
  q=since?q.gte("created_at",since).order("created_at",{ascending:true}):q.order("created_at",{ascending:false});
  const r=await q.limit(200);if(r.error){ppl.err=r.error.message;return null;}
  const rows=since?(r.data||[]):(r.data||[]).slice().reverse();
  return rows.map(m=>c.kind==="dm"?{id:m.id,uid:m.sender,name:m.sender_name,content:m.content,at:m.created_at}:{id:m.id,uid:m.user_id,name:m.user_name,content:m.content,at:m.created_at});}
async function openChat(c){
  ppl.chat=c;ppl.msgs=[];ppl.err=null;paintPeople();$("pcl").innerHTML="<div class='mut' style='padding:8px'>Đang tải…</div>";
  const rows=await fetchChat();if(ppl.chat!==c)return;
  if(rows===null){$("pcl").innerHTML=`<div class="mut" style="padding:8px">⚠️ ${esc(dbErr({message:ppl.err}))}</div>`;return;}
  ppl.msgs=rows;renderMsgs(true);if(c.kind==="dm")markRead();if($("pci"))$("pci").focus();}
async function markRead(){const c=ppl.chat;if(!c||c.kind!=="dm")return;
  delete ppl.unread[c.id];paintBadge();
  await SB.from("direct_messages").update({read_at:new Date().toISOString()}).eq("recipient",user.id).eq("sender",c.id).is("read_at",null);}
async function pollChatP(){
  const c=ppl.chat;if(!c)return;const last=ppl.msgs.length?ppl.msgs[ppl.msgs.length-1].at:null;
  const rows=await fetchChat(last);if(!rows||ppl.chat!==c)return;
  const seen=new Set(ppl.msgs.map(m=>m.id)),add=rows.filter(m=>!seen.has(m.id));if(!add.length)return;
  ppl.msgs=ppl.msgs.concat(add).slice(-300);renderMsgs();
  if(c.kind==="dm"&&add.some(m=>m.uid!==user.id))markRead();}
function renderMsgs(stick){const el=$("pcl");if(!el)return;const c=ppl.chat,near=el.scrollHeight-el.scrollTop-el.clientHeight<60;
  let day="",h="";
  ppl.msgs.forEach(m=>{const d=new Date(m.at),dl=dayLabel(d),mine=m.uid===user.id;
    if(dl!==day){day=dl;h+=`<div class="cday">${esc(dl)}</div>`;}
    h+=`<div class="cm ${mine?"me":""}"><div class="ch">${c.kind==="team"?`<b>${m.uid===(ppl.teams.find(t=>t.id===c.id)||{}).owner?"👑 ":""}${mine?"Bạn":esc(m.name)}</b> · `:""}<span title="${dmy(d)} ${hm(d)}">${hm(d)}</span></div><div class="cb">${esc(m.content)}</div></div>`;});
  el.innerHTML=h||"<div class='mut' style='text-align:center;padding:12px'>Chưa có tin nhắn nào. Hãy gửi lời chào 👋</div>";
  if(stick===true||near)el.scrollTop=el.scrollHeight;}
async function sendP(){
  const c=ppl.chat,i=$("pci");if(!c||!i)return;const t=i.value.trim();if(!t)return;i.value="";
  const r=c.kind==="dm"?await SB.from("direct_messages").insert({sender:user.id,recipient:c.id,sender_name:uname(),content:t}).select().single()
    :await SB.from("team_messages").insert({team_id:c.id,user_id:user.id,user_name:uname(),content:t}).select().single();
  if(r.error){i.value=t;return say("Lỗi gửi tin: "+dbErr(r.error));}
  const m=r.data;if(ppl.chat===c&&!ppl.msgs.find(x=>x.id===m.id)){ppl.msgs.push(c.kind==="dm"?{id:m.id,uid:m.sender,name:m.sender_name,content:m.content,at:m.created_at}:{id:m.id,uid:m.user_id,name:m.user_name,content:m.content,at:m.created_at});renderMsgs(true);}
  if($("pci"))$("pci").focus();}
