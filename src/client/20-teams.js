/* ---------- lịch đội nhóm ---------- */
async function teamView(){
  const{data,error}=await SB.from("teams").select("*").order("created_at");
  if(error){say("Lỗi tải: "+error.message);return;}
  teams=data||[];
  if(team&&!teams.find(t=>t.id===team.id))team=null;
  team?openTeam(team.id):listTeams();
}
function listTeams(){
  $("body").innerHTML=`<div class="team-home"><div class="team-hero"><span class="team-hero-icon" aria-hidden="true">👥</span><div><h1>Lịch đội nhóm</h1><p>Phối hợp lịch, sự kiện và công việc cùng nhóm của bạn</p></div></div><div class="cards3 team-home-grid"><div class="card team-home-card"><h2>Nhóm của tôi</h2><div class="teams">${teams.length?teams.map(t=>`<button data-t="${t.id}">${t.owner===user.id?"👑 ":""}${esc(t.name)}</button>`).join(""):"<span class='mut'>Bạn chưa có nhóm nào.</span>"}</div></div>
  <div class="card team-home-card"><h2>Tạo nhóm mới</h2><div class="row"><input id="tn" class="sp" placeholder="Tên nhóm" maxlength="60"><button class="p" id="tc">Tạo nhóm</button></div></div>
  <div class="card team-home-card"><h2>Tham gia bằng mã</h2><div class="row"><input id="jc" class="sp" placeholder="Nhập mã chia sẻ" maxlength="10"><button class="p" id="jb">Tham gia</button></div></div></div></div>`;
  document.querySelectorAll("[data-t]").forEach(b=>b.onclick=()=>openTeam(b.dataset.t));
  $("tc").onclick=async()=>{const n=$("tn").value.trim();if(!n)return say("Hãy nhập tên nhóm.");
    const{data,error}=await SB.rpc("create_team",{p_name:n,p_user_name:uname()});if(error)return say("Lỗi: "+error.message);team=data;teamView();};
  $("jb").onclick=async()=>{const c=$("jc").value.trim();if(!c)return say("Hãy nhập mã.");
    const{data,error}=await SB.rpc("join_team",{p_code:c,p_user_name:uname()});if(error)return say("Lỗi: "+error.message);team=data;teamView();};
}
async function openTeam(id){
  if(!team||team.id!==id)cal={tid:null,ev:[],inv:[],rooms:[],bk:[],tk:[],err:null};team=teams.find(t=>t.id===id)||team;dirty=false;tview=pendTview||"mine";pendTview=null;pmode="paint";sel=new Set();await loadTeam(true);
}
let polls=[],pollErr=null,chatMsgs=[],chatTeam=null,chatErr=null;
const VD=["Chủ nhật","Thứ 2","Thứ 3","Thứ 4","Thứ 5","Thứ 6","Thứ 7"],p2=n=>String(n).padStart(2,"0");
const hm=d=>p2(d.getHours())+":"+p2(d.getMinutes()),dmy=d=>p2(d.getDate())+"/"+p2(d.getMonth()+1)+"/"+d.getFullYear();
const dt=s=>{if(!s)return"";const d=new Date(s);return hm(d)+" "+dmy(d)};
function dayLabel(d){const t=new Date(),y=new Date();y.setDate(t.getDate()-1);
  return dmy(d)===dmy(t)?"Hôm nay":dmy(d)===dmy(y)?"Hôm qua":VD[d.getDay()]+", "+dmy(d);}
async function loadChat(){chatErr=null;
  const r=await SB.from("team_messages").select("*").eq("team_id",team.id).order("created_at",{ascending:false}).limit(200);
  if(r.error){chatErr=r.error.message;chatMsgs=[];return;}chatMsgs=(r.data||[]).reverse();}
async function pollChat(){if(!team||chatTeam!==team.id||chatErr)return;
  const last=chatMsgs.length?chatMsgs[chatMsgs.length-1].created_at:null;
  let q=SB.from("team_messages").select("*").eq("team_id",team.id).order("created_at",{ascending:true}).limit(200);if(last)q=q.gte("created_at",last);
  const r=await q;if(r.error||!r.data)return;
  const seen=new Set(chatMsgs.map(m=>m.id)),add=r.data.filter(m=>!seen.has(m.id));if(!add.length)return;
  chatMsgs=chatMsgs.concat(add).slice(-300);renderChat();}
