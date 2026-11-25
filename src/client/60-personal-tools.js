/* ===== Công cụ nâng cao: lặp lại · phân tích · nhắc lịch · chia sẻ · tự chốt bình chọn · lộ trình ===== */
function openGm(title,html){$("gh").textContent=title;$("gb").innerHTML=html;$("gm").hidden=false;}
const hbar=(v,mx,c)=>`<span class="mini"><i style="width:${mx?Math.round(v/mx*100):0}%;${c?"background:"+c:""}"></i></span>`;

/* --- lịch lặp lại --- */
function openRepeat(){
  openGm("🔁 Lịch lặp lại",`<p class="mut">Sao chép giờ bận đang tô trong tuần này sang các tuần sau.</p>
   <div class="row"><b>Lặp lại trong</b><select id="rn">${[1,2,3,4,8,12].map(n=>`<option value="${n}">${n} tuần tiếp theo</option>`).join("")}</select></div>
   <div class="mut" style="margin:10px 0 4px">Áp dụng cho các thứ:</div><div class="dchips" id="rds">${DAYS.map((d,i)=>`<button class="dc on" data-rd="${i}">${d.replace("Thứ ","T")}</button>`).join("")}</div>
   <label class="row" style="gap:8px;margin-top:10px"><input type="checkbox" id="rk" checked> Giữ cả ghi chú</label>
   <label class="row" style="gap:8px"><input type="checkbox" id="rw"> Ghi đè các thứ đã chọn ở tuần đích (xóa giờ bận cũ)</label>
   <div class="row" style="margin-top:12px"><button class="p sp" id="rgo">Lặp lại</button></div><hr>
   <p class="mut"><b>Sao chép trong tuần:</b> lấy mẫu một ngày chép sang các ngày khác.</p>
   <div class="row"><select id="rsrc">${DAYS.map((d,i)=>`<option value="${i}">${d}</option>`).join("")}</select><span>→</span></div>
   <div class="dchips" id="rdt" style="margin-top:8px">${DAYS.map((d,i)=>`<button class="dc" data-rt="${i}">${d.replace("Thứ ","T")}</button>`).join("")}</div>
   <div class="row" style="margin-top:10px"><button class="sp" id="rgd">Sao chép ngày</button></div>`);
  ["rds","rdt"].forEach(i=>$(i).onclick=e=>{const b=e.target.closest("button");if(b)b.classList.toggle("on")});
  $("rgo").onclick=async()=>{
    const days=[...document.querySelectorAll("#rds .on")].map(b=>+b.dataset.rd);if(!days.length)return say("Chọn ít nhất một thứ.");
    const n=+$("rn").value,keep=$("rk").checked,over=$("rw").checked;await flush();
    const src=[];wkDates().forEach((dt,i)=>{if(!days.includes(i))return;for(let h=0;h<24;h++){const k=K(fmt(dt),h);if(mine.has(k))src.push({i,h,note:keep?mine.get(k):""})}});
    if(!src.length)return say("Không có giờ bận nào để lặp lại ở các thứ đã chọn.");
    $("rgo").disabled=true;
    try{for(let w=1;w<=n;w++){
        if(over){const r0=await SB.from("personal_slots").delete().eq("user_id",user.id).in("slot_date",days.map(i=>fmt(addD(weekStart,7*w+i))));if(r0.error)throw r0.error;}
        const rows=src.map(x=>({user_id:user.id,slot_date:fmt(addD(weekStart,7*w+x.i)),hour:x.h,note:x.note}));
        const r=await SB.from("personal_slots").upsert(rows,{onConflict:"user_id,slot_date,hour"});if(r.error)throw r.error;}
      $("gm").hidden=true;remFetch=0;conf.key="";say("✓ Đã lặp lại "+src.length+" giờ cho "+n+" tuần tiếp theo");
    }catch(e){say("Lỗi: "+(e.message||e))}finally{const b=$("rgo");if(b)b.disabled=false}};
  $("rgd").onclick=()=>{const s0=+$("rsrc").value,ts=[...document.querySelectorAll("#rdt .on")].map(b=>+b.dataset.rt).filter(i=>i!==s0);
    if(!ts.length)return say("Chọn ngày đích (khác ngày nguồn).");
    const ds=wkDates(),fs=fmt(ds[s0]);
    ts.forEach(i=>{const ft=fmt(ds[i]);for(let h=0;h<24;h++){const a=K(fs,h),b=K(ft,h);if(mine.has(a))mine.set(b,mine.get(a));else mine.delete(b);}});
    pdirty=true;$("gm").hidden=true;redraw();say("✓ Đã sao chép "+DAYS[s0]+" sang "+ts.length+" ngày. Nhớ bấm Lưu.");};
}

