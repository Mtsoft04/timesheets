/* ---------- lịch cá nhân ---------- */
async function meView(){
  $("body").innerHTML="<div class='card'>Đang tải…</div>";
  const[a,b]=wkRange();
  const{data,error}=await SB.from("personal_slots").select("*").gte("slot_date",a).lte("slot_date",b);
  if(error){say("Lỗi tải: "+error.message);return;}
  mine=new Map((data||[]).map(r=>[K(r.slot_date,r.hour),r.note||""]));sel=new Set();pdirty=false;await Promise.all([loadMyTasks(),loadWorkLogs(),loadTimeOff()]);drawMe();
}
const NC=8,hue=n=>{let h=0;for(const c of n)h=(h*31+c.charCodeAt(0))>>>0;return 1+h%NC};
const QN=["🎯 Focus Time","🧱 Time Block","Đi làm","Đi học","Họp","Việc riêng","Nghỉ ngơi"];
let fillNote=null;
const store=()=>view==="team"?tmine:mine;                 // lịch đang chỉnh: cá nhân hoặc "bận của tôi" trong nhóm
const markDirty=()=>{if(view==="team")dirty=true;else pdirty=true};
const canEdit=()=>view!=="team"||(tview==="mine"&&team&&!me().done&&canEditTeam());
function noteBlocks(){const out=[],m=store();
  wkDates().forEach((dt,di)=>{const f=fmt(dt);let cur=null;
    for(let h=0;h<24;h++){const k=K(f,h),n=m.get(k);
      if(n){if(cur&&cur.note===n&&cur.e===h-1){cur.e=h;cur.keys.push(k);}else{cur={d:di,dt,s:h,e:h,note:n,keys:[k]};out.push(cur);}}else cur=null;}});
  return out;}
function updSel(){const e=$("sc");if(e)e.textContent="Đã chọn "+sel.size+" ô";}
function renderNotes(){renderSum();const el=$("nl");if(!el)return;const bl=noteBlocks(),ed=canEdit();
  el.innerHTML=bl.length?bl.map((b,i)=>`<div class="ni" data-i="${i}" style="${ed?"":"cursor:default"}"><i class="dot n${hue(b.note)}"></i><div class="nt"><b>${DAYS[b.d]} ${dm(b.dt)} · ${b.s}:00–${b.e+1}:00</b><div>${esc(b.note)}</div></div>${ed?`<button class="nx" data-x="1" title="Xóa ghi chú này">×</button>`:""}</div>`).join(""):"<span class='mut'>Chưa có ghi chú nào trong tuần này.</span>";
  if(!ed){el.onclick=null;return;}
  el.onclick=ev=>{const it=ev.target.closest(".ni");if(!it)return;const b=bl[+it.dataset.i],m=store();
    if(ev.target.closest("[data-x]")){b.keys.forEach(k=>m.set(k,""));markDirty();sel=new Set([...sel].filter(k=>!b.keys.includes(k)));redraw();return;}
    pmode="note";sel=new Set(b.keys);fillNote=b.note;redraw();};}
const redraw=()=>view==="team"?drawTeam():drawMe();
function noteSide(){
  const ed=canEdit();
  return (ed?`<div class="seg"><button id="m1" class="${pmode==="paint"?"on":""}">Tô giờ bận</button><button id="m2" class="${pmode==="note"?"on":""}">Ghi chú</button></div>
   ${pmode==="note"?`<div class="nbox"><p class="mut" style="margin:0">Kéo chọn các giờ liền nhau (hoặc bấm từng ô), nhập nội dung rồi bấm Gán. Chọn nhóm giờ khác để gán ghi chú khác.</p>
    <div class="qn">${QN.map(t=>`<button class="qb" data-q="${t}">${t}</button>`).join("")}</div>
    <input id="nt" maxlength="80" placeholder="Nội dung ghi chú cho các ô đã chọn">
    <div class="row"><button class="p sp" id="na">Gán ghi chú</button><button class="sp" id="nc">Xóa ghi chú</button></div>
    <div class="mut" id="sc">Đã chọn 0 ô</div></div>`
   :`<p class="mut" style="margin:0">Bấm hoặc kéo trên lịch để tô giờ bận. Chuyển sang “Ghi chú” để ghi chú riêng cho từng khung giờ.${view==="team"?" Mọi người trong nhóm thấy ghi chú khi rê chuột vào ô.":""}</p>`}`:"")
  ;}