function renderChat(stick,top){const el=$("cl");if(!el)return;
  const near=el.scrollHeight-el.scrollTop-el.clientHeight<60;
  if(chatErr){el.innerHTML=`<div class="mut" style="padding:6px">⚠️ Chưa dùng được chat: ${esc(chatErr)}.<br>Hãy chạy file <b>setup_chat.sql</b> trong Supabase → SQL Editor.</div>`;return;}
  let day="",h="";
  chatMsgs.forEach(m=>{const d=new Date(m.created_at),dl=dayLabel(d),mine=m.user_id===user.id;
    if(dl!==day){day=dl;h+=`<div class="cday">${esc(dl)}</div>`;}
    h+=`<div class="cm ${mine?"me":""}"><div class="ch"><b>${m.user_id===team.owner?"👑 ":""}${mine?"Bạn":esc(m.user_name)}</b> · <span title="${dmy(d)} ${hm(d)}:${p2(d.getSeconds())}">${hm(d)}</span></div><div class="cb">${esc(m.content)}</div></div>`;});
  el.innerHTML=h||"<div class='mut' style='text-align:center;padding:12px'>Chưa có tin nhắn nào. Hãy gửi lời chào đầu tiên 👋</div>";
  if(stick===true||(stick===undefined&&near))el.scrollTop=el.scrollHeight;else if(top!=null)el.scrollTop=top;}
async function sendChat(){const i=$("ci"),t=i.value.trim();if(!t||chatErr)return;i.value="";
  const r=await SB.from("team_messages").insert({team_id:team.id,user_id:user.id,user_name:uname(),content:t}).select().single();
  if(r.error){i.value=t;return say("Lỗi gửi tin: "+r.error.message);}
  if(!chatMsgs.find(m=>m.id===r.data.id))chatMsgs.push(r.data);renderChat(true);i.focus();}
const chatCard=()=>`<aside class="card side chat"><h2>💬 Chat nhóm</h2><div class="cl" id="cl"></div><div class="row cin"><input id="ci" class="sp" maxlength="500" placeholder="Nhập tin nhắn…" autocomplete="off"${chatErr?" disabled":""}><button class="p" id="cs">Gửi</button></div></aside>`;
const freeCard=()=>`<aside class="card side notes"><h2>🟢 Khung giờ rảnh chung</h2><div class="mut" style="font-size:12px;margin-top:-6px">Mọi người đều rảnh trong tuần đang xem</div><div id="av" class="avp"></div><div class="mut" style="font-size:12px;margin:6px 0 2px"><b>Các khung giờ cả nhóm cùng rảnh</b></div><div id="fr" class="free-list"></div></aside>`;
async function loadTeam(reset){
  if(!team)return;
  const[a,b]=wkRange();
  const[m,z]=await Promise.all([SB.from("team_members").select("*").eq("team_id",team.id),SB.from("team_busy").select("*").eq("team_id",team.id).gte("slot_date",a).lte("slot_date",b)]);
  if(m.error||z.error)return say("Lỗi tải: "+(m.error||z.error).message);
  members=m.data||[];busy=z.data||[];
  if(!members.some(x=>x.user_id===user.id)){team=null;chatTeam=null;dirty=false;sel=new Set();say("Nhóm đã bị xoá hoặc bạn không còn trong nhóm này.");if(view==="team")teamView();return;}await loadPolls();await autoClosePolls();if(CAL_VIEWS.includes(tview))await loadCal();if(chatTeam!==team.id){chatTeam=team.id;chatMsgs=[];await loadChat();}
  if(reset){dirty=false;sel=new Set();}
  if(reset||!dirty)tmine=new Map(busy.filter(x=>x.user_id===user.id).map(x=>[K(x.slot_date,x.hour),x.note||""]));
  if(reset||view==="team")drawTeam();
}
const me=()=>members.find(m=>m.user_id===user.id)||{};
function noteOf(id,k){if(id===user.id)return tmine.get(k)||"";const[d,h]=k.split("|");return(busy.find(x=>x.user_id===id&&x.slot_date===d&&x.hour==h)||{}).note||"";}
function openMembers(){$("mq").value="";renderMembers();$("mem").hidden=false;}
function busyOf(k){const[d,h]=k.split("|");const ids=new Set(busy.filter(x=>x.slot_date===d&&x.hour==h&&x.user_id!==user.id).map(x=>x.user_id));if(tmine.has(k))ids.add(user.id);return[...ids];}
let revId=null;
function openReview(id){const p=polls.find(x=>x.id===id);if(!p)return;revId=id;$("prh").textContent=p.title;$("prb").innerHTML=reviewHtml(p);$("prm").hidden=false;}
function addOpt(v){const d=document.createElement("div");d.className="row";
  d.innerHTML='<input class="sp po" maxlength="80" placeholder="Phương án"><button class="rm" title="Xóa phương án">×</button>';
  d.querySelector("input").value=v||"";
  d.querySelector(".rm").onclick=()=>{if(document.querySelectorAll("#po .row").length>2)d.remove();else say("Cần ít nhất 2 phương án.")};
  $("po").appendChild(d);return d;}