/* --- phân tích thời gian --- */
function openAnalytics(){view==="team"&&team?openTeamStats():openMyStats();}
function openMyStats(){const m=store(),ds=wkDates();let tot=0,best=null;const by={},perDay=[];
  ds.forEach((dt,i)=>{const f=fmt(dt);let b=0,run=0,rs=0;
    for(let h=0;h<=24;h++){const free=h<24&&!m.has(K(f,h));
      if(h<24&&!free){b++;const n=m.get(K(f,h))||"(chưa ghi chú)";by[n]=(by[n]||0)+1;}
      if(free){if(!run)rs=h;run++}else{if(run>0&&(!best||run>best.len))best={i,s:rs,e:h,len:run};run=0}}
    perDay.push(b);tot+=b;});
  const kinds=Object.entries(by).sort((a,b)=>b[1]-a[1]),focus=Object.entries(by).filter(([n])=>/^🎯/.test(n)).reduce((a,[,v])=>a+v,0),mxd=Math.max(1,...perDay),mxk=Math.max(1,...kinds.map(x=>x[1]));
  openGm("📊 Phân tích thời gian của tôi",`<div class="mut">Tuần ${dm(weekStart)} – ${dm(addD(weekStart,6))}</div>
   <div class="kpis"><div class="kpi"><b>${tot}h</b><small>Giờ bận (${Math.round(tot/168*100)}%)</small></div><div class="kpi"><b>${168-tot}h</b><small>Giờ rảnh</small></div><div class="kpi"><b>${focus}h</b><small>🎯 Focus Time</small></div></div>
   <b>Theo ngày</b><div class="stl">${ds.map((dt,i)=>`<span>${DAYS[i]} ${dm(dt)}</span>${hbar(perDay[i],mxd)}<b>${perDay[i]}h</b>`).join("")}</div>
   <b>Theo loại việc (ghi chú)</b><div class="stl">${kinds.length?kinds.map(([n,v])=>`<span>${esc(n)}</span>${hbar(v,mxk,"var(--free)")}<b>${v}h</b>`).join(""):"<span class='mut'>Chưa có giờ bận nào.</span>"}</div>
   ${best?`<div class="mut">🟢 Khoảng rảnh liên tục dài nhất: <b>${DAYS[best.i]} ${dm(ds[best.i])} · ${best.s}:00–${best.e}:00</b> (${best.len}h)</div>`:""}`);}
function openTeamStats(){const ds=wkDates(),tot=members.length;if(!tot)return;
  const cnt={};members.forEach(m=>cnt[m.user_id]=0);
  busy.filter(x=>x.user_id!==user.id).forEach(x=>{if(cnt[x.user_id]!=null)cnt[x.user_id]++});cnt[user.id]=tmine.size;
  let common=0;const perDay=ds.map(()=>0),hb=Array(24).fill(0);
  ds.forEach((dt,i)=>{const f=fmt(dt);for(let h=0;h<24;h++){const b=busyOf(K(f,h)).length;hb[h]+=b;if(!b){common++;perDay[i]++}}});
  const top=[...hb.keys()].filter(h=>hb[h]>0).sort((a,b)=>hb[b]-hb[a]).slice(0,3),bd=perDay.indexOf(Math.max(...perDay));
  const rows=members.map(m=>({n:m.name,b:cnt[m.user_id]||0})).sort((a,b)=>b.b-a.b),mx=Math.max(1,...rows.map(r=>r.b)),mxd=Math.max(1,...perDay);
  openGm("📊 Phân tích nhóm · "+team.name,`<div class="mut">Tuần ${dm(weekStart)} – ${dm(addD(weekStart,6))} · ${tot} thành viên</div>
   <div class="kpis"><div class="kpi"><b>${common}h</b><small>Giờ cả nhóm cùng rảnh</small></div><div class="kpi"><b>${Math.round(common/168*100)}%</b><small>Tỉ lệ trùng rảnh</small></div><div class="kpi"><b>${common?DAYS[bd]:"—"}</b><small>Ngày nhiều giờ rảnh nhất</small></div></div>
   <b>Giờ bận của từng thành viên</b><div class="stl">${rows.map(r=>`<span>${esc(r.n)}</span>${hbar(r.b,mx)}<b>${r.b}h</b>`).join("")}</div>
   <b>Giờ rảnh chung theo ngày</b><div class="stl">${ds.map((dt,i)=>`<span>${DAYS[i]} ${dm(dt)}</span>${hbar(perDay[i],mxd,"var(--free)")}<b>${perDay[i]}h</b>`).join("")}</div>
   ${top.length?`<div class="mut">⛔ Giờ nhiều người bận nhất: ${top.map(h=>"<b>"+h+":00</b>").join(", ")}</div>`:""}`);}