function noteCard(){return `<aside class="card side notes"><h2>📝 Ghi chú trong tuần</h2><div class="nl" id="nl"></div></aside>`;}
function bindNotes(){
  renderNotes();updSel();if(!canEdit())return;
  $("m1").onclick=()=>{pmode="paint";sel=new Set();redraw()};$("m2").onclick=()=>{pmode="note";redraw()};
  if(pmode!=="note")return;
  document.querySelectorAll("[data-q]").forEach(b=>b.onclick=()=>{$("nt").value=b.dataset.q;$("nt").focus()});
  if(fillNote!==null){$("nt").value=fillNote;fillNote=null;}
  const assign=()=>{const t=$("nt").value.trim();if(!sel.size)return say("Hãy chọn ô trên lịch trước.");if(!t)return say("Hãy nhập nội dung ghi chú.");
    const n=sel.size,m=store();sel.forEach(k=>m.set(k,t));markDirty();sel=new Set();$("nt").value="";redraw();say("Đã gán ghi chú cho "+n+" ô. Nhớ bấm Lưu.")};
  $("na").onclick=assign;$("nt").onkeydown=e=>{if(e.key==="Enter")assign()};
  $("nc").onclick=()=>{if(!sel.size)return say("Hãy chọn ô cần xóa ghi chú.");const m=store();sel.forEach(k=>{if(m.has(k))m.set(k,"")});markDirty();sel=new Set();redraw();say("Đã xóa ghi chú. Nhớ bấm Lưu.")};
}
function drawMe(){
  const w0=document.querySelector(".wrap"),st=w0?w0.scrollTop:0;
  $("body").innerHTML=`<div class="split split4 big personal-layout">
   <aside class="card side personal-sidebar">
    <div class="personal-hero"><span class="personal-hero-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M4 10h16M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/></svg></span><div><h1>Lịch cá nhân</h1><p>Quản lý lịch làm việc, sự kiện của bạn</p></div></div>
    <div class="personal-mode">${noteSide()}</div>${quickPanel()}
    <div class="personal-primary-actions"><button class="p" id="sv">Lưu lịch cá nhân</button><button id="ap" title="Sao chép lịch cá nhân sang nhóm bạn chọn">⤴ Áp dụng lịch cá nhân vào nhóm</button></div>
    <div class="tools personal-tools"><button id="rp">🔁 Lặp lại</button><button id="an">📊 Phân tích</button><button id="rm">🔔 Nhắc lịch</button><button id="sh">🔗 Chia sẻ</button></div>${calendarSyncTools()}
   </aside>
   <section class="card pane personal-calendar"><div class="ptop">${navBar()}<span class="sp"></span>${legend()}</div>${grid(k=>ctx.cell(k))}</section>
   <div class="rcol personal-insights">${sumCard()}${noteCard()}</div>
   <div class="rcol personal-right-layout"><div class="personal-work-column">${timeLogCard()}${timeOffCard()}</div><div class="personal-task-column">${taskCard()}</div></div>
  </div>`;
  const w=document.querySelector(".wrap");if(w)w.scrollTop=st;
  bindNav();bindNotes();bindQuick();bindTasks();bindWorkLogs();bindTimeOff();bindCalendarSync();
  $("sv").onclick=()=>saveMe(false);$("ap").onclick=openApply;$("rp").onclick=openRepeat;$("an").onclick=openAnalytics;$("rm").onclick=openRemind;$("sh").onclick=openShare;
}
ctx={cell:()=>({cls:""})};
function cellOf(k){const m=store(),sl=sel.has(k)?" sel":"";
  const off=view==="team"?teamTimeOffCell(k):personalTimeOffCell(k);
  if(!m.has(k))return off?{...off,cls:off.cls+sl}:{cls:sl.trim()};
  const n=m.get(k),[d,h]=k.split("|"),first=!(+h>0&&n&&m.get(K(d,+h-1))===n);
  return{cls:"busy"+sl+(n?" n"+hue(n):"")+(off?" timeoff":""),txt:n&&first?n:off?.txt||"",tip:[n,off?.tip].filter(Boolean).join("\n")};}