function drawTeam(){
  const w0=document.querySelector(".wrap,.polls,.agenda"),st=w0?w0.scrollTop:0,ntv=$("nt")?$("nt").value:null;
  const cl0=$("cl"),cNear=!cl0||cl0.scrollHeight-cl0.scrollTop-cl0.clientHeight<60,cTop=cl0?cl0.scrollTop:0,civ=$("ci")?$("ci").value:"",cif=!!document.activeElement&&document.activeElement.id==="ci";
  const done=members.filter(m=>m.done).length,all=members.length,allDone=all>0&&done===all,pct=all?Math.round(done/all*100):0,openP=polls.filter(x=>!pClosed(x)).length;
  $("body").innerHTML=`<div class="split team-layout ${tview==="res"?"split4":"split3"}"><aside class="card side team-sidebar"><div class="row"><button id="bk">← Nhóm</button><span class="sp"></span><button id="tx" class="dg" title="${isOwner()?"Xoá nhóm này":"Rời khỏi nhóm này"}">${isOwner()?"🗑️ Xoá nhóm":"🚪 Rời nhóm"}</button></div><h2 class="team-title">${isOwner()?"👑 ":""}${esc(team.name)}</h2>
   <div class="row">Mã: <span class="code">${esc(team.code)}</span><span class="sp"></span><button id="cp">Sao chép</button></div>
   <div class="mut">👑 Nhóm trưởng: <b>${esc(ownerName())}</b>${isOwner()?" (Bạn)":""} · Vai trò của bạn: <b>${ROLE_VI[myRole()]}</b></div>
   <button id="mb" class="mem-btn"><span>👥 Thành viên (${all})</span><small>${done}/${all} đã chốt</small></button><div class="bar"><i style="width:${pct}%"></i></div>
   <div class="seg"><button id="v1" class="${tview==="mine"?"on":""}">Lịch bận của tôi</button><button id="v2" class="${tview==="res"?"on":""}">Kết quả chung</button></div>
   <button id="vb" class="mem-btn ${tview==="vote"?"on":""}"><span>🗳️ Bình chọn</span><small>${openP} đang mở</small></button>${navBtns()}
   ${tview==="mine"?`${noteSide()}${canEditTeam()?"":viewerNote()}<button id="sv">Lưu</button><button class="p" id="ch">${me().done?"Bỏ chốt để sửa":"Chốt lịch của tôi"}</button>`
   :tview==="cal"?calSide():tview==="room"?roomSide()
   :tview==="vote"?`<p class="mut" style="margin:0">Tạo câu hỏi và các phương án để cả nhóm cùng bỏ phiếu. Bấm vào một phương án để vote, bấm lại để bỏ phiếu. Khi đóng, bình chọn được chuyển sang Lịch sử vote.</p><span class="sp"></span>${canEditTeam()?`<button class="p" id="pc">＋ Tạo bình chọn</button>`:viewerNote()}`
   :`<p class="mut" style="margin:0">${allDone?"✅ Mọi người đã chốt. Ô xanh lá = tất cả cùng rảnh.":"⏳ Mới "+done+"/"+all+" người chốt, kết quả tạm tính."} Ô xám có số = số người bận.</p>`}
   </aside>
   <section class="card pane team-main-pane">${paneHtml()}</section>${rightCols()}</div>`;
  const w=document.querySelector(".wrap,.polls,.agenda");if(w)w.scrollTop=st;
  if(tview!=="vote")bindNav();bindNavBtns();
  $("bk").onclick=async()=>{await flush();team=null;sel=new Set();listTeams()};
  $("tx").onclick=isOwner()?deleteTeam:leaveTeam;
  $("cp").onclick=()=>{navigator.clipboard&&navigator.clipboard.writeText(team.code);say("Đã sao chép mã "+team.code)};
  renderChat(cNear,cTop);$("ci").value=civ;if(cif)$("ci").focus();
  $("ci").onkeydown=e=>{if(e.key==="Enter"&&!e.isComposing){e.preventDefault();sendChat()}};$("cs").onclick=sendChat;
  $("mb").onclick=openMembers;if($("mem")&&!$("mem").hidden)renderMembers();
  $("v1").onclick=()=>setTview("mine");$("v2").onclick=()=>setTview("res");$("vb").onclick=()=>setTview("vote");
  if(tview==="mine"){bindNotes();if(ntv!==null&&$("nt")&&fillNote===null)$("nt").value=ntv;$("sv").onclick=()=>saveTeam(false);$("ch").onclick=()=>me().done?unchot():saveTeam(true);}
  else if(tview==="cal")bindCal();
  else if(tview==="room")bindRoom();
  else if(tview==="vote"){if($("pc"))$("pc").onclick=openPollForm;
    const hl=$("hl");if(hl)hl.onclick=ev=>{const i=ev.target.closest("[data-h]");if(i)openReview(i.dataset.h)};
    const pl=$("pl");if(pl)pl.onclick=ev=>{const c=ev.target.closest(".pcard");if(!c)return;const a=ev.target.closest("[data-a]"),o=ev.target.closest("[data-o]");
      if(a)pollAction(c.dataset.p,a.dataset.a);else if(o)castVote(c.dataset.p,o.dataset.o);};}
  else showFree();
}
function setTeamCtx(){
  if(tview==="vote"){ctx={cell:()=>({cls:""})};return;}
  if(tview==="cal"){ctx={cell:()=>({cls:""})};return;}
  if(tview==="room"){ctx=roomCtx();return;}
  if(tview==="mine"){ctx=team&&!me().done&&canEditTeam()?mkCtx():{cell:cellOf};return;}
  const tot=members.length;
  ctx={cell:k=>{const bi=busyOf(k),set=new Set(bi),av=members.filter(m=>!set.has(m.user_id)).map(m=>m.name),sl=k===tsel?" tsel":"",c=(tot-bi.length)+"/"+tot;
    if(!bi.length)return{cls:"free"+sl,txt:"✓ "+c,tip:"Khả dụng: "+av.join(", ")};
    return{cls:"part"+sl,txt:c,tip:"Khả dụng: "+(av.join(", ")||"không ai")+"\nBận: "+bi.map(i=>{const nm=(members.find(m=>m.user_id===i)||{}).name,nt=noteOf(i,k);return nm+(nt?" ("+nt+")":"")}).join(", ")};},
   start:k=>k,
   apply:k=>{const o=tsel;tsel=k;if(o&&o!==k)refreshCell(o,true);refreshCell(k,true);renderAvail();}};
  const f0=ctx.cell;ctx.cell=k=>{const c=f0(k),e=evAt(k);return e?{...c,cls:c.cls+" evmark",tip:(c.tip||"")+"\n📅 "+e.title}:c;};
}
function showFree(){
  let out="";
  wkDates().forEach((dt,d)=>{const f=fmt(dt);let r=[],s=null;
    for(let h=0;h<=24;h++){const free=h<24&&!busyOf(K(f,h)).length;if(free&&s===null)s=h;if(!free&&s!==null){r.push(s+":00–"+h+":00");s=null;}}
    if(r.length)out+="<div><b>"+DAYS[d]+" "+dm(dt)+":</b> "+r.join(", ")+"</div>";});
  $("fr").innerHTML=(out||"<div class='mut'>Không có khung giờ nào trùng.</div>");renderAvail();renderMeet();bindMeet();loadConf().then(()=>{if($("mt"))renderMeet()}).catch(()=>{});
}
async function saveTeam(chot,silent){
  if(!silent)say("Đang lưu…");
  const[a,b]=wkRange();
  let r=await SB.from("team_busy").delete().eq("team_id",team.id).eq("user_id",user.id).gte("slot_date",a).lte("slot_date",b);if(r.error)return say("Lỗi: "+r.error.message);
  const rows=[...tmine].map(([k,note])=>{const[d,h]=k.split("|");return{team_id:team.id,user_id:user.id,slot_date:d,hour:+h,note}});let warn="";
  if(rows.length){r=await SB.from("team_busy").insert(rows);
    if(r.error&&/note/i.test(r.error.message)){r=await SB.from("team_busy").insert(rows.map(({note,...x})=>x));warn=" (chưa lưu được ghi chú: cần thêm cột note vào bảng team_busy)";}
    if(r.error)return say("Lỗi: "+r.error.message);}
  if(chot){r=await SB.from("team_members").update({done:true}).eq("team_id",team.id).eq("user_id",user.id);if(r.error)return say("Lỗi: "+r.error.message);}
  dirty=false;
  if(silent){say("Đã tự lưu tuần vừa chỉnh"+warn);return;}
  await loadTeam(true);say((chot?"✓ Đã chốt lịch":"✓ Đã lưu")+warn);
}
async function unchot(){
  const r=await SB.from("team_members").update({done:false}).eq("team_id",team.id).eq("user_id",user.id);
  if(r.error)return say("Lỗi: "+r.error.message);await loadTeam(true);
}