/* --- nhắc lịch (khi đang mở trang) --- */
let rem={on:false,lead:10},remSlots=[],remFired=new Set(),remTimer=null,remFetch=0;
try{Object.assign(rem,JSON.parse(localStorage.getItem("tsRem")||"{}"))}catch(e){}
const remSave=()=>{try{localStorage.setItem("tsRem",JSON.stringify(rem))}catch(e){}};
async function remLoad(){const t=new Date(),r=await SB.from("personal_slots").select("*").gte("slot_date",fmt(t)).lte("slot_date",fmt(addD(t,1)));if(!r.error)remSlots=r.data||[];remFetch=Date.now();}
function remBlocks(){const by=new Map(),out=[];remSlots.forEach(r=>by.set(r.slot_date+"|"+r.hour,r.note||""));
  [...new Set(remSlots.map(r=>r.slot_date))].forEach(d=>{let cur=null;for(let h=0;h<24;h++){const k=d+"|"+h;
    if(by.has(k)){const n=by.get(k);if(cur&&cur.note===n&&cur.e===h-1)cur.e=h;else{cur={d,s:h,e:h,note:n};out.push(cur)}}else cur=null}});return out;}
function remNotify(title,body){if("Notification" in window&&Notification.permission==="granted"){try{new Notification(title,{body})}catch(e){}}say(title+(body?" ("+body+")":""));}
async function remTick(){if(!rem.on||!user)return;if(Date.now()-remFetch>300000)await remLoad();const now=Date.now();
  remBlocks().forEach(b=>{const[y,mo,d]=b.d.split("-").map(Number),st=new Date(y,mo-1,d,b.s).getTime(),key=b.d+"|"+b.s;
    if(!remFired.has(key)&&now>=st-rem.lead*60000&&now<st){remFired.add(key);remNotify("⏰ "+(b.note||"Lịch bận")+" sau "+Math.max(1,Math.round((st-now)/60000))+" phút",b.s+":00–"+(b.e+1)+":00");}});}
function initRemind(){stopRemind();if(!rem.on)return;remLoad();remTimer=setInterval(remTick,30000);}
function stopRemind(){if(remTimer){clearInterval(remTimer);remTimer=null}remSlots=[];remFired=new Set();}
function openRemind(){
  const perm=("Notification" in window)?Notification.permission:"unsupported";
  openGm("🔔 Nhắc lịch",`<p class="mut">Nhắc trước giờ bắt đầu của mỗi khối lịch bận (hôm nay và ngày mai). <b>Chỉ hoạt động khi trang Timesheet đang mở</b> trong trình duyệt.</p>
   <label class="row" style="gap:8px"><input type="checkbox" id="ron" ${rem.on?"checked":""}> Bật nhắc lịch</label>
   <div class="row" style="margin-top:10px"><span>Nhắc trước</span><select id="rld">${[5,10,15,30,60].map(n=>`<option value="${n}" ${n===rem.lead?"selected":""}>${n} phút</option>`).join("")}</select></div>
   <div class="mut" style="margin-top:10px">Quyền thông báo của trình duyệt: <b id="rpm">${perm==="granted"?"đã cho phép":perm==="denied"?"đã chặn (bật lại trong cài đặt trình duyệt)":perm==="unsupported"?"không hỗ trợ (chỉ hiện nhắc trong trang)":"chưa cấp"}</b></div>
   <div class="row" style="margin-top:12px"><button class="sp" id="rtest">Gửi thử thông báo</button></div>
   <hr><b>📲 Nhắc khi đã đóng trang (Web Push)</b><div id="xpush" class="mut" style="margin-top:6px">Đang kiểm tra…</div>`);
  $("ron").onchange=async e=>{rem.on=e.target.checked;remSave();
    if(rem.on){if("Notification" in window&&Notification.permission==="default"){try{await Notification.requestPermission()}catch(er){}}initRemind();say("✓ Đã bật nhắc lịch")}else{stopRemind();say("Đã tắt nhắc lịch")}};
  $("rld").onchange=e=>{rem.lead=+e.target.value;remSave()};
  $("rtest").onclick=async()=>{if("Notification" in window&&Notification.permission==="default"){try{await Notification.requestPermission()}catch(er){}}remNotify("⏰ Thông báo thử","Timesheet nhắc lịch hoạt động")};
  paintPush();
}