function mkCtx(){return{cell:cellOf,
  start:k=>pmode==="paint"?!store().has(k):!sel.has(k),
  apply:(k,v)=>{const m=store();
    if(pmode==="paint"){v?(m.has(k)||m.set(k,"")):m.delete(k);markDirty();}
    else{v?sel.add(k):sel.delete(k);
      const nt=$("nt");if(v&&nt){const ns=new Set([...sel].map(x=>m.get(x)||""));if(ns.size===1){const only=[...ns][0];if(only)nt.value=only;}}
      updSel();}
    refreshCell(k);if(pmode==="paint")renderNotes();}};}
function setMeCtx(){ctx=mkCtx();}
async function saveMe(silent){
  if(!silent)say("Đang lưu…");
  const[a,b]=wkRange();
  let r=await SB.from("personal_slots").delete().eq("user_id",user.id).gte("slot_date",a).lte("slot_date",b);if(r.error)return say("Lỗi: "+r.error.message);
  const rows=[...mine].map(([k,note])=>{const[d,h]=k.split("|");return{user_id:user.id,slot_date:d,hour:+h,note}});
  if(rows.length){r=await SB.from("personal_slots").insert(rows);if(r.error)return say("Lỗi: "+r.error.message);}
  pdirty=false;remFetch=0;conf.key="";say(silent?"Đã tự lưu tuần vừa chỉnh":"✓ Đã lưu lịch cá nhân");
}

/* ---------- tổng hợp giờ nhanh · chọn khung giờ cố định ---------- */
const sumCard=()=>`<aside class="card side sumc"><h2>⏱️ Tổng hợp giờ nhanh</h2><div id="sm"></div></aside>`;
function renderSum(){const el=$("sm");if(!el)return;const m=store();let tb=0,rows="";
  wkDates().forEach((dt,i)=>{const f=fmt(dt);let b=0;for(let h=0;h<24;h++)if(m.has(K(f,h)))b++;tb+=b;
    rows+=`<tr><td>${DAYS[i]} <small class="mut">${dm(dt)}</small></td><td class="sb">${b}h</td><td class="sf">${24-b}h</td><td><span class="mini"><i style="width:${b/24*100}%"></i></span></td></tr>`;});
  el.innerHTML=`<table class="sumt"><tr><th>Ngày</th><th>Bận</th><th>Rảnh</th><th></th></tr>${rows}<tr class="tot"><td>Cả tuần</td><td class="sb">${tb}h</td><td class="sf">${168-tb}h</td><td></td></tr></table><div class="mut" style="margin-top:6px">🎯 Focus Time: <b>${[...m.values()].filter(n=>/^🎯/.test(n)).length}h</b></div>`;}
let qDays=new Set([0,1,2,3,4]),qBusy=true;
const QR=[["🌅 Sáng 6–12",6,12],["☀️ Chiều 12–18",12,18],["🌙 Tối 18–24",18,24],["🏢 Hành chính 8–17",8,17],["😴 Đêm 0–6",0,6],["📅 Cả ngày",0,24]];
function quickPanel(){if(!canEdit()||pmode!=="paint")return"";
  return `<div class="qk"><b>⚡ Chọn nhanh khung giờ</b>
   <div class="dchips">${DAYS.map((d,i)=>`<button class="dc ${qDays.has(i)?"on":""}" data-qd="${i}">${d.replace("Thứ ","T")}</button>`).join("")}</div>
   <div class="row"><button class="dc2 sp ${qBusy?"on":""}" id="qb1">Tô bận</button><button class="dc2 sp ${!qBusy?"on":""}" id="qb2">Bỏ tô</button></div>
   <select id="qn" title="Ghi chú tự gán cho ô tô nhanh (Time Blocking / Focus Time)"><option value="">Không ghi chú</option>${["🎯 Focus Time","🧱 Time Block","Họp","Đi làm","Đi học"].map(t=>`<option ${t===qNote?"selected":""}>${t}</option>`).join("")}</select><div class="qrs">${QR.map((r,i)=>`<button data-qr="${i}">${r[0]}</button>`).join("")}</div></div>`;}