/* ---------- thành viên khả dụng · gợi ý / xuất / báo lịch họp ---------- */
function renderAvail(){const el=$("av");if(!el)return;
  if(!tsel||!wkDates().some(d=>tsel.startsWith(fmt(d)+"|"))){el.innerHTML="<div class='mut'>Bấm vào một ô trên lịch để xem ai khả dụng, ai bận.</div>";return;}
  const[d,h]=tsel.split("|"),bi=new Set(busyOf(tsel)),av=members.filter(m=>!bi.has(m.user_id)),bz=members.filter(m=>bi.has(m.user_id)),dt0=parse(d);
  el.innerHTML=`<div><b>${DAYS[(dt0.getDay()+6)%7]} ${dm(dt0)} · ${h}:00–${+h+1}:00</b></div>
   <div class="avh">✅ Khả dụng (${av.length}/${members.length})</div><div>${av.length?av.map(m=>`<span class="chip ok">${esc(m.name)}</span>`).join(""):"<span class='mut'>Không ai khả dụng</span>"}</div>
   <div class="avh">⛔ Đang bận (${bz.length})</div><div>${bz.length?bz.map(m=>{const n=noteOf(m.user_id,tsel);return`<span class="chip">${esc(m.name)}${n?" · "+esc(n):""}</span>`}).join(""):"<span class='mut'>Không ai bận</span>"}</div>`;}
