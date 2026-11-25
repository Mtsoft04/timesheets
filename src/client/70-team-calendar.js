/* ===================================================================
   V3 · Xác nhận lịch · Công việc · Lịch chung & vai trò · Phòng họp
        Liên kết sống · Bình chọn nâng cao · Nhắc lịch nền (web push)
   Cần chạy migrate_v2.sql rồi migrate_v3.sql trong Supabase.
   =================================================================== */
const ROLE_VI={owner:"Nhóm trưởng",admin:"Quản trị viên",member:"Thành viên",viewer:"Chỉ xem"};
const myRole=()=>!team||!user?"member":(team.owner===user.id?"owner":(me().role||"member"));
const canEditTeam=()=>myRole()!=="viewer";
const isAdminT=()=>{const r=myRole();return r==="owner"||r==="admin"};
const CAL_VIEWS=["cal","room","res"];
const hrOpts=(a,b,s)=>{let o="";for(let h=a;h<=b;h++)o+=`<option value="${h}"${h===s?" selected":""}>${pad(h)}:00</option>`;return o;};
const dowOf=s=>DAYS[(parse(s).getDay()+6)%7];
function dbErr(e){const m=(e&&e.message)||String(e||"");
  if((e&&e.code==="23P01")||/exclusion constraint|bookings_room/i.test(m))return"Phòng/tài nguyên đã có người đặt trong khung giờ này.";
  if(/row-level security|permission denied/i.test(m))return"Bạn không có quyền thực hiện thao tác này.";
  if(/does not exist|schema cache|could not find (the )?(function|table|column)/i.test(m))return"Cơ sở dữ liệu chưa được cập nhật: hãy chạy migrate_v2.sql rồi migrate_v3.sql trong Supabase → SQL Editor.";
  return m;}

/* ---------- dữ liệu lịch chung: sự kiện · lời mời · phòng · đặt phòng · công việc nhóm ---------- */
let cal={tid:null,ev:[],inv:[],rooms:[],bk:[],tk:[],err:null},roomSel=null,bkSel=new Set(),bkA=null,myTk=[],tkErr=null;
async function loadCal(){
  if(!team||!team.id)return;const[a,b]=wkRange(),tid=team.id;
  const[ev,rm,bk,tk]=await Promise.all([
    SB.from("team_events").select("*").eq("team_id",tid).gte("event_date",a).lte("event_date",b).order("event_date").order("start_hour"),
    SB.from("rooms").select("*").eq("team_id",tid).order("name"),
    SB.from("bookings").select("*").eq("team_id",tid).gte("booking_date",a).lte("booking_date",b).order("booking_date").order("start_hour"),
    SB.from("tasks").select("*").eq("team_id",tid).order("due_date",{ascending:true,nullsFirst:false}).limit(300)]);
  const er=ev.error||rm.error||bk.error||tk.error;
  if(!team||team.id!==tid)return;
  if(er){cal={tid,ev:[],inv:[],rooms:[],bk:[],tk:[],err:er.message};return;}
  let inv=[];const ids=(ev.data||[]).map(e=>e.id);
  if(ids.length){const iv=await SB.from("event_invites").select("*").in("event_id",ids);if(!iv.error)inv=iv.data||[];}
  cal={tid,ev:ev.data||[],inv,rooms:rm.data||[],bk:bk.data||[],tk:tk.data||[],err:null};
}
const evAt=k=>{if(!team||cal.tid!==team.id)return null;const[d,h]=k.split("|");return cal.ev.find(e=>e.event_date===d&&+h>=e.start_hour&&+h<e.end_hour)||null;};
async function setTview(v){await flush();tview=v;sel=new Set();if(CAL_VIEWS.includes(v))await loadCal();drawTeam();}
async function showDate(d){const m=mondayOf(parse(d));
  if(fmt(m)!==fmt(weekStart)){weekStart=m;selDate=d;await loadTeam(true);}else{await loadCal();drawTeam();}}
const calErrBox=()=>`<div class="mut" style="padding:10px">⚠️ ${esc(dbErr({message:cal.err}))}</div>`;

/* ---------- menu nhóm: nút chuyển chế độ ---------- */
function navBtns(){
  const n=cal.tid===(team&&team.id)?cal.ev.length:0;
  return `<button id="vc" class="mem-btn ${tview==="cal"?"on":""}"><span>📅 Lịch chung · sự kiện</span><small>${tview==="cal"?n+" trong tuần":"lời mời, công việc"}</small></button>
   <button id="vr" class="mem-btn ${tview==="room"?"on":""}"><span>🏢 Phòng &amp; tài nguyên</span><small>đặt chỗ</small></button>
   ${isAdminT()?`<button id="vl">🔗 Liên kết chia sẻ sống</button>`:""}`;}
function bindNavBtns(){
  $("vc").onclick=()=>setTview("cal");$("vr").onclick=()=>setTview("room");
  const vl=$("vl");if(vl)vl.onclick=()=>openLiveShares("team");}
function paneHtml(){
  if(tview==="vote")return votePane();
  if(tview==="cal")return calPane();
  if(tview==="room")return roomPane();
  return `<div class="ptop">${navBar()}<span class="sp"></span>${legend()}</div>${grid(k=>ctx.cell(k))}`;}
const rightCols=()=>tview==="res"?`<div class="rcol team-aside">${freeCard()}${chatCard()}</div><div class="rcol team-aside">${meetCard()}</div>`:`<div class="rcol team-aside">${rightCards()}</div>`;
const rightCards=()=>chatCard()+(tview==="mine"?noteCard():tview==="res"?freeCard()+meetCard():tview==="cal"?taskCard():tview==="room"?bookCard():historyCard());
const viewerNote=()=>canEditTeam()?"":`<div class="vwnote">👁️ Bạn có vai trò <b>Chỉ xem</b>: xem được lịch, trả lời lời mời, bình chọn và chat, nhưng không sửa được lịch bận, không tạo sự kiện, công việc, bình chọn hay đặt phòng.</div>`;

/* ---------- Lịch chung: sự kiện + lời mời + công việc theo tuần ---------- */
function calSide(){
  return `<p class="mut" style="margin:0">Sự kiện của nhóm hiển thị theo tuần. Người được mời bấm <b>Tham gia / Có thể / Từ chối</b>; người tạo thấy ai đã trả lời.</p>
   ${canEditTeam()?`<button class="p" id="xev">＋ Tạo sự kiện</button>`:viewerNote()}`;}
function calPane(){
  if(cal.err)return `<div class="ptop">${navBar()}</div>${calErrBox()}`;
  const ds=wkDates(),today=fmt(new Date());
  const cols=ds.map((d,i)=>{const f=fmt(d),it=[];
    cal.ev.filter(e=>e.event_date===f).forEach(e=>it.push({s:e.start_hour,h:evHtml(e)}));
    cal.bk.filter(b=>b.booking_date===f&&!b.event_id).forEach(b=>{const r=cal.rooms.find(x=>x.id===b.room_id);
      it.push({s:b.start_hour,h:`<div class="bkm">🏢 ${esc(r?r.name:"Phòng")} · ${b.start_hour}:00–${b.end_hour}:00${b.title?" · "+esc(b.title):""}</div>`});});
    cal.tk.filter(t=>t.due_date===f).forEach(t=>it.push({s:t.due_hour==null?-1:t.due_hour,h:tkMini(t)}));
    it.sort((x,y)=>x.s-y.s);
    return `<div class="dcol ${f===today?"today":""}"><div class="dh">${DAYS[i]} <small>${dm(d)}</small></div>${it.length?it.map(x=>x.h).join(""):`<div class="mut dempty">—</div>`}</div>`;}).join("");
  return `<div class="ptop">${navBar()}</div><div class="agenda" id="agd">${cols}</div>`;}