/* --- chia sẻ lịch tuần qua liên kết (ảnh chụp, chỉ xem) --- */
function weekCode(){const m=store();return fmt(weekStart)+"."+wkDates().map(dt=>{let v=0;for(let h=0;h<24;h++)if(m.has(K(fmt(dt),h)))v|=1<<h;return v.toString(16).padStart(6,"0")}).join("");}
const shareLink=nm=>location.origin+location.pathname+"#share="+weekCode()+(nm?"~"+encodeURIComponent(nm):"");
function openShare(){
  openGm("🔗 Chia sẻ lịch",`<div class="lkx" style="margin:0 0 12px"><b>⚡ Liên kết sống <span class="tag open">Khuyên dùng</span></b><p class="mut" style="margin:0">Tự cập nhật theo lịch của bạn, có hạn dùng và <b>thu hồi được bất cứ lúc nào</b>. Người nhận không cần đăng nhập.</p><button class="p" id="shlv" type="button">Quản lý liên kết sống</button></div>
   <b>📸 Ảnh chụp tuần này</b><p class="mut">Tạo liên kết <b>chỉ xem</b> cho tuần ${dm(weekStart)} – ${dm(addD(weekStart,6))}. Người nhận <b>không cần đăng nhập</b>. Liên kết là <b>ảnh chụp tại thời điểm này</b> (chỉ có giờ bận/rảnh, không kèm ghi chú); muốn cập nhật thì tạo liên kết mới.</p>
   <input id="shn" placeholder="Tên hiển thị trên liên kết" value="${esc(uname())}" style="width:100%" maxlength="40">
   <input id="shl" readonly style="width:100%;margin-top:10px">
   <div class="row" style="margin-top:10px"><button class="p sp" id="shc">📋 Sao chép liên kết</button><a class="btn" id="sho" target="_blank" rel="noopener">Mở thử</a></div>`);
  $("shlv").onclick=()=>openLiveShares("personal");
  const upd=()=>{const l=shareLink($("shn").value.trim());$("shl").value=l;$("sho").href=l};upd();$("shn").oninput=upd;
  $("shc").onclick=()=>copyText($("shl").value);$("shl").onfocus=e=>e.target.select();
}
function shareView(){
  let raw="";try{raw=decodeURIComponent(location.hash.slice(7))}catch(e){}
  const[c,nm]=raw.split("~"),[d,hex]=(c||"").split(".");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d||"")||!/^[0-9a-f]{42}$/.test(hex||"")){$("app").innerHTML="<div class='card'>Liên kết chia sẻ không hợp lệ.</div>";return;}
  weekStart=mondayOf(parse(d));selDate="";
  const bits=[...Array(7).keys()].map(i=>parseInt(hex.slice(i*6,i*6+6),16));
  ctx={cell:k=>{const[dd,hh]=k.split("|"),i=Math.round((parse(dd)-weekStart)/864e5);return((bits[i]>>+hh)&1)?{cls:"busy"}:{cls:""}}};
  const busyN=bits.reduce((a,v)=>{let n=0;for(let h=0;h<24;h++)n+=(v>>h)&1;return a+n},0);
  $("app").innerHTML=`<div class="card"><div class="row"><h2 style="margin:0">🔗 Lịch tuần của ${esc(nm||"bạn bè")}</h2><span class="sp"></span><a class="btn" href="${esc(location.pathname)}">Mở Timesheet</a></div>
   <p class="mut" style="margin:6px 0 10px">Tuần ${dm(weekStart)} – ${dm(addD(weekStart,6))}/${addD(weekStart,6).getFullYear()} · ${busyN}h bận, ${168-busyN}h rảnh · chỉ xem, là ảnh chụp tại lúc chia sẻ.</p>
   <div class="legend"><span><i style="background:var(--ac)"></i>Giờ bận</span><span><i style="background:var(--head);border:1px solid var(--bd)"></i>Giờ rảnh</span></div>${grid(k=>ctx.cell(k))}</div>`;
}

/* --- tự động đóng bình chọn khi mọi người đã bỏ phiếu --- */