function bindQuick(){
  document.querySelectorAll("[data-qd]").forEach(b=>b.onclick=()=>{const i=+b.dataset.qd;qDays.has(i)?qDays.delete(i):qDays.add(i);b.classList.toggle("on")});
  const qn=$("qn");if(qn)qn.onchange=()=>{qNote=qn.value};
  const a=$("qb1"),c=$("qb2");if(!a)return;
  a.onclick=()=>{qBusy=true;a.classList.add("on");c.classList.remove("on")};c.onclick=()=>{qBusy=false;c.classList.add("on");a.classList.remove("on")};
  document.querySelectorAll("[data-qr]").forEach(b=>b.onclick=()=>{
    if(!qDays.size)return say("Hãy chọn ít nhất một thứ.");
    const[,s0,e0]=QR[+b.dataset.qr],m=store();let n=0;
    wkDates().forEach((dt,i)=>{if(!qDays.has(i))return;const f=fmt(dt);for(let h=s0;h<e0;h++){const k=K(f,h);if(qBusy){if(!m.has(k)||(qNote&&m.get(k)!==qNote)){m.set(k,qNote);n++}}else if(m.has(k)){m.delete(k);n++}}});
    markDirty();redraw();say((qBusy?"Đã tô ":"Đã bỏ tô ")+n+" ô. Nhớ bấm Lưu.")});}