function tkMini(t){return `<div class="tkm ${t.done?"done":""}">${t.done?"✅":"⬜"} ${t.due_hour!=null?"<b>"+t.due_hour+":00</b> ":""}${esc(t.title)}${t.assignee_name?` <span class="mut">· ${esc(t.assignee_name)}</span>`:""}</div>`;}
const RSV=[["accepted","✓ Tham gia"],["maybe","? Có thể"],["declined","✗ Từ chối"]];
function evHtml(e){
  const inv=cal.inv.filter(i=>i.event_id===e.id),my=inv.find(i=>i.user_id===user.id),room=cal.rooms.find(r=>r.id===e.room_id),c=s=>inv.filter(i=>i.status===s).length;
  const man=e.created_by===user.id||isAdminT();
  return `<div class="evc ${my?my.status:""}"><b>${esc(e.title)}</b>
   <div class="mut">${e.start_hour}:00–${e.end_hour}:00${room?" · 🏢 "+esc(room.name):e.location?" · 📍 "+esc(e.location):""}</div>
   ${e.description?`<div class="ed">${esc(e.description)}</div>`:""}
   <div class="mut" style="font-size:12px">Tạo bởi ${esc(e.created_by_name)} · ✓${c("accepted")} ?${c("maybe")} ✗${c("declined")} …${c("pending")}</div>
   ${my?`<div class="rsvp">${RSV.map(([s,t])=>`<button class="rv ${my.status===s?"on "+s:""}" data-rsvp="${s}" data-e="${e.id}">${t}</button>`).join("")}</div>`:""}
   <div class="row"><button class="pa" data-evd="${e.id}">Chi tiết</button>${man?`<button class="pa" data-eve="${e.id}">Sửa</button><button class="pa dg" data-evx="${e.id}">Xóa</button>`:""}</div></div>`;}
function bindCal(){
  const x=$("xev");if(x)x.onclick=()=>openEventForm();
  const ag=$("agd");if(ag)ag.onclick=ev=>{
    const r=ev.target.closest("[data-rsvp]");if(r)return rsvp(r.dataset.e,r.dataset.rsvp);
    const d=ev.target.closest("[data-evd]");if(d)return evDetail(d.dataset.evd);
    const del=ev.target.closest("[data-evx]");if(del)return delEvent(del.dataset.evx);
    const ed=ev.target.closest("[data-eve]");if(ed)return openEventForm(cal.ev.find(z=>z.id===ed.dataset.eve));};
  bindTasks();}
async function rsvp(eid,st){
  let note="";
  if(st==="declined"){const n=prompt("Lý do từ chối (không bắt buộc):","");if(n===null)return;note=n.trim().slice(0,300);}
  const r=await SB.from("event_invites").update({status:st,note,responded_at:new Date().toISOString()}).eq("event_id",eid).eq("user_id",user.id).select();
  if(r.error)return say("Lỗi: "+dbErr(r.error));
  if(!(r.data||[]).length)return say("Bạn không có trong danh sách mời của sự kiện này.");
  say(st==="accepted"?"✓ Đã xác nhận tham gia":st==="maybe"?"Đã ghi nhận: có thể tham gia":"Đã từ chối sự kiện");
  await loadCal();if(view==="team"&&tview==="cal")drawTeam();}
async function delEvent(id){
  const e=cal.ev.find(x=>x.id===id);if(!e||!confirm("Xóa sự kiện \""+e.title+"\"?\n\nLời mời và lịch đặt phòng đi kèm cũng bị xóa. Công việc gắn với sự kiện được giữ lại."))return;
  const r=await SB.from("team_events").delete().eq("id",id).select();
  if(r.error)return say("Lỗi: "+dbErr(r.error));
  if(!(r.data||[]).length)return say("Bạn không có quyền xóa sự kiện này.");
  say("✓ Đã xóa sự kiện");await loadCal();drawTeam();}
function evDetail(id){
  const e=cal.ev.find(x=>x.id===id);if(!e)return;
  const inv=cal.inv.filter(i=>i.event_id===id),room=cal.rooms.find(r=>r.id===e.room_id);
  const ST={accepted:["✓ Tham gia","ok"],maybe:["? Có thể",""],declined:["✗ Từ chối",""],pending:["… Chưa trả lời",""]};
  const ord={accepted:0,maybe:1,pending:2,declined:3};
  openGm("📅 "+e.title,`<div class="xdet"><div class="mut">${dowOf(e.event_date)} ${dm(parse(e.event_date))}/${parse(e.event_date).getFullYear()} · ${e.start_hour}:00–${e.end_hour}:00${room?" · 🏢 "+esc(room.name):""}${e.location?" · 📍 "+esc(e.location):""}</div>
   ${e.description?`<p style="white-space:pre-wrap;margin:8px 0">${esc(e.description)}</p>`:""}
   <div class="mut" style="margin:6px 0">Tạo bởi ${esc(e.created_by_name)} · ${inv.length} người được mời</div>
   <div class="mlist">${inv.sort((a,b)=>ord[a.status]-ord[b.status]||(a.user_name||"").localeCompare(b.user_name||"","vi")).map(i=>`<div class="mrow"><span class="av">${ini(i.user_name)}</span><span class="mn">${esc(i.user_name)}${i.user_id===user.id?" <small class='mut'>(Bạn)</small>":""}${i.note?`<div class="mut" style="font-size:12px;white-space:normal">“${esc(i.note)}”</div>`:""}</span><span class="chip ${ST[i.status][1]}">${ST[i.status][0]}</span></div>`).join("")||"<div class='mut'>Chưa có ai được mời.</div>"}</div>
   <div class="row" style="margin-top:12px"><button id="xics">⬇ Xuất .ics</button></div></div>`);
  $("xics").onclick=()=>evIcs(e);}
