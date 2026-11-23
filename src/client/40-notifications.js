/* ---------- chuông thông báo ---------- */
let notifs=[],nf="all",nSeen=null,nCh=null,nUser=null,nErr=null,pendTview=null;
const NIC={post_new:"📰",reaction:"😀",comment:"💬",reply:"↩️",join:"👋",leave:"🚪",poll_new:"🗳️",poll_closed:"🔒",chat:"💬",team_deleted:"🗑️"};
async function loadNotifs(){
  if(!user)return;
  const r=await SB.from("notifications").select("*").order("created_at",{ascending:false}).limit(60);
  if(r.error){nErr=r.error.message;notifs=[];renderBell();return;}
  nErr=null;const list=r.data||[];
  // đang mở đúng nhóm thì tin nhắn chat coi như đã đọc
  const auto=list.filter(n=>!n.read&&n.type==="chat"&&view==="team"&&team&&team.id===n.team_id&&document.visibilityState==="visible").map(n=>n.id);
  if(auto.length){list.forEach(n=>{if(auto.includes(n.id))n.read=true});SB.from("notifications").update({read:true}).in("id",auto).then(()=>{});}
  if(nSeen&&$("npn").hidden){const fresh=list.filter(n=>!n.read&&nSeen.get(n.id)!==n.created_at);
    if(fresh.length)say("🔔 "+fresh[0].body+(fresh.length>1?" (+"+(fresh.length-1)+" thông báo khác)":""));}
  nSeen=new Map(list.map(n=>[n.id,n.created_at]));
  notifs=list;renderBell();
}
function renderBell(){
  const b=$("bdg"),un=notifs.filter(n=>!n.read).length;
  if(b){b.hidden=!un;b.textContent=un>9?"9+":un;}
  document.title=(un?"("+(un>9?"9+":un)+") ":"")+"Timesheet";
  renderPanel();
}
function renderPanel(){
  const el=$("npn");if(!el||el.hidden)return;
  const un=c=>notifs.filter(n=>!n.read&&(c==="all"||n.cat===c)).length,tab=(k,t)=>`<button data-nf="${k}" class="${nf===k?"on":""}">${t}${un(k)?" ("+un(k)+")":""}</button>`;
  const list=notifs.filter(n=>nf==="all"||n.cat===nf);
  el.innerHTML=`<div class="nph"><b>🔔 Thông báo</b><span class="sp"></span><button class="pa" data-na="read" ${un("all")?"":"disabled"}>Đã đọc tất cả</button><button class="pa" data-na="clear" ${notifs.length?"":"disabled"}>Xoá tất cả</button></div>
   <div class="seg nfs">${tab("all","Tất cả")}${tab("team","Nhóm")}${tab("post","Bài viết")}</div>
   <div class="npl">${nErr?`<div class="mut" style="padding:14px">⚠️ Chưa dùng được thông báo: ${esc(nErr)}.<br>Hãy chạy đoạn SQL thông báo trong Supabase → SQL Editor.</div>`
   :list.length?list.map(n=>`<div class="nit ${n.read?"":"un"}" data-n="${n.id}"><span class="nic">${NIC[n.type]||"🔔"}</span><div class="nbody"><div class="nbd">${esc(n.body)}${n.cnt>1?" ("+n.cnt+" tin)":""}</div>${n.extra?`<div class="nex">${esc(n.extra)}</div>`:""}<div class="nmt" title="${dt(n.created_at)}">${ago(n.created_at)} · ${n.cat==="team"?"Nhóm":"Bài viết"}</div></div>${n.read?"":`<i class="ndot"></i>`}</div>`).join("")
   :`<div class="mut" style="padding:18px;text-align:center">Chưa có thông báo nào.</div>`}</div>`;
}
async function markRead(ids){
  ids=ids.filter(id=>{const n=notifs.find(x=>x.id===id);return n&&!n.read});if(!ids.length)return;
  notifs.forEach(n=>{if(ids.includes(n.id))n.read=true});renderBell();
  const r=await SB.from("notifications").update({read:true}).in("id",ids);if(r.error)say("Lỗi: "+r.error.message);
}
async function markAll(){
  notifs.forEach(n=>{n.read=true});renderBell();
  const r=await SB.from("notifications").update({read:true}).eq("user_id",user.id).eq("read",false);if(r.error)say("Lỗi: "+r.error.message);
}
async function clearAll(){
  if(!confirm("Xoá tất cả thông báo?"))return;
  const r=await SB.from("notifications").delete().eq("user_id",user.id);if(r.error)return say("Lỗi: "+r.error.message);
  notifs=[];renderBell();
}
async function openNotif(n){
  if(!n)return;markRead([n.id]);$("npn").hidden=true;
  await flush();
  if(n.cat==="post"){
    feed.focus=n.post_id||null;feed.ft=0;if(n.post_id&&(n.type==="comment"||n.type==="reply"))feed.openC.add(n.post_id);
    view="posts";go();
  }else{
    pendTview=n.type==="poll_new"||n.type==="poll_closed"?"vote":null;
    team=n.team_id?{id:n.team_id}:null;view="team";go();
  }
}
function initNotifs(){
  if(nCh&&nUser===user.id){loadNotifs();return;}
  stopNotifs();nUser=user.id;nSeen=null;loadNotifs();
  try{nCh=SB.channel("notif-"+user.id).on("postgres_changes",{event:"*",schema:"public",table:"notifications",filter:"user_id=eq."+user.id},()=>loadNotifs()).subscribe();}catch(e){}
}
function stopNotifs(){if(nCh&&SB){try{SB.removeChannel(nCh)}catch(e){}}nCh=null;nUser=null;nSeen=null;notifs=[];nErr=null;renderBell();}
$("bell").onclick=()=>{const p=$("npn");p.hidden=!p.hidden;if(!p.hidden){renderPanel();loadNotifs();}};
$("npn").onclick=e=>{
  const f=e.target.closest("[data-nf]");if(f){nf=f.dataset.nf;renderPanel();return;}
  const a=e.target.closest("[data-na]");if(a){a.dataset.na==="read"?markAll():clearAll();return;}
  const it=e.target.closest("[data-n]");if(it)openNotif(notifs.find(x=>x.id===it.dataset.n));
};
document.addEventListener("click",e=>{const p=$("npn");if(p&&!p.hidden&&!e.target.closest("#npn,#bell"))p.hidden=true;});
setInterval(()=>{if(user&&document.visibilityState==="visible")loadNotifs();},20000);