/* ---------- áp dụng lịch cá nhân vào nhóm ---------- */
async function openApply(){
  $("apm").hidden=false;$("apb").innerHTML="<p class='mut'>Đang tải danh sách nhóm…</p>";
  if(pdirty)await saveMe(true);                       // lưu phần vừa chỉnh để áp dụng bản mới nhất
  const[t,m]=await Promise.all([SB.from("teams").select("*").order("created_at"),SB.from("team_members").select("team_id,done").eq("user_id",user.id)]);
  if(t.error){$("apb").innerHTML="<p class='mut'>⚠️ Lỗi tải nhóm: "+esc(t.error.message)+"</p>";return;}
  const tl=t.data||[],dn=new Set((m.data||[]).filter(x=>x.done).map(x=>x.team_id));
  if(!tl.length){$("apb").innerHTML="<p class='mut'>Bạn chưa có nhóm nào. Hãy tạo nhóm hoặc tham gia bằng mã ở tab <b>Lịch đội nhóm</b> rồi quay lại đây.</p>";return;}
  const a=weekStart,b=addD(weekStart,6);
  $("apb").innerHTML=`<p class="mut" style="margin:8px 0 0">Sao chép giờ bận và ghi chú từ lịch cá nhân sang các nhóm bạn chọn, không cần soạn lại. Bạn vẫn xếp lịch riêng trong từng nhóm như bình thường.</p>
   <h3>Chọn nhóm</h3>
   <div class="aplist"><label class="aprow"><input type="checkbox" id="apall"><span class="apn"><b>Chọn tất cả</b></span></label>${tl.map(x=>`<label class="aprow"><input type="checkbox" class="apt" value="${x.id}" data-n="${esc(x.name)}"><span class="apn">${esc(x.name)}</span>${dn.has(x.id)?"<small>✓ đã chốt</small>":""}</label>`).join("")}</div>
   <h3>Phạm vi</h3>
   <label class="aprow opt"><input type="radio" name="apS" value="week" checked><span class="apn">Tuần đang xem <small>(${dm(a)} – ${dm(b)}/${b.getFullYear()})</small></span></label>
   <label class="aprow opt"><input type="radio" name="apS" value="all"><span class="apn">Tất cả các tuần đã soạn trong lịch cá nhân</span></label>
   <h3>Cách áp dụng</h3>
   <label class="aprow opt"><input type="radio" name="apM" value="merge" checked><span class="apn">Gộp thêm <small>(giữ nguyên các ô đã có trong nhóm, chỉ thêm ô còn thiếu)</small></span></label>
   <label class="aprow opt"><input type="radio" name="apM" value="replace"><span class="apn">Thay thế <small>(xóa lịch bận hiện có của tôi trong phạm vi đã chọn rồi dùng lịch cá nhân)</small></span></label>
   <p class="mut" style="margin:10px 0 0;font-size:12px">Nhóm nào bạn đã “chốt” vẫn giữ trạng thái chốt sau khi áp dụng.</p>
   <div class="row" style="margin-top:14px;justify-content:flex-end"><button id="apc">Hủy</button><button class="p" id="apg">Áp dụng</button></div>`;
  const cbs=[...document.querySelectorAll(".apt")];
  $("apall").onchange=e=>cbs.forEach(c=>c.checked=e.target.checked);
  cbs.forEach(c=>c.onchange=()=>{$("apall").checked=cbs.every(x=>x.checked)});
  $("apc").onclick=()=>{$("apm").hidden=true};$("apg").onclick=doApply;
}
async function doApply(){
  const sel2=[...document.querySelectorAll(".apt:checked")].map(x=>({id:x.value,name:x.dataset.n}));
  if(!sel2.length)return say("Hãy chọn ít nhất một nhóm.");
  const scope=document.querySelector("input[name=apS]:checked").value,mode=document.querySelector("input[name=apM]:checked").value;
  if(mode==="replace"&&scope==="all"&&!confirm("Thay thế TẤT CẢ các tuần: lịch bận hiện có của bạn ở "+sel2.length+" nhóm đã chọn sẽ bị xóa và thay bằng lịch cá nhân. Tiếp tục?"))return;
  const g=$("apg");g.disabled=true;g.textContent="Đang áp dụng…";
  const[a,b]=wkRange(),inScope=q=>scope==="week"?q.gte("slot_date",a).lte("slot_date",b):q;
  const page=async mk=>{let out=[],from=0;for(;;){const r=await mk().range(from,from+999);if(r.error)throw r.error;const d=r.data||[];out=out.concat(d);if(d.length<1000)return out;from+=1000;}};
  try{
    const src=await page(()=>inScope(SB.from("personal_slots").select("slot_date,hour,note").eq("user_id",user.id).order("slot_date").order("hour")));
    if(!src.length){say(scope==="week"?"Tuần này chưa có giờ bận nào trong lịch cá nhân.":"Lịch cá nhân đang trống.");return;}
    let ok=0,added=0,noNote=false;const fail=[];
    for(const t of sel2){
      try{
        let ex=new Set();
        if(mode==="replace"){const r=await inScope(SB.from("team_busy").delete().eq("team_id",t.id).eq("user_id",user.id));if(r.error)throw r.error;}
        else{const cur=await page(()=>inScope(SB.from("team_busy").select("slot_date,hour").eq("team_id",t.id).eq("user_id",user.id).order("slot_date").order("hour")));ex=new Set(cur.map(x=>K(x.slot_date,x.hour)));}
        const rows=src.filter(x=>!ex.has(K(x.slot_date,x.hour))).map(x=>({team_id:t.id,user_id:user.id,slot_date:x.slot_date,hour:x.hour,note:x.note||""}));
        for(let i=0;i<rows.length;i+=500){
          const chunk=rows.slice(i,i+500);let r=await SB.from("team_busy").insert(chunk);
          if(r.error&&/note/i.test(r.error.message)){noNote=true;r=await SB.from("team_busy").insert(chunk.map(({note,...x})=>x));}
          if(r.error)throw r.error;
        }
        added+=rows.length;ok++;
      }catch(e){fail.push(t.name+" ("+(e.message||e)+")");}
    }
    if(team&&sel2.some(t=>t.id===team.id))dirty=false;
    $("apm").hidden=!fail.length;
    say((ok?"✓ Đã áp dụng lịch cá nhân vào "+ok+" nhóm"+(mode==="merge"?" (thêm "+added+" ô mới)":""):"Không áp dụng được")+(noNote?" · chưa lưu được ghi chú: cần thêm cột note vào bảng team_busy":"")+(fail.length?" · Lỗi: "+fail.join("; "):""));
    if(fail.length){g.disabled=false;g.textContent="Áp dụng";}
  }catch(e){say("Lỗi: "+(e.message||e));}
  finally{if(!$("apm").hidden){g.disabled=false;g.textContent="Áp dụng";}}
}