const meetCard=()=>`<aside class="card side notes"><h2>📅 Gợi ý lịch họp</h2><div class="mut" style="font-size:12px;margin-top:-6px">Xếp hạng theo giờ làm việc hiệu quả và tránh trùng lịch</div><div class="row"><span class="mut">Thời lượng</span><select id="md">${[1,2,3,4].map(n=>`<option value="${n}" ${n===mDur?"selected":""}>${n} giờ</option>`).join("")}</select></div>
  <div id="mt" class="free-list"></div>
  <div class="row"><button id="mn" title="Gửi các khung giờ gợi ý vào chat nhóm">🔔 Báo cho nhóm</button><button id="mx">⬇ Xuất tất cả (.ics)</button><button id="mst">📊 Phân tích nhóm</button></div>
  ${isOwner()?`<label class="row" style="gap:8px;font-size:13px;cursor:pointer"><input type="checkbox" id="ma"> Tự động báo vào chat khi cả nhóm đã chốt</label>`:""}</aside>`;
const stamp=(d,h)=>fmt(d).replace(/-/g,"")+"T"+pad(h)+"0000";
const icsEsc=t=>String(t).replace(/([\\;,])/g,"\\$1").replace(/\n/g,"\\n");
function meetSlots(){const out=[],now=new Date();
  wkDates().forEach((dt,di)=>{const f=fmt(dt);
    for(let s0=7;s0+mDur<=22;s0++){let ok=true;for(let h=s0;h<s0+mDur;h++)if(busyOf(K(f,h)).length){ok=false;break;}
      if(!ok||new Date(dt.getFullYear(),dt.getMonth(),dt.getDate(),s0)<=now)continue;
      let cp=null,ct=false;for(let h=s0;h<s0+mDur;h++){const k=K(f,h);if(conf.p.has(k))cp=conf.p.get(k)||"Bận";if(conf.t.has(k))ct=true;}
      let sc=60-di*2;const mid=s0+mDur/2;
      if(mid>=9&&mid<=11.5)sc+=18;else if(mid>=14&&mid<=16.5)sc+=14;
      if(s0<8||s0+mDur>20)sc-=15;if(s0<13&&s0+mDur>12)sc-=10;if(cp)sc-=40;if(ct)sc-=30;
      out.push({dt,di,s:s0,e:s0+mDur,cp,ct,sc});}});
  out.sort((x,y)=>y.sc-x.sc||x.dt-y.dt||x.s-y.s);
  const pick=[];for(const x of out){if(pick.length>=6)break;if(!pick.some(y=>y.di===x.di&&x.s<y.e&&y.s<x.e))pick.push(x);}
  return pick;}