function evIcs(e){
  const d=parse(e.event_date),z=new Date().toISOString().replace(/[-:]|\.\d{3}/g,""),end=e.end_hour>=24?stamp(addD(d,1),0):stamp(d,e.end_hour);
  const txt=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Timesheet//VI","CALSCALE:GREGORIAN","BEGIN:VEVENT","UID:ev-"+e.id+"@timesheet","DTSTAMP:"+z,"DTSTART:"+stamp(d,e.start_hour),"DTEND:"+end,"SUMMARY:"+icsEsc(e.title),"LOCATION:"+icsEsc(e.location||""),"DESCRIPTION:"+icsEsc(e.description||""),"END:VEVENT","END:VCALENDAR",""].join("\r\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([txt],{type:"text/calendar;charset=utf-8"}));a.download="su-kien-"+e.event_date+".ics";document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);say("✓ Đã xuất file .ics");}

/* ---------- form tạo / sửa sự kiện ---------- */
let evT=null;
function openEventForm(e,pre){
  if(!canEditTeam())return say("Vai trò Chỉ xem không tạo được sự kiện.");
  pre=pre||{};const inv=e?new Set(cal.inv.filter(i=>i.event_id===e.id).map(i=>i.user_id)):null;
  const d0=e?e.event_date:(pre.date||selDate||fmt(new Date())),s0=e?e.start_hour:(pre.s!=null?pre.s:9),e0=e?e.end_hour:(pre.e!=null?pre.e:s0+1);
  const t0=e?e.title:(pre.title||""),rooms=cal.rooms;
  openGm(e?"✏️ Sửa sự kiện":"📅 Tạo sự kiện",`<div class="xfrm">
   <label class="f">Tên sự kiện<input id="xet" maxlength="120" value="${esc(t0)}" placeholder="VD: Họp tuần"></label>
   <div class="row"><label class="f sp">Ngày<input type="date" id="xed" value="${d0}"></label><label class="f">Bắt đầu<select id="xes" class="xs">${hrOpts(0,23,s0)}</select></label><label class="f">Kết thúc<select id="xee" class="xs">${hrOpts(1,24,e0)}</select></label></div>
   <label class="f">Phòng / tài nguyên<select id="xer" class="xs"><option value="">Không đặt phòng</option>${rooms.map(r=>`<option value="${r.id}" ${e&&e.room_id===r.id?"selected":""}>${r.kind==="equipment"?"🔧":"🏢"} ${esc(r.name)}${r.capacity?" ("+r.capacity+" chỗ)":""}</option>`).join("")}</select></label>
   <label class="f">Địa điểm khác (nếu không đặt phòng)<input id="xel" maxlength="120" value="${esc(e?e.location:"")}" placeholder="VD: Quán cà phê / link Meet"></label>
   <label class="f">Mô tả<textarea id="xedes" maxlength="1000">${esc(e?e.description:"")}</textarea></label>
   <div><b style="font-size:13px">Mời ai?</b> <button class="pa" type="button" id="xall">Chọn tất cả</button> <button class="pa" type="button" id="xnone">Bỏ chọn</button>
    <div class="xinvl">${members.map(m=>`<label><input type="checkbox" class="xinv" value="${m.user_id}" ${(!inv||inv.has(m.user_id)||m.user_id===user.id)?"checked":""} ${m.user_id===(e?e.created_by:user.id)?"disabled":""}>${esc(m.name)}${m.user_id===user.id?" (Bạn)":""}</label>`).join("")}</div></div>
   <div class="xwarn" id="xew"></div>
   <div class="row" style="justify-content:flex-end"><button id="xec" type="button">Hủy</button><button class="p" id="xeg" type="button">${e?"Lưu thay đổi":"Tạo sự kiện"}</button></div></div>`);
  const chk=()=>evCheckSoon(e&&e.id);
  ["xed","xes","xee","xer"].forEach(i=>$(i).onchange=chk);document.querySelectorAll(".xinv").forEach(i=>i.onchange=chk);
  $("xall").onclick=()=>{document.querySelectorAll(".xinv").forEach(i=>i.checked=true);chk()};
  $("xnone").onclick=()=>{document.querySelectorAll(".xinv").forEach(i=>{if(!i.disabled)i.checked=false});chk()};
  $("xec").onclick=()=>{$("gm").hidden=true};$("xeg").onclick=()=>saveEvent(e);$("xet").focus();chk();}
function evCheckSoon(ex){clearTimeout(evT);evT=setTimeout(()=>evCheck(ex),250);}
async function evCheck(ex){
  const w=$("xew");if(!w)return;
  const d=$("xed").value,s=+$("xes").value,en=+$("xee").value,room=$("xer").value;
  if(!d){w.textContent="";return;}
  if(en<=s){w.textContent="⚠️ Giờ kết thúc phải sau giờ bắt đầu.";return;}
  const ids=new Set([...document.querySelectorAll(".xinv:checked")].map(i=>i.value));
  const[b,k]=await Promise.all([
    SB.from("team_busy").select("user_id,hour").eq("team_id",team.id).eq("slot_date",d).gte("hour",s).lt("hour",en),
    room?SB.from("bookings").select("*").eq("room_id",room).eq("booking_date",d):Promise.resolve({data:[]})]);
  if(!$("xew"))return;
  const out=[],bz=[...new Set((b.data||[]).filter(x=>ids.has(x.user_id)).map(x=>x.user_id))].map(id=>(members.find(m=>m.user_id===id)||{}).name||"?");
  if(bz.length)out.push("⚠️ "+bz.length+" người đã tô bận trong khung này: "+bz.slice(0,5).join(", ")+(bz.length>5?"…":""));
  const cf=(k.data||[]).find(x=>x.start_hour<en&&s<x.end_hour&&x.event_id!==ex);
  if(cf)out.push("⛔ Phòng đã được đặt "+cf.start_hour+":00–"+cf.end_hour+":00"+(cf.title?" ("+cf.title+")":"")+".");
  w.innerHTML=out.map(esc).join("<br>");}
async function saveEvent(e){
  const title=$("xet").value.trim(),d=$("xed").value,s=+$("xes").value,en=+$("xee").value,loc=$("xel").value.trim(),room=$("xer").value||null,desc=$("xedes").value.trim();
  if(!title)return say("Hãy nhập tên sự kiện.");if(!d)return say("Hãy chọn ngày.");if(en<=s)return say("Giờ kết thúc phải sau giờ bắt đầu.");
  const ids=[...document.querySelectorAll(".xinv:checked")].map(i=>i.value),btn=$("xeg");btn.disabled=true;
  try{
    if(e){
      let r=await SB.from("team_events").update({title,description:desc,location:loc,room_id:room,event_date:d,start_hour:s,end_hour:en}).eq("id",e.id).select();
      if(r.error)throw r.error;if(!(r.data||[]).length)throw new Error("Bạn không có quyền sửa sự kiện này.");
      r=await SB.rpc("set_event_invitees",{p_event:e.id,p_users:ids});if(r.error)throw r.error;
    }else{
      const r=await SB.rpc("create_event",{p_team:team.id,p_title:title,p_desc:desc,p_loc:loc,p_date:d,p_start:s,p_end:en,p_room:room,p_invitees:ids});if(r.error)throw r.error;
    }
    $("gm").hidden=true;say(e?"✓ Đã lưu sự kiện":"✓ Đã tạo sự kiện và gửi lời mời");
    if(tview!=="cal"&&tview!=="room"){tview="cal";}
    await showDate(d);
  }catch(er){say("Lỗi: "+dbErr(er));}finally{if($("xeg"))$("xeg").disabled=false;}}

/* ---------- công việc gắn lịch (cá nhân & nhóm) ---------- */
const tkScope=()=>view==="team"&&team?"team":"me";
const tkList=()=>tkScope()==="team"?cal.tk:myTk;
const tkTs=t=>{if(!t.due_date)return null;const d=parse(t.due_date);d.setHours(t.due_hour==null?23:t.due_hour,t.due_hour==null?59:0,0,0);return d.getTime();};
const tkCmp=(a,b)=>(a.due_date||"9999").localeCompare(b.due_date||"9999")||((a.due_hour==null?-1:a.due_hour)-(b.due_hour==null?-1:b.due_hour))||String(a.created_at).localeCompare(String(b.created_at));
async function loadMyTasks(){
  const r=await SB.from("tasks").select("*").or("assignee.eq."+user.id+",and(team_id.is.null,created_by.eq."+user.id+")").order("due_date",{ascending:true,nullsFirst:false}).limit(300);
  if(r.error){tkErr=r.error.message;myTk=[];return;}tkErr=null;myTk=r.data||[];}
function tkItem(t){
  const evn=t.event_id&&cal.tid===(team&&team.id)?cal.ev.find(e=>e.id===t.event_id):null,ts=tkTs(t),late=!t.done&&ts!=null&&ts<Date.now();
  const canTog=t.created_by===user.id||t.assignee===user.id||(t.team_id&&view==="team"&&isAdminT()),canDel=t.created_by===user.id||(t.team_id&&view==="team"&&isAdminT());
  const due=t.due_date?dowOf(t.due_date)+" "+dm(parse(t.due_date))+(t.due_hour!=null?" · "+t.due_hour+":00":""):"";
  return `<div class="tki ${t.done?"done":""}"><input type="checkbox" data-tkd="${t.id}" ${t.done?"checked":""} ${canTog?"":"disabled"} aria-label="Hoàn thành"><div class="sp"><div class="tkt">${esc(t.title)}</div>
   <div class="mut" style="font-size:12px">${due?`<span class="${late?"warn":""}">⏰ ${due}${late?" · quá hạn":""}</span>`:"Không có hạn"}${t.assignee_name&&tkScope()==="team"?" · 👤 "+esc(t.assignee_name):""}${t.team_id&&tkScope()==="me"?" · 👥 việc nhóm":""}${evn?" · 📅 "+esc(evn.title):""}</div></div>${canDel?`<button class="nx" data-tkx="${t.id}" title="Xóa">×</button>`:""}</div>`;}
function tkInner(){
  const sc=tkScope(),err=sc==="team"?cal.err:tkErr;
  if(err)return `<div class="mut">⚠️ ${esc(dbErr({message:err}))}</div>`;
  const L=tkList(),open=L.filter(t=>!t.done).sort(tkCmp),done=L.filter(t=>t.done).sort((a,b)=>String(b.done_at||"").localeCompare(String(a.done_at||""))).slice(0,8);
  const canAdd=sc==="me"||canEditTeam();
  const form=canAdd?`<div class="tkf"><input id="xtt" maxlength="200" placeholder="Thêm công việc…">
   <div class="row"><input type="date" id="xtd" value="${selDate||""}"><select id="xth" class="xs"><option value="">Cả ngày</option>${hrOpts(0,23,-1)}</select></div>
   ${sc==="team"?`<select id="xta" class="xs"><option value="">Chưa giao cho ai</option>${members.map(m=>`<option value="${m.user_id}">👤 ${esc(m.name)}</option>`).join("")}</select>
   <select id="xte" class="xs"><option value="">Không gắn sự kiện</option>${cal.ev.map(e=>`<option value="${e.id}">📅 ${esc(e.title)} · ${dm(parse(e.event_date))}</option>`).join("")}</select>`:""}
   <button class="p" id="xtadd" type="button">＋ Thêm công việc</button></div>`:viewerNote();
  return form+`<div class="tkl">${open.length?open.map(tkItem).join(""):"<span class='mut'>Chưa có công việc nào đang mở.</span>"}${done.length?`<div class="tkh">Đã hoàn thành</div>`+done.map(tkItem).join(""):""}</div>`;}
const taskCard=()=>`<aside class="card side notes" id="xtkc"><h2>✅ ${tkScope()==="team"?"Công việc của nhóm":"Công việc của tôi"}</h2>${tkInner()}</aside>`;
function paintTasks(){const c=$("xtkc");if(!c)return;const keep=$("xtt")?$("xtt").value:"";
  c.innerHTML=`<h2>✅ ${tkScope()==="team"?"Công việc của nhóm":"Công việc của tôi"}</h2>`+tkInner();if(keep&&$("xtt"))$("xtt").value=keep;}
async function refreshTasks(){
  if(tkScope()==="team"){await loadCal();if(tview==="cal")drawTeam();else paintTasks();}
  else{await loadMyTasks();paintTasks();}}
function bindTasks(){
  const c=$("xtkc");if(!c)return;
  c.onclick=async ev=>{
    if(ev.target.closest("#xtadd"))return addTask();
    const x=ev.target.closest("[data-tkx]");
    if(x){const t=tkList().find(z=>z.id===x.dataset.tkx);if(!t||!confirm("Xóa công việc \""+t.title+"\"?"))return;
      const r=await SB.from("tasks").delete().eq("id",t.id).select();if(r.error)return say("Lỗi: "+dbErr(r.error));
      if(!(r.data||[]).length)return say("Bạn không có quyền xóa công việc này.");return refreshTasks();}};
  c.onchange=async ev=>{const k=ev.target.closest("[data-tkd]");if(!k)return;
    const r=await SB.from("tasks").update({done:k.checked}).eq("id",k.dataset.tkd).select();
    if(r.error||!(r.data||[]).length){k.checked=!k.checked;return say("Lỗi: "+(r.error?dbErr(r.error):"Bạn không có quyền đổi trạng thái công việc này."));}
    refreshTasks();};
  c.onkeydown=ev=>{if(ev.key==="Enter"&&!ev.isComposing&&ev.target.id==="xtt"){ev.preventDefault();addTask();}};}
async function addTask(){
  const t=$("xtt").value.trim();if(!t)return say("Hãy nhập tên công việc.");
  const sc=tkScope(),d=$("xtd").value||null,h=$("xth").value,row={title:t,due_date:d,due_hour:d&&h!==""?+h:null,created_by:user.id};
  if(sc==="team"){row.team_id=team.id;const a=$("xta").value;if(a){row.assignee=a;row.assignee_name=(members.find(m=>m.user_id===a)||{}).name||null;}const e=$("xte").value;if(e)row.event_id=e;}
  else{row.team_id=null;row.assignee=user.id;row.assignee_name=uname();}
  const btn=$("xtadd");btn.disabled=true;
  const r=await SB.from("tasks").insert(row);btn.disabled=false;
  if(r.error)return say("Lỗi: "+dbErr(r.error));
  say("✓ Đã thêm công việc");$("xtt").value="";await refreshTasks();}

/* ---------- phòng họp & tài nguyên ---------- */
const roomBk=(room,k)=>{const[d,h]=k.split("|");return cal.bk.find(x=>x.room_id===room&&x.booking_date===d&&+h>=x.start_hour&&+h<x.end_hour);};
function roomCell(k){
  const b=roomBk(roomSel,k),s=bkSel.has(k)?" sel":"";
  if(!b)return{cls:s.trim()};
  const h=+k.split("|")[1];
  return{cls:"busy"+s,txt:h===b.start_hour?(b.title||b.booked_by_name):"",tip:(b.title||"Đã đặt")+" · "+b.booked_by_name+" · "+b.start_hour+":00–"+b.end_hour+":00"+(b.event_id?" · theo sự kiện":"")};}
function roomCtx(){return{cell:roomCell,start:k=>{bkA=k;return k},apply:k=>bkSelect(k)};}
function bkSelect(k){
  if(!bkA||!$("xbd"))return;
  const[d1,h1]=bkA.split("|"),[d2,h2]=k.split("|");let s=+h1,e=+h1+1;
  if(d1===d2){s=Math.min(+h1,+h2);e=Math.max(+h1,+h2)+1;}
  const old=bkSel;bkSel=new Set();for(let h=s;h<e;h++)bkSel.add(K(d1,h));
  $("xbd").value=d1;$("xbs").value=s;$("xbe").value=e;
  [...old,...bkSel].forEach(x=>refreshCell(x,true));}
function roomPane(){
  if(cal.err)return `<div class="ptop">${navBar()}</div>${calErrBox()}`;
  if(!cal.rooms.length)return `<div class="ptop">${navBar()}</div><div class="mut" style="padding:14px">Nhóm chưa có phòng hoặc tài nguyên nào. ${isAdminT()?"Hãy thêm ở cột bên trái.":"Nhờ nhóm trưởng hoặc quản trị viên thêm."}</div>`;
  if(!cal.rooms.some(r=>r.id===roomSel))roomSel=cal.rooms[0].id;
  return `<div class="ptop">${navBar()}<span class="sp"></span><select id="xrs" class="xs">${cal.rooms.map(r=>`<option value="${r.id}" ${r.id===roomSel?"selected":""}>${r.kind==="equipment"?"🔧":"🏢"} ${esc(r.name)}</option>`).join("")}</select>${legend()}</div>${grid(k=>ctx.cell(k))}`;}
function roomSide(){
  if(!cal.rooms.some(r=>r.id===roomSel))roomSel=cal.rooms.length?cal.rooms[0].id:null;
  const rm=cal.rooms.find(r=>r.id===roomSel);
  const book=canEditTeam()&&rm?`<h3>Đặt: ${esc(rm.name)}</h3><p class="mut" style="margin:0;font-size:12px">Bấm hoặc kéo trên lịch để chọn giờ, hoặc nhập tay. Hệ thống tự chặn đặt trùng.</p>
   <input type="date" id="xbd" value="${selDate||fmt(new Date())}"><div class="row"><select id="xbs" class="xs">${hrOpts(0,23,9)}</select><span>→</span><select id="xbe" class="xs">${hrOpts(1,24,10)}</select></div>
   <input id="xbt" maxlength="100" placeholder="Mục đích (không bắt buộc)"><button class="p" id="xbgo" type="button">Đặt chỗ</button>`:(canEditTeam()?"":viewerNote());
  const list=`<h3>Danh sách phòng &amp; tài nguyên</h3><div class="rmlist">${cal.rooms.length?cal.rooms.map(r=>`<div class="mrow"><span class="mn">${r.kind==="equipment"?"🔧":"🏢"} ${esc(r.name)}${r.capacity?` <small class="mut">· ${r.capacity} chỗ</small>`:""}${r.note?`<div class="mut" style="font-size:12px;white-space:normal">${esc(r.note)}</div>`:""}</span>${isAdminT()?`<button class="pa dg" data-rmr="${r.id}" title="Xóa">✕</button>`:""}</div>`).join(""):"<span class='mut'>Chưa có phòng nào.</span>"}</div>`;
  const add=isAdminT()?`<h3>Thêm phòng / tài nguyên</h3><input id="xrn" maxlength="60" placeholder="Tên (VD: Phòng họp 1, Máy chiếu)"><div class="row"><select id="xrk" class="xs"><option value="room">🏢 Phòng</option><option value="equipment">🔧 Thiết bị</option></select><input id="xrc" type="number" min="1" max="999" placeholder="Sức chứa" style="width:110px"></div><input id="xrt" maxlength="200" placeholder="Ghi chú (không bắt buộc)"><button id="xradd" type="button">＋ Thêm</button>`:"";
  return book+list+add;}
function bookCard(){
  const L=cal.bk.slice().sort((a,b)=>a.booking_date.localeCompare(b.booking_date)||a.start_hour-b.start_hour);
  return `<aside class="card side notes" id="xbkc"><h2>🗓️ Lịch đặt trong tuần</h2><div class="nl">${cal.err?`<span class="mut">⚠️ ${esc(dbErr({message:cal.err}))}</span>`:L.length?L.map(b=>{const r=cal.rooms.find(x=>x.id===b.room_id),can=!b.event_id&&(b.booked_by===user.id||isAdminT());
    return `<div class="ni" style="cursor:default"><i class="dot"></i><div class="nt"><b>${dowOf(b.booking_date)} ${dm(parse(b.booking_date))} · ${b.start_hour}:00–${b.end_hour}:00</b><div>${r?(r.kind==="equipment"?"🔧 ":"🏢 ")+esc(r.name):"Phòng đã xóa"}${b.title?" · "+esc(b.title):""}</div><div class="mut">${esc(b.booked_by_name)}${b.event_id?" · theo sự kiện":""}</div></div>${can?`<button class="nx" data-bkx="${b.id}" title="Hủy đặt">×</button>`:""}</div>`;}).join(""):"<span class='mut'>Tuần này chưa có lịch đặt nào.</span>"}</div></aside>`;}
function bindRoom(){
  const rs=$("xrs");if(rs)rs.onchange=()=>{roomSel=rs.value;bkSel=new Set();drawTeam();};
  const g=$("xbgo");if(g)g.onclick=addBooking;
  const a=$("xradd");if(a)a.onclick=addRoom;
  const side=document.querySelector(".split .side");
  if(side)side.onclick=ev=>{const x=ev.target.closest("[data-rmr]");if(x)delRoom(x.dataset.rmr);};
  const bc=$("xbkc");if(bc)bc.onclick=ev=>{const x=ev.target.closest("[data-bkx]");if(x)delBooking(x.dataset.bkx);};}
async function addBooking(){
  const d=$("xbd").value,s=+$("xbs").value,e=+$("xbe").value,t=$("xbt").value.trim();
  if(!roomSel)return say("Hãy chọn phòng.");if(!d)return say("Hãy chọn ngày.");if(e<=s)return say("Giờ kết thúc phải sau giờ bắt đầu.");
  const btn=$("xbgo");btn.disabled=true;
  const r=await SB.from("bookings").insert({team_id:team.id,room_id:roomSel,booked_by:user.id,booked_by_name:uname(),title:t,booking_date:d,start_hour:s,end_hour:e});
  btn.disabled=false;if(r.error)return say("Lỗi: "+dbErr(r.error));
  say("✓ Đã đặt chỗ");bkSel=new Set();await showDate(d);}
async function delBooking(id){
  if(!confirm("Hủy lịch đặt này?"))return;
  const r=await SB.from("bookings").delete().eq("id",id).select();if(r.error)return say("Lỗi: "+dbErr(r.error));
  if(!(r.data||[]).length)return say("Bạn không có quyền hủy lịch đặt này.");
  say("✓ Đã hủy lịch đặt");await loadCal();drawTeam();}
async function addRoom(){
  const n=$("xrn").value.trim();if(!n)return say("Hãy nhập tên phòng / tài nguyên.");const c=$("xrc").value.trim();
  const r=await SB.from("rooms").insert({team_id:team.id,name:n,kind:$("xrk").value,capacity:c?Math.max(1,Math.min(999,+c)):null,note:$("xrt").value.trim().slice(0,200)});
  if(r.error)return say("Lỗi: "+dbErr(r.error));say("✓ Đã thêm");await loadCal();drawTeam();}
async function delRoom(id){
  const rm=cal.rooms.find(r=>r.id===id);if(!rm||!confirm("Xóa \""+rm.name+"\"?\n\nToàn bộ lịch đặt của phòng này cũng bị xóa."))return;
  const r=await SB.from("rooms").delete().eq("id",id).select();if(r.error)return say("Lỗi: "+dbErr(r.error));
  if(!(r.data||[]).length)return say("Bạn không có quyền xóa phòng này.");
  if(roomSel===id)roomSel=null;say("✓ Đã xóa");await loadCal();drawTeam();}

/* ---------- vai trò thành viên (Quản trị / Thành viên / Chỉ xem) ---------- */
function renderMembers(){const el=$("ml");if(!el||!team)return;const q=($("mq").value||"").trim().toLowerCase(),done=members.filter(m=>m.done).length;
  $("mh").textContent="👥 Thành viên ("+members.length+")";$("ms").textContent=team.name+" · đã chốt "+done+"/"+members.length+" · vai trò của bạn: "+ROLE_VI[myRole()];
  const list=members.filter(m=>(m.name||"").toLowerCase().includes(q)).sort((a,b)=>(+(b.user_id===team.owner)-+(a.user_id===team.owner))||(+!!a.done-+!!b.done)||(a.name||"").localeCompare(b.name||"","vi"));
  const iAmOwner=myRole()==="owner";
  el.innerHTML=list.length?list.map(m=>{
    const isOwn=m.user_id===team.owner,role=isOwn?"owner":(m.role||"member"),self=m.user_id===user.id;
    const manage=isAdminT()&&!isOwn&&!self&&(iAmOwner||role!=="admin");
    const roleUi=isOwn?`<span class="chip lead">👑 Nhóm trưởng</span>`:manage?`<select class="rsel" data-role="${m.user_id}" title="Đổi vai trò">${(iAmOwner?["admin","member","viewer"]:["member","viewer"]).map(r=>`<option value="${r}" ${r===role?"selected":""}>${ROLE_VI[r]}</option>`).join("")}</select>`:`<span class="chip">${ROLE_VI[role]}</span>`;
    return `<div class="mrow"><span class="av">${esc((m.name||"?").trim().charAt(0).toUpperCase())}</span><span class="mn">${esc(m.name)}${self?" <small class='mut'>(Bạn)</small>":""}</span>${roleUi}<span class="chip ${m.done?"ok":""}">${m.done?"✓ Đã chốt":"… Chưa chốt"}</span>${manage?`<button class="pa dg" data-rmv="${m.user_id}" title="Xóa khỏi nhóm">✕</button>`:""}</div>`;}).join(""):"<div class='mut' style='padding:12px'>Không tìm thấy thành viên.</div>";
  el.onchange=async ev=>{const s=ev.target.closest("[data-role]");if(!s)return;
    const r=await SB.rpc("set_member_role",{p_team:team.id,p_user:s.dataset.role,p_role:s.value});
    if(r.error){say("Lỗi: "+dbErr(r.error));return loadTeam(false);}
    say("✓ Đã đổi vai trò");await loadTeam(false);};
  el.onclick=async ev=>{const b=ev.target.closest("[data-rmv]");if(!b)return;
    const m=members.find(x=>x.user_id===b.dataset.rmv);if(!m||!confirm("Xóa \""+m.name+"\" khỏi nhóm?\n\nLịch bận của người này trong nhóm sẽ bị xóa."))return;
    const r=await SB.rpc("remove_member",{p_team:team.id,p_user:m.user_id});
    if(r.error)return say("Lỗi: "+dbErr(r.error));say("✓ Đã xóa thành viên");await loadTeam(false);};}

/* ---------- bình chọn nâng cao: hạn chót · ẩn danh · giới hạn phiếu ---------- */
const pExpired=p=>!!p.closes_at&&new Date(p.closes_at)<=new Date();
const pClosed=p=>!!p.closed||pExpired(p);
const pCnt=(p,o)=>p.anonymous&&p.tally?(p.tally[o.id]||0):(p.poll_votes||[]).filter(v=>v.option_id===o.id).length;
const pVoters=p=>p.anonymous&&p.tally?(p.voters_n||0):new Set((p.poll_votes||[]).map(v=>v.user_id)).size;
const pTotal=p=>(p.poll_options||[]).reduce((a,o)=>a+pCnt(p,o),0);
async function fetchPolls(){
  const r=await SB.from("polls").select("*,poll_options(id,label,position),poll_votes(option_id,user_id)").eq("team_id",team.id).order("created_at",{ascending:false});
  if(r.error){pollErr=r.error.message;polls=[];return false;}polls=r.data||[];return true;}
async function loadPolls(){polls=[];pollErr=null;if(!team)return;
  if(!await fetchPolls())return;
  if(polls.some(p=>!p.closed&&pExpired(p))){const s=await SB.rpc("sweep_team_polls",{p_team:team.id});if(!s.error)await fetchPolls();}
  if(polls.some(p=>p.anonymous)){const t=await SB.rpc("poll_tally",{p_team:team.id});
    if(!t.error){const by={};(t.data||[]).forEach(x=>{(by[x.poll_id]=by[x.poll_id]||{tally:{},voters:0}).tally[x.option_id]=x.votes;by[x.poll_id].voters=x.voters;});
      polls.forEach(p=>{if(p.anonymous){const z=by[p.id]||{tally:{},voters:0};p.tally=z.tally;p.voters_n=z.voters;}});}}}
function pollCard(p){
  const opts=[...(p.poll_options||[])].sort((a,b)=>a.position-b.position),votes=p.poll_votes||[],total=pTotal(p),voters=pVoters(p),cl=pClosed(p),anon=!!p.anonymous;
  const myV=new Set(votes.filter(v=>v.user_id===user.id).map(v=>v.option_id)),max=Math.max(0,...opts.map(o=>pCnt(p,o)));
  const nm=id=>(members.find(m=>m.user_id===id)||{}).name||"?";
  const info=[esc(p.created_by_name||""),p.multi?"chọn nhiều"+(p.max_votes?" (tối đa "+p.max_votes+")":""):"chọn một",voters+"/"+members.length+" người đã vote"];
  if(anon)info.push("🙈 ẩn danh");if(p.closes_at)info.push((cl?"đã hết hạn ":"hạn ")+dt(p.closes_at));
  return `<div class="pcard ${cl?"closed":""}" data-p="${p.id}"><div class="row"><h3 class="sp">${esc(p.title)}</h3><span class="tag ${cl?"":"open"}">${cl?"Đã đóng":"Đang mở"}</span></div>
  <div class="pmeta">${info.join(" · ")}</div>
  ${opts.map(o=>{const c=pCnt(p,o),pc=total?Math.round(c/total*100):0,names=anon?[]:votes.filter(v=>v.option_id===o.id).map(v=>nm(v.user_id));
   return `<button class="popt ${myV.has(o.id)?"on":""} ${c&&c===max?"lead":""}" data-o="${o.id}"><span class="fill" style="width:${pc}%"></span><span class="in2"><span>${myV.has(o.id)?"✓ ":""}${esc(o.label)}</span><span class="cnt">${c} phiếu · ${pc}%</span></span></button>${names.length?`<div class="pvoters" title="${esc(names.join(", "))}">${esc(names.slice(0,4).join(", "))}${names.length>4?" +"+(names.length-4):""}</div>`:""}`}).join("")}
  ${p.created_by===user.id?`<div class="row"><button class="pa" data-a="close">${cl?"Mở lại":"Đóng bình chọn"}</button><button class="pa" data-a="del">Xóa</button></div>`:""}</div>`;}
function votePane(){
  const open=polls.filter(x=>!pClosed(x));
  const body=pollErr?`<div class="mut" style="padding:8px">⚠️ Chưa tải được bình chọn: ${esc(pollErr)}.<br>Hãy chạy file <b>setup_vote.sql</b> trong Supabase → SQL Editor để tạo bảng bình chọn.</div>`
   :!open.length?`<div class="mut" style="padding:8px">Chưa có bình chọn nào đang mở. ${canEditTeam()?"Bấm “＋ Tạo bình chọn” ở cột trái để bắt đầu.":""}${polls.length?" Các bình chọn đã đóng nằm ở thẻ <b>Lịch sử vote</b> bên phải.":""}</div>`
   :`<div class="polls" id="pl">${open.map(pollCard).join("")}</div>`;
  return `<div class="ptop"><h2 style="margin:0;font-size:17px">🗳️ Bình chọn của nhóm</h2><span class="sp"></span><span class="mut">${open.length} đang mở</span></div>${body}`;}
async function castVote(pid,oid){
  const p=polls.find(x=>x.id===pid);if(!p)return;if(pClosed(p))return say("Bình chọn này đã đóng hoặc hết hạn.");
  const mv=(p.poll_votes||[]).filter(v=>v.user_id===user.id).map(v=>v.option_id);let r;
  if(mv.includes(oid))r=await SB.from("poll_votes").delete().eq("option_id",oid).eq("user_id",user.id);
  else{
    if(p.multi&&p.max_votes&&mv.length>=p.max_votes)return say("Chỉ được chọn tối đa "+p.max_votes+" phương án. Hãy bỏ một lựa chọn trước.");
    if(!p.multi&&mv.length){r=await SB.from("poll_votes").delete().eq("poll_id",pid).eq("user_id",user.id);if(r.error)return say("Lỗi: "+r.error.message);}
    r=await SB.from("poll_votes").insert({poll_id:pid,option_id:oid,user_id:user.id});}
  if(r.error)return say("Lỗi: "+dbErr(r.error));await loadTeam(false);}
async function pollAction(pid,a){
  let r,msg="";
  if(a==="close"){const p=polls.find(x=>x.id===pid),cl=pClosed(p);
    r=await SB.from("polls").update(cl?{closed:false,closes_at:null}:{closed:true}).eq("id",pid);
    msg=cl?"✓ Đã mở lại bình chọn (bỏ hạn chót)":"✓ Đã đóng. Bình chọn được lưu vào Lịch sử vote";}
  else{if(!confirm("Xóa bình chọn này?"))return false;r=await SB.from("polls").delete().eq("id",pid);msg="✓ Đã xóa bình chọn";}
  if(r.error){say("Lỗi: "+dbErr(r.error));return false;}
  await loadTeam(false);say(msg);return true;}
function resultOf(p){const opts=p.poll_options||[];if(!pTotal(p))return "Chưa có phiếu nào";
  const max=Math.max(...opts.map(o=>pCnt(p,o))),top=opts.filter(o=>pCnt(p,o)===max);
  return (top.length>1?"Hòa: ":"🏆 ")+top.map(o=>o.label).join(", ")+" ("+max+" phiếu)";}
function historyCard(){
  const cl=polls.filter(pClosed);
  return `<aside class="card side notes"><h2>🕘 Lịch sử vote</h2><div class="nl" id="hl">${
   pollErr?"<span class='mut'>Chưa tải được dữ liệu bình chọn.</span>"
   :cl.length?cl.map(p=>{const vt=pVoters(p),end=p.closed_at||p.closes_at;
     return `<div class="ni hi" data-h="${p.id}"><div class="nt"><b>${esc(p.title)}</b>${p.anonymous?" <span class='tag'>🙈 ẩn danh</span>":""}<div class="mut">${esc(p.created_by_name||"")} · ${vt} người vote</div><div class="mut">Tạo: ${dt(p.created_at)}</div><div class="mut">Đóng: ${end?dt(end):"không rõ"}</div><div class="res">${esc(resultOf(p))}</div></div><button class="pa" data-h="${p.id}">Xem lại</button></div>`}).join("")
   :"<span class='mut'>Chưa có bình chọn nào được đóng. Khi đóng, bình chọn sẽ được lưu ở đây để xem lại.</span>"}</div></aside>`;}
function reviewHtml(p){
  const opts=[...(p.poll_options||[])].sort((a,b)=>a.position-b.position),votes=p.poll_votes||[],total=pTotal(p),voted=new Set(votes.map(v=>v.user_id)),anon=!!p.anonymous,cl=pClosed(p),end=p.closed_at||p.closes_at;
  const nm=id=>(members.find(m=>m.user_id===id)||{}).name||"(đã rời nhóm)",not=anon?[]:members.filter(m=>!voted.has(m.user_id)).map(m=>m.name);
  return `<div class="pmeta" style="margin:8px 0 12px">${esc(p.created_by_name||"")} · Tạo ${dt(p.created_at)}${cl?" · Đóng "+(end?dt(end):"không rõ"):""} · ${p.multi?"chọn nhiều":"chọn một"} · ${pVoters(p)}/${members.length} người đã vote${anon?" · 🙈 ẩn danh":""} · <span class="tag ${cl?"":"open"}">${cl?"Đã đóng":"Đang mở"}</span></div>
   ${opts.map(o=>{const c=pCnt(p,o),pc=total?Math.round(c/total*100):0,vs=votes.filter(v=>v.option_id===o.id);
     return `<div class="popt"><span class="fill" style="width:${pc}%"></span><span class="in2"><span>${esc(o.label)}</span><span class="cnt">${c} phiếu · ${pc}%</span></span></div>${anon?"":`<div class="pvoters">${c?"Đã chọn: "+vs.map(v=>esc(nm(v.user_id))).join(", "):"Chưa có ai chọn"}</div>`}`}).join("")}
   ${anon?`<div class="pmeta" style="margin-top:6px">Bình chọn ẩn danh: hệ thống không lưu lộ ai đã chọn phương án nào.</div>`:""}
   ${not.length?`<div class="pmeta" style="margin-top:6px">Chưa vote: ${esc(not.join(", "))}</div>`:""}
   ${p.created_by===user.id?`<div class="row" style="margin-top:14px"><button class="pa" data-a="close">${cl?"Mở lại bình chọn":"Đóng bình chọn"}</button><button class="pa" data-a="del">Xóa</button></div>`:""}`;}
function openPollForm(){if(!canEditTeam())return say("Vai trò Chỉ xem không tạo được bình chọn.");
  $("pt").value="";$("po").innerHTML="";addOpt("");addOpt("");$("pmu").checked=false;$("pdl").value="";$("pan").checked=false;$("pmx").value="";$("pmxr").hidden=true;$("pcm").hidden=false;$("pt").focus();}
async function submitPoll(){
  const title=$("pt").value.trim(),opts=[...new Set([...document.querySelectorAll("#po .po")].map(i=>i.value.trim()).filter(Boolean))];
  if(!title)return say("Hãy nhập tiêu đề bình chọn.");if(opts.length<2)return say("Cần ít nhất 2 phương án khác nhau.");
  const row={team_id:team.id,title,multi:$("pmu").checked,created_by:user.id,created_by_name:uname()};
  if($("pdl").value){const d=new Date($("pdl").value);if(isNaN(d))return say("Hạn chót không hợp lệ.");if(d<=new Date())return say("Hạn chót phải ở tương lai.");row.closes_at=d.toISOString();}
  if($("pan").checked)row.anonymous=true;
  const mx=parseInt($("pmx").value,10);if($("pmu").checked&&mx>0){if(mx>=opts.length)say("Giới hạn phiếu lớn hơn hoặc bằng số phương án nên sẽ không có tác dụng.");row.max_votes=mx;}
  $("pgo").disabled=true;
  const r=await SB.from("polls").insert(row).select().single();
  if(r.error){$("pgo").disabled=false;return say("Lỗi: "+dbErr(r.error));}
  const r2=await SB.from("poll_options").insert(opts.map((label,i)=>({poll_id:r.data.id,label,position:i})));
  $("pgo").disabled=false;
  if(r2.error){await SB.from("polls").delete().eq("id",r.data.id);return say("Lỗi: "+r2.error.message);}
  $("pcm").hidden=true;say("✓ Đã tạo bình chọn");await loadTeam(false);}
async function autoClosePolls(){
  const L=polls.filter(p=>!pClosed(p)&&p.created_by===user.id&&members.length>1&&pVoters(p)>=members.length);
  for(const p of L){const r=await SB.from("polls").update({closed:true}).eq("id",p.id);if(r.error)continue;p.closed=true;
    const opts=p.poll_options||[],mx=Math.max(0,...opts.map(o=>pCnt(p,o))),win=opts.filter(o=>pCnt(p,o)===mx&&mx>0);
    const t="🗳️ Bình chọn “"+p.title+"” đã tự động chốt vì cả nhóm đã bỏ phiếu. Kết quả: "+(win.length?win.map(o=>o.label).join(" / ")+" ("+mx+" phiếu)":"chưa có phương án nào được chọn");
    const m=await SB.from("team_messages").insert({team_id:team.id,user_id:user.id,user_name:uname(),content:t.slice(0,500)}).select().single();
    if(!m.error&&!chatMsgs.find(x=>x.id===m.data.id))chatMsgs.push(m.data);
    say("✓ Bình chọn “"+p.title+"” đã tự động chốt");}}

/* ---------- liên kết chia sẻ SỐNG (token · hạn dùng · thu hồi) ---------- */
const liveUrl=t=>location.origin+location.pathname+"#live="+t;
function openLiveShares(scope){
  if(scope==="team"&&!isAdminT())return say("Chỉ nhóm trưởng hoặc quản trị viên tạo được liên kết chia sẻ nhóm.");
  openGm(scope==="team"?"🔗 Liên kết sống · "+team.name:"🔗 Liên kết sống · lịch cá nhân",`<div id="xls" class="mut">Đang tải…</div>`);
  paintLive(scope);}
async function paintLive(scope){
  let q=SB.from("share_links").select("*").eq("owner",user.id).eq("scope",scope).order("created_at",{ascending:false});
  if(scope==="team")q=q.eq("team_id",team.id);
  const r=await q,el=$("xls");if(!el)return;
  if(r.error){el.innerHTML=`<div class="mut">⚠️ ${esc(dbErr(r.error))}</div>`;return;}
  const L=r.data||[],now=Date.now();
  const st=l=>l.revoked?["Đã thu hồi",""]:(l.expires_at&&new Date(l.expires_at)<=now?["Hết hạn",""]:["Đang hoạt động","open"]);
  el.className="";
  el.innerHTML=`<p class="mut" style="margin:0 0 6px">Người nhận mở liên kết là thấy lịch <b>luôn mới nhất</b>, <b>không cần đăng nhập</b>. Bạn thu hồi lúc nào là liên kết ngừng hoạt động ngay.${scope==="team"?" Liên kết nhóm chỉ hiện số người bận ở từng giờ, không hiện tên hay ghi chú.":""}</p>
   ${L.length?L.map(l=>{const s=st(l),on=s[1]==="open";return `<div class="lkrow ${on?"":"off"}" data-l="${l.token}"><div class="row"><b class="sp">${esc(l.name||"(không tên)")}</b><span class="tag ${s[1]}">${s[0]}</span></div>
     <input readonly value="${esc(liveUrl(l.token))}" onfocus="this.select()"><div class="mut" style="font-size:12px">${l.views} lượt xem${scope==="personal"?" · "+(l.show_notes?"kèm ghi chú":"không kèm ghi chú"):""} · ${l.expires_at?"hết hạn "+dt(l.expires_at):"không hết hạn"}</div>
     <div class="row"><button class="pa" data-lc="${l.token}">📋 Sao chép</button>${on?`<a class="btn" style="padding:4px 10px;font-size:12px" target="_blank" rel="noopener" href="${esc(liveUrl(l.token))}">Mở thử</a>`:""}<button class="pa" data-lr="${l.token}" data-v="${l.revoked?0:1}">${l.revoked?"Kích hoạt lại":"Thu hồi"}</button><button class="pa dg" data-ld="${l.token}">Xóa</button></div></div>`}).join(""):"<div class='mut' style='margin:10px 0'>Chưa có liên kết nào.</div>"}
   <div class="lkx"><b>＋ Tạo liên kết mới</b><input id="xln" maxlength="40" placeholder="Tên hiển thị (VD: ${scope==="team"?esc(team.name):esc(uname())})" value="${esc(scope==="team"?team.name:uname())}">
    ${scope==="personal"?`<label class="row"><input type="checkbox" id="xlnotes"> Hiện cả ghi chú của từng giờ bận</label>`:""}
    <label class="row"><span>Hết hạn sau</span><select id="xlx" class="xs"><option value="">Không hết hạn</option><option value="1">1 ngày</option><option value="7">7 ngày</option><option value="30">30 ngày</option></select></label>
    <button class="p" id="xlgo" type="button">Tạo liên kết</button></div>`;
  el.onclick=async ev=>{
    const c=ev.target.closest("[data-lc]");if(c)return copyText(liveUrl(c.dataset.lc));
    const rv=ev.target.closest("[data-lr]");
    if(rv){const x=await SB.from("share_links").update({revoked:rv.dataset.v==="1"}).eq("token",rv.dataset.lr).select();
      if(x.error||!(x.data||[]).length)return say("Lỗi: "+(x.error?dbErr(x.error):"không cập nhật được"));say(rv.dataset.v==="1"?"✓ Đã thu hồi liên kết":"✓ Đã kích hoạt lại");return paintLive(scope);}
    const d=ev.target.closest("[data-ld]");
    if(d){if(!confirm("Xóa hẳn liên kết này? Người đang giữ liên kết sẽ không xem được nữa."))return;
      const x=await SB.from("share_links").delete().eq("token",d.dataset.ld);if(x.error)return say("Lỗi: "+dbErr(x.error));say("✓ Đã xóa liên kết");return paintLive(scope);}
    if(ev.target.closest("#xlgo")){
      const days=$("xlx").value,row={owner:user.id,scope,name:$("xln").value.trim().slice(0,40),show_notes:scope==="personal"&&$("xlnotes").checked};
      if(scope==="team")row.team_id=team.id;if(days)row.expires_at=new Date(Date.now()+days*864e5).toISOString();
      const x=await SB.from("share_links").insert(row).select().single();if(x.error)return say("Lỗi: "+dbErr(x.error));
      copyText(liveUrl(x.data.token));return paintLive(scope);}};}
/* trang xem liên kết sống: không cần đăng nhập */
async function liveStart(){
  let tok="";try{tok=decodeURIComponent(location.hash.slice(6)).trim()}catch(e){}
  const LS=supabase.createClient(SUPABASE_URL.trim(),SUPABASE_KEY.trim(),{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  weekStart=mondayOf(new Date());selDate="";let data=null,err=null,first=true;
  ctx={cell:()=>({cls:""})};
  const nav=()=>{const b=addD(weekStart,6);return `<div class='nav'><button id='lpw' title='Tuần trước'>‹</button><button id='ltd'>Hôm nay</button><button id='lnw' title='Tuần sau'>›</button><b>Tuần ${dm(weekStart)} – ${dm(b)}/${b.getFullYear()}</b></div>`;};
  const draw=()=>{
    if(first&&!data&&!err){$("app").innerHTML=`<div class="card">Đang tải lịch…</div>`;return;}
    if(err){$("app").innerHTML=`<div class="card"><b>Không tải được lịch.</b><div class="mut">${esc(dbErr({message:err}))}</div></div>`;return;}
    if(!data||!data.ok){$("app").innerHTML=`<div class="card"><h2>🔗 Liên kết không còn hiệu lực</h2><p class="mut">Liên kết này đã bị thu hồi, đã hết hạn hoặc không tồn tại. Hãy nhờ người chia sẻ gửi liên kết mới.</p><a class="btn" href="${esc(location.pathname)}">Mở Timesheet</a></div>`;return;}
    const team_=data.scope==="team",tot=data.total||0,m=new Map();(data.slots||[]).forEach(s=>m.set(K(s.d,s.h),team_?s.b:(s.n||"")));
    ctx={cell:k=>{
      if(team_){const b=m.get(k)||0;return b?{cls:"part",txt:(tot-b)+"/"+tot,tip:b+" người bận"}:{cls:"free",txt:"✓ "+tot+"/"+tot};}
      return m.has(k)?{cls:"busy"+(m.get(k)?" n"+hue(m.get(k)):""),txt:data.notes?m.get(k):"",tip:data.notes?m.get(k):""}:{cls:""};}};
    const legend_=team_?`<div class="legend"><span><i style="background:var(--free)"></i>Tất cả cùng rảnh</span><span><i style="background:var(--head);border:1px solid var(--bd)"></i>Có người bận (số = người rảnh/tổng)</span></div>`:`<div class="legend"><span><i style="background:var(--ac)"></i>Giờ bận</span><span><i style="background:var(--head);border:1px solid var(--bd)"></i>Giờ rảnh</span></div>`;
    $("app").innerHTML=`<div class="card"><div class="row"><h2 style="margin:0">🔗 ${team_?"Lịch nhóm":"Lịch của"} ${esc(data.name||"bạn bè")}</h2><span class="sp"></span><a class="btn" href="${esc(location.pathname)}">Mở Timesheet</a></div>
     <p class="mut" style="margin:6px 0 10px">Chỉ xem · tự cập nhật theo lịch mới nhất của người chia sẻ.</p><div class="ptop">${nav()}<span class="sp"></span>${legend_}</div>${grid(k=>ctx.cell(k))}</div>`;
    $("lpw").onclick=()=>{weekStart=addD(weekStart,-7);load()};$("lnw").onclick=()=>{weekStart=addD(weekStart,7);load()};$("ltd").onclick=()=>{weekStart=mondayOf(new Date());load()};};
  const load=async()=>{const[a,b]=wkRange();const r=await LS.rpc("get_shared_calendar",{p_token:tok,p_from:a,p_to:b});
    if(r.error){err=r.error.message;data=null;}else{err=null;data=r.data;}first=false;draw();};
  draw();await load();
  setInterval(()=>{if(document.visibilityState==="visible"&&data&&data.ok)load();},30000);}

/* ---------- thông báo đẩy khi đã đóng trang (web push) ---------- */
// Khóa công khai VAPID (tạo bằng: npx web-push generate-vapid-keys). Xem HUONG-DAN-V3.md
const VAPID_PUBLIC_KEY="BAYiNYal3u0PyKDesIH5q9QCzD0XkoRrw2DxvlqRf7_XY-G_fsdbrMoWBe2crBWrf2itAERshAtdxoFbV00bXvA";
const pushOk=()=>("serviceWorker" in navigator)&&("PushManager" in window)&&("Notification" in window);
const b64u=s=>{const p="=".repeat((4-s.length%4)%4),r=atob((s+p).replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from([...r].map(c=>c.charCodeAt(0)));};
async function pushSub(){try{const reg=await navigator.serviceWorker.getRegistration();return reg?await reg.pushManager.getSubscription():null;}catch(e){return null;}}
async function paintPush(){
  const el=$("xpush");if(!el)return;
  if(!pushOk()){el.innerHTML="<div class='mut'>Trình duyệt này không hỗ trợ thông báo đẩy. Trên iPhone/iPad: thêm Timesheet vào Màn hình chính rồi mở từ biểu tượng đó.</div>";return;}
  if(!window.isSecureContext){el.innerHTML="<div class='mut'>Thông báo đẩy chỉ hoạt động trên trang HTTPS.</div>";return;}
  const[sub,q]=await Promise.all([pushSub(),SB.from("push_prefs").select("*").maybeSingle()]);if(!$("xpush"))return;
  if(q.error){el.innerHTML=`<div class="mut">⚠️ ${esc(dbErr(q.error))}</div>`;return;}
  const pr=q.data||{lead_min:10,notify_events:true,notify_tasks:true,notify_slots:true},on=!!sub&&!!q.data&&q.data.enabled;
  el.className="";
  el.innerHTML=`<div class="pushbox"><div class="mut">Trạng thái: <b>${on?"đang bật trên thiết bị này":"chưa bật"}</b>${Notification.permission==="denied"?" · trình duyệt đang chặn thông báo (bật lại trong cài đặt trang web)":""}. Hệ thống nền gửi nhắc ngay cả khi bạn đã đóng trang.</div>
   <label class="row"><input type="checkbox" id="xpe" ${pr.notify_events?"checked":""}> Sự kiện nhóm đã mời tôi (trừ sự kiện đã từ chối)</label>
   <label class="row"><input type="checkbox" id="xpt" ${pr.notify_tasks?"checked":""}> Công việc đến hạn (không có giờ = 08:00)</label>
   <label class="row"><input type="checkbox" id="xps" ${pr.notify_slots?"checked":""}> Giờ bận trong lịch cá nhân</label>
   <div class="row"><span>Nhắc trước</span><select id="xpl" class="xs">${[5,10,15,30,60,120].map(n=>`<option value="${n}" ${n===pr.lead_min?"selected":""}>${n} phút</option>`).join("")}</select></div>
   <div class="row"><button class="p sp" id="xpon" type="button">${on?"Cập nhật":"Bật thông báo nền"}</button>${on?`<button id="xpoff" type="button">Tắt</button><button id="xptest" type="button">Gửi thử</button>`:""}</div></div>`;
  $("xpon").onclick=pushEnable;const o=$("xpoff");if(o)o.onclick=pushDisable;const t=$("xptest");if(t)t.onclick=pushTest;}
async function pushEnable(){
  if(VAPID_PUBLIC_KEY.startsWith("DAN_"))return say("Chưa cấu hình VAPID_PUBLIC_KEY cho tính năng thông báo nền.");
  const btn=$("xpon");btn.disabled=true;
  try{
    const perm=Notification.permission==="granted"?"granted":await Notification.requestPermission();
    if(perm!=="granted")throw new Error("Bạn chưa cấp quyền thông báo cho trình duyệt.");
    const reg=await navigator.serviceWorker.register("sw.js");await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(VAPID_PUBLIC_KEY)});
    const j=sub.toJSON();
    let r=await SB.rpc("register_push",{p_endpoint:j.endpoint,p_p256dh:j.keys.p256dh,p_auth:j.keys.auth});if(r.error)throw r.error;
    r=await SB.from("push_prefs").upsert({user_id:user.id,enabled:true,lead_min:+$("xpl").value,tz_offset_min:-new Date().getTimezoneOffset(),notify_events:$("xpe").checked,notify_tasks:$("xpt").checked,notify_slots:$("xps").checked},{onConflict:"user_id"});
    if(r.error)throw r.error;
    say("✓ Đã bật thông báo nền cho thiết bị này");
  }catch(e){say("Lỗi: "+dbErr(e));}
  paintPush();}
async function pushDisable(){
  try{const sub=await pushSub();
    if(sub){await SB.from("push_subs").delete().eq("endpoint",sub.endpoint);await sub.unsubscribe();}
    const r=await SB.from("push_prefs").update({enabled:false}).eq("user_id",user.id);if(r.error)throw r.error;
    say("Đã tắt thông báo nền trên thiết bị này");
  }catch(e){say("Lỗi: "+dbErr(e));}
  paintPush();}
async function pushTest(){
  try{const reg=await navigator.serviceWorker.getRegistration();if(!reg)throw new Error("Chưa đăng ký service worker.");
    await reg.showNotification("⏰ Thông báo thử",{body:"Thiết bị này nhận được thông báo của Timesheet."});}
  catch(e){say("Lỗi: "+(e.message||e));}}
if("serviceWorker" in navigator)navigator.serviceWorker.addEventListener("message",e=>{
  if(e.data&&e.data.type==="push")say("🔔 "+e.data.title+(e.data.body?" · "+e.data.body:""));});