async function loadConf(){if(!team)return;const[a,b]=wkRange(),key=team.id+a;if(conf.key===key)return;
  const[p,t]=await Promise.all([SB.from("personal_slots").select("slot_date,hour,note").gte("slot_date",a).lte("slot_date",b),SB.from("team_busy").select("slot_date,hour").eq("user_id",user.id).neq("team_id",team.id).gte("slot_date",a).lte("slot_date",b)]);
  conf={key,p:new Map((p.data||[]).map(r=>[K(r.slot_date,r.hour),r.note||""])),t:new Set((t.data||[]).map(r=>K(r.slot_date,r.hour)))};}
const gcal=x=>"https://calendar.google.com/calendar/render?action=TEMPLATE&text="+encodeURIComponent("Họp "+team.name)+"&dates="+stamp(x.dt,x.s)+"/"+stamp(x.dt,x.e)+"&details="+encodeURIComponent("Khung giờ cả nhóm cùng rảnh (Timesheet)");
function renderMeet(){const el=$("mt");if(!el)return;const sl=meetSlots(),done=members.filter(m=>m.done).length;
  const why=x=>{const w=[];if(!x.cp&&!x.ct)w.push("không trùng lịch của bạn");const mid=x.s+mDur/2;if(mid>=9&&mid<=11.5)w.push("giờ làm việc hiệu quả");else if(mid>=14&&mid<=16.5)w.push("giờ chiều ổn định");return w.join(" · ");};
  el.innerHTML=(done<members.length?`<div class="mut" style="margin-bottom:4px">⏳ Mới ${done}/${members.length} người chốt, gợi ý tạm tính.</div>`:"")
   +(sl.length?sl.map((x,i)=>`<div class="ms"><b>${i===0&&!x.cp&&!x.ct?"⭐ ":""}${DAYS[x.di]} ${dm(x.dt)} · ${x.s}:00–${x.e}:00</b>${x.cp?`<div class="warn">⚠️ Trùng lịch cá nhân của bạn${x.cp==="Bận"?"":" ("+esc(x.cp)+")"}</div>`:""}${x.ct?`<div class="warn">⚠️ Trùng lịch bận ở nhóm khác của bạn</div>`:""}<small class="mut">${why(x)}</small><div class="row">${canEditTeam()?`<button data-mkev="${i}">📅 Tạo sự kiện</button>`:""}<button data-ics="${i}">⬇ .ics</button><a class="btn" target="_blank" rel="noopener" href="${esc(gcal(x))}">Google Lịch</a></div></div>`).join(""):`<div class="mut">Chưa có khung ${mDur} giờ liên tục (trong 7:00–22:00) mà cả nhóm cùng rảnh.</div>`);
  el.onclick=ev=>{const b=ev.target.closest("[data-ics]");if(b)return downloadIcs(sl[+b.dataset.ics]);
    const m=ev.target.closest("[data-mkev]");if(m){const x=sl[+m.dataset.mkev];openEventForm(null,{date:fmt(x.dt),s:x.s,e:x.e,title:"Họp "+team.name});}};}
function downloadIcs(x){const L=Array.isArray(x)?x:[x],z=new Date().toISOString().replace(/[-:]|\.\d{3}/g,"");
  const ev=L.map(v=>["BEGIN:VEVENT","UID:ts-"+team.id+"-"+stamp(v.dt,v.s)+"@timesheet","DTSTAMP:"+z,"DTSTART:"+stamp(v.dt,v.s),"DTEND:"+stamp(v.dt,v.e),"SUMMARY:"+icsEsc("Họp "+team.name),"DESCRIPTION:"+icsEsc("Khung giờ cả nhóm cùng rảnh (Timesheet)"),"END:VEVENT"].join("\r\n")).join("\r\n");
  const txt="BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Timesheet//VI\r\nCALSCALE:GREGORIAN\r\n"+ev+"\r\nEND:VCALENDAR\r\n";
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([txt],{type:"text/calendar;charset=utf-8"}));
  a.download="lich-hop-"+(L.length>1?"nhom":stamp(L[0].dt,L[0].s).slice(0,8))+".ics";document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);say("✓ Đã xuất file lịch .ics");}
async function notifyTeam(auto){const sl=meetSlots().slice(0,5);if(!sl.length){if(!auto)say("Chưa có khung giờ nào để báo.");return;}
  const t=(auto?"🤖 Tự động: ":"")+"📅 Gợi ý lịch họp ("+mDur+"h): "+sl.map(x=>DAYS[x.di]+" "+dm(x.dt)+" "+x.s+":00–"+x.e+":00").join(" · ");
  const r=await SB.from("team_messages").insert({team_id:team.id,user_id:user.id,user_name:uname(),content:t.slice(0,500)}).select().single();
  if(r.error)return say("Lỗi gửi: "+r.error.message);
  if(!chatMsgs.find(m=>m.id===r.data.id))chatMsgs.push(r.data);renderChat(true);say("✓ Đã gửi gợi ý lịch họp vào chat nhóm");}
const aKey=()=>"tsAuto:"+team.id;
function autoNotify(){if(!isOwner()||members.length<2||!members.every(m=>m.done))return;
  let on=false,sent=null;const sk="tsSent:"+team.id+":"+fmt(weekStart);
  try{on=localStorage.getItem(aKey())==="1";sent=localStorage.getItem(sk)}catch(e){}
  if(on&&!sent){try{localStorage.setItem(sk,"1")}catch(e){}notifyTeam(true);}}
function bindMeet(){const d=$("md");if(!d)return;
  d.onchange=()=>{mDur=+d.value;renderMeet()};
  $("mn").onclick=()=>notifyTeam(false);$("mst").onclick=openAnalytics;
  $("mx").onclick=()=>{const sl=meetSlots();sl.length?downloadIcs(sl):say("Chưa có khung giờ nào để xuất.")};
  const ma=$("ma");if(ma){let on=false;try{on=localStorage.getItem(aKey())==="1"}catch(e){}ma.checked=on;
    ma.onchange=()=>{try{localStorage.setItem(aKey(),ma.checked?"1":"0")}catch(e){}if(ma.checked)autoNotify();};}
  autoNotify();}

/* ---------- nhóm trưởng · xoá / rời nhóm ---------- */
const isOwner=()=>!!team&&team.owner===user.id;
const ownerName=()=>(members.find(m=>m.user_id===team.owner)||{}).name||"?";
function rpcErr(e){return /function|schema cache|could not find/i.test(e.message||"")?"Chưa có hàm xử lý trên Supabase: hãy chạy đoạn SQL xoá/rời nhóm trong SQL Editor.":(e.message||String(e));}
async function leaveOrDelete(fn,ask,done){
  if(!confirm(ask))return;
  dirty=false;
  const r=await SB.rpc(fn,{p_team_id:team.id});
  if(r.error)return say("Lỗi: "+rpcErr(r.error));
  team=null;chatTeam=null;chatMsgs=[];sel=new Set();say(done);await teamView();
}
const deleteTeam=()=>leaveOrDelete("delete_team","Xoá nhóm \""+team.name+"\"?\n\nToàn bộ lịch bận, chat và bình chọn của nhóm sẽ bị xoá vĩnh viễn, mọi thành viên sẽ không còn thấy nhóm này. Không thể khôi phục.","✓ Đã xoá nhóm");
const leaveTeam=()=>leaveOrDelete("leave_team","Rời nhóm \""+team.name+"\"?\n\nLịch bận và phiếu bầu của bạn trong nhóm này sẽ bị xoá. Muốn quay lại bạn cần nhập lại mã nhóm.","✓ Đã rời nhóm");
