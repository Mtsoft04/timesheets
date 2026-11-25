/* ---------- giao diện sáng / tối ---------- */
const rootEl=document.documentElement,mq=matchMedia("(prefers-color-scheme:dark)");
const isDark=()=>rootEl.dataset.theme?rootEl.dataset.theme==="dark":mq.matches;
function paintTheme(){const d=isDark();$("thl").className=d?"":"on";$("thd").className=d?"on":"";
  $("thl").setAttribute("aria-pressed",!d);$("thd").setAttribute("aria-pressed",d);
  const mt=document.querySelector("meta[name=theme-color]");if(mt)mt.content=d?"#0f1726":"#2563eb";}
function setTheme(t){rootEl.dataset.theme=t;try{localStorage.setItem("theme",t)}catch(e){}paintTheme();}
$("thl").onclick=()=>setTheme("light");$("thd").onclick=()=>setTheme("dark");
mq.addEventListener&&mq.addEventListener("change",paintTheme);paintTheme();
let SB,user=null,view="me",ctx=null,drag=null;
let mine=new Map(),sel=new Set(),pmode="paint",pdirty=false;          // cá nhân
let tsel=null,mDur=1,qNote="",conf={key:"",p:new Map(),t:new Set()};
let teams=[],team=null,members=[],busy=[],tmine=new Map(),tview="mine",dirty=false; // nhóm

const uname=()=>(user.user_metadata&&(user.user_metadata.full_name||user.user_metadata.name))||user.email.split("@")[0];
const K=(d,h)=>d+"|"+h;
const pad=n=>String(n).padStart(2,"0");
const fmt=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const parse=s=>{const[a,b,c]=s.split("-").map(Number);return new Date(a,b-1,c)};
const addD=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const mondayOf=d=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-((x.getDay()+6)%7));return x};
let weekStart=mondayOf(new Date()),selDate=fmt(new Date());
const wkDates=()=>[...Array(7).keys()].map(i=>addD(weekStart,i));
const wkRange=()=>[fmt(weekStart),fmt(addD(weekStart,6))];
const dm=d=>pad(d.getDate())+"/"+pad(d.getMonth()+1);

/* ---------- lưới ---------- */
function legend(){const n="<span><i style='background:var(--head);border:1px solid var(--bd)'></i>";
  if(view==="team"&&tview==="room")return"<div class='legend'><span><i style='background:var(--ac)'></i>Đã đặt</span>"+n+"Còn trống (bấm/kéo để chọn giờ)</span></div>";
  if(view==="team"&&tview==="res")return"<div class='legend'><span><i style='background:var(--free)'></i>Tất cả cùng rảnh</span>"+n+"Có người bận (số = số người)</span><span><i class='evk'></i>Có sự kiện</span></div>";
  return"<div class='legend'><span><i style='background:var(--ac)'></i>Giờ bận</span>"+n+"Giờ rảnh</span></div>";}
function grid(fn){
  const ds=wkDates(),today=fmt(new Date());
  let s="<div class='wrap'><table id='g'><tr><th class='t'></th>"+ds.map((d,i)=>{const f=fmt(d);return"<th class='"+(f===today?"today ":"")+(f===selDate?"selday":"")+"'>"+DAYS[i]+"<br><small>"+dm(d)+"</small></th>"}).join("")+"</tr>";
  for(const h of H){s+="<tr><th class='t'>"+h+":00</th>";
    for(const d of ds){const k=K(fmt(d),h),c=fn(k);s+="<td class='c "+c.cls+"' data-k='"+k+"' title='"+esc(c.tip||"")+"'>"+esc(c.txt||"")+"</td>";}
    s+="</tr>";}
  return s+"</table></div>";
}
function navBar(){const b=addD(weekStart,6);
  return"<div class='nav'><button id='pw' title='Tuần trước'>‹</button><button id='tdy'>Hôm nay</button><button id='nw' title='Tuần sau'>›</button><input type='date' id='dp' value='"+selDate+"'><button id='pm' class='pmbtn "+(paintTouch?"on":"")+"'>✏️ Kéo để tô: "+(paintTouch?"Bật":"Tắt")+"</button><b>Tuần "+dm(weekStart)+" – "+dm(b)+"/"+b.getFullYear()+"</b></div>";}
function bindNav(){bindPM();
  const to=async(ws,sd)=>{await flush();weekStart=ws;selDate=sd||fmt(ws);view==="me"?meView():loadTeam(true);};
  $("pw").onclick=()=>to(addD(weekStart,-7));$("nw").onclick=()=>to(addD(weekStart,7));
  $("tdy").onclick=()=>{const t=new Date();to(mondayOf(t),fmt(t))};
  $("dp").onchange=e=>{if(e.target.value){const d=parse(e.target.value);to(mondayOf(d),e.target.value);}};
}
function bindPM(){const b=$("pm");if(!b)return;b.onclick=()=>{paintTouch=!paintTouch;document.body.classList.toggle("paintmode",paintTouch);b.className="pmbtn "+(paintTouch?"on":"");b.textContent="✏️ Kéo để tô: "+(paintTouch?"Bật":"Tắt");say(paintTouch?"Kéo ngón tay để tô nhiều ô. Tắt đi để cuộn lịch.":"Đã tắt. Chạm từng ô để tô, kéo để cuộn.");};}
async function flush(){if(view==="me"&&pdirty)await saveMe(true);else if(view==="team"&&team&&dirty&&tview==="mine")await saveTeam(false,true);}
function refreshCell(k,nb){const td=document.querySelector("td[data-k='"+k+"']");
  if(td&&ctx){const c=ctx.cell(k);td.className="c "+c.cls;td.textContent=c.txt||"";td.title=c.tip||"";}
  if(!nb){const[d,h]=k.split("|");[+h-1,+h+1].forEach(x=>{if(x>=0&&x<24)refreshCell(K(d,x),true)});}}
let paintTouch=false,handled=false;
document.addEventListener("pointerdown",e=>{const td=e.target.closest&&e.target.closest("td.c");handled=false;
  if(!td||!ctx||!ctx.start)return;
  if(e.pointerType!=="mouse"&&!paintTouch)return;   // cảm ứng: để trình duyệt cuộn, tô bằng sự kiện click
  handled=true;drag=ctx.start(td.dataset.k);e.preventDefault();ctx.apply(td.dataset.k,drag);});
document.addEventListener("click",e=>{const td=e.target.closest&&e.target.closest("td.c");
  if(handled){handled=false;return;}
  if(!td||!ctx||!ctx.start)return;
  ctx.apply(td.dataset.k,ctx.start(td.dataset.k));});
document.addEventListener("pointermove",e=>{if(drag===null||!ctx)return;const t=document.elementFromPoint(e.clientX,e.clientY);if(t&&t.dataset&&t.dataset.k)ctx.apply(t.dataset.k,drag);});
document.addEventListener("pointerup",()=>{drag=null});

/* ---------- đăng nhập ---------- */
function authView(){
  $("appNav").hidden=true;$("hp").hidden=true;
  $("app").innerHTML=`<div class="auth"><div class="brand"><div class="logo" style="background:rgba(255,255,255,.18)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18M8 14h3"/></svg></div><h2>Tìm giờ cả nhóm cùng rảnh</h2><p>Mỗi người tô giờ bận của mình, Timesheet tự tìm các khung giờ trùng cho cả nhóm.</p><ul><li>Lịch cá nhân kèm ghi chú</li><li>Tạo nhóm và mời bằng mã chia sẻ</li><li>Chốt lịch và xem kết quả chung</li></ul></div>
  <div class="card form"><h2>Chào mừng bạn</h2>
  <div class="col">
   <button class="gbtn" id="gg"><b>G</b>Tiếp tục với Google</button>
   <div class="or">hoặc dùng email</div>
   <input id="em" type="email" placeholder="Email"><input id="pw" type="password" placeholder="Mật khẩu (từ 6 ký tự)">
   <div class="row"><button class="p sp" id="li">Đăng nhập</button><button class="sp" id="su">Đăng ký</button></div>
  </div></div></div>`;
  $("gg").onclick=()=>SB.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+location.pathname}});
  const cred=()=>{const email=$("em").value.trim(),password=$("pw").value;
    if(!email||!/^\S+@\S+\.\S+$/.test(email)){say("Hãy nhập email hợp lệ.");return null;}
    if(password.length<6){say("Mật khẩu cần ít nhất 6 ký tự.");return null;}
    return{email,password};};
  $("li").onclick=async()=>{const c=cred();if(!c)return;const{error}=await SB.auth.signInWithPassword(c);if(error)say("Lỗi: "+error.message);};
  $("su").onclick=async()=>{const c=cred();if(!c)return;const{data,error}=await SB.auth.signUp(c);
    if(error)say("Lỗi: "+error.message);else if(!data.session)say("Đã đăng ký. Hãy mở email để xác nhận rồi đăng nhập.");};
}

/* ---------- khung chính ---------- */
function shell(){
  $("appNav").hidden=false;$("hp").hidden=false;
  $("app").innerHTML=`<div class="shell"><div id="body"></div></div>
  <div class="modal" id="help" hidden><div class="card"><div class="row"><h2 style="margin:0">📖 Hướng dẫn &amp; lưu ý</h2><span class="sp"></span><button id="hx">Đóng</button></div><ul>
  <li><b>Ô xanh dương = giờ BẬN</b>, ô trống = giờ rảnh. Bấm hoặc kéo để tô.</li>
  <li>Lịch hiển thị theo <b>tuần</b>. Dùng nút ‹ ›, <b>Hôm nay</b> hoặc ô chọn ngày để chuyển tuần. Thay đổi chưa lưu sẽ tự lưu khi bạn chuyển tuần.</li>
  <li><b>Lịch cá nhân</b>: tô giờ bận, chuyển sang chế độ "Ghi chú", chọn ô rồi nhập nội dung, bấm Lưu. Soạn xong có thể bấm <b>⤴ Áp dụng lịch cá nhân vào nhóm</b> để chép lịch (kèm ghi chú) sang một hoặc nhiều nhóm, không cần tô lại.</li>
  <li><b>Lịch nhóm</b>: tạo nhóm để nhận mã chia sẻ, gửi mã cho mọi người để họ nhập vào tham gia. Mỗi người tô giờ bận của mình (có thể tô nhiều tuần) rồi bấm <b>Chốt lịch</b>.</li>
  <li>Trong lịch nhóm cũng có thể ghi chú từng khung giờ (Đi làm, Họp…). Mọi người thấy ghi chú khi rê chuột vào ô ở tab Kết quả chung. Bấm nút <b>Thành viên</b> để xem danh sách và ai đã chốt.</li>
  <li>Nút <b>🗳️ Bình chọn</b> trong nhóm: tạo tiêu đề kèm các phương án (hoặc dùng nhanh Đồng ý / Không đồng ý), mọi người bấm để vote. Người tạo có thể đóng hoặc xóa bình chọn. Bình chọn đã đóng chuyển sang thẻ <b>Lịch sử vote</b> (cột phải, dưới chat) với nút <b>Xem lại</b> để xem ai đã vote gì.</li>
  <li><b>💬 Chat nhóm</b> nằm ở cột phải phía trên: mọi người trong nhóm cùng nhắn tin, mỗi tin hiện rõ tên người gửi và giờ gửi. Bấm Enter để gửi.</li>
  <li>Khi mọi người đã chốt, tab <b>Kết quả chung</b> hiện các giờ ai cũng rảnh (màu xanh lá).</li>
  <li>Những ai có mã nhóm đều xem được lịch bận của các thành viên trong nhóm đó.</li>
  <li><b>📰 Bài viết</b>: đăng bài (kèm tối đa 4 ảnh) cho mọi người dùng thấy. Mỗi bài có thể thả cảm xúc (👍 ❤️ 😂 😮 😢 😡), bình luận và trả lời bình luận. Người đăng được xoá bài của mình; người đăng bài hoặc người viết bình luận được xoá bình luận.</li>
  <li><b>Lịch cá nhân nâng cao</b>: đường lưới rõ hơn, thẻ <b>⏱️ Tổng hợp giờ nhanh</b> (số giờ bận/rảnh từng ngày), mục <b>⚡ Chọn nhanh khung giờ</b> (chọn thứ rồi bấm Sáng / Chiều / Tối / Hành chính…) và nút bấm lớn hơn.</li>
  <li><b>Kết quả chung của nhóm</b>: ô hiển thị dạng <b>số người khả dụng/tổng</b>; bấm một ô để xem tên người khả dụng và người bận. Thẻ <b>📅 Gợi ý lịch họp</b> tự tìm khung giờ cả nhóm cùng rảnh, cho <b>xuất .ics</b> (Google/Apple/Outlook), mở Google Lịch hoặc <b>🔔 báo vào chat nhóm</b>. Nhóm trưởng có thể bật tự động báo khi cả nhóm đã chốt.</li>
  <li><b>📰 Bài viết</b>: bấm các nút <b>#chủ đề</b> khi soạn bài, dùng thanh <b>Lọc</b> để xem theo chủ đề. Nút <b>🔑 Chèn mã nhóm</b> / <b>📞 Chèn SĐT</b> giúp đăng nhanh; bài có mã nhóm hoặc số điện thoại sẽ hiện nút <b>📋 Sao chép mã</b> / <b>📞 Gọi</b>.</li>
  <li><b>🔁 Lặp lại</b>: sao chép giờ bận tuần này sang 1–12 tuần sau, hoặc chép mẫu một ngày sang các ngày khác. <b>🎯 Focus Time / 🧱 Time Block</b>: chọn loại ghi chú ở mục Chọn nhanh khi tô. <b>📊 Phân tích</b>, <b>🔔 Nhắc lịch</b> (khi đang mở trang) và <b>🔗 Chia sẻ</b> (liên kết chỉ xem, không cần đăng nhập) nằm ở cột trái lịch cá nhân.</li>
  <li><b>Gợi ý lịch họp</b> cảnh báo ⚠️ khi trùng lịch cá nhân hoặc nhóm khác của bạn, và <b>bình chọn tự động chốt</b> khi cả nhóm đã bỏ phiếu (nhóm trưởng tạo bình chọn cần đang mở trang).</li>
  <li><b>📅 Lịch chung · sự kiện</b> (trong nhóm): tạo sự kiện, mời thành viên, mỗi người bấm <b>Tham gia / Có thể / Từ chối</b>. Chọn phòng thì hệ thống tự đặt chỗ và chặn trùng. Từ <b>Gợi ý lịch họp</b> bấm <b>📅 Tạo sự kiện</b> để chốt luôn. <b>✅ Công việc</b> gắn ngày/giờ, giao cho thành viên, tick hoàn thành (cũng có ở lịch cá nhân).</li>
  <li><b>🏢 Phòng &amp; tài nguyên</b>: quản trị thêm phòng/thiết bị; mọi người kéo trên lịch để chọn giờ rồi <b>Đặt chỗ</b>. <b>Vai trò</b> (Quản trị / Thành viên / Chỉ xem) đổi trong danh sách <b>Thành viên</b>.</li>
  <li><b>🔗 Liên kết sống</b>: lịch cá nhân hoặc lịch nhóm tự cập nhật, đặt hạn dùng, thu hồi bất cứ lúc nào. <b>🗳️ Bình chọn</b> có thêm hạn chót, ẩn danh, giới hạn số phương án. <b>🔔 Nhắc lịch</b> có thêm thông báo nền khi đã đóng trang.</li>
  <li><b>👑 Nhóm trưởng</b> là người tạo nhóm, có ký hiệu vương miện ở danh sách nhóm, thành viên và chat. Nhóm trưởng có nút <b>🗑️ Xoá nhóm</b> (xoá toàn bộ lịch, chat, bình chọn của nhóm). Thành viên tham gia bằng mã có nút <b>🚪 Rời nhóm</b> (lịch bận và phiếu bầu của bạn trong nhóm đó sẽ bị xoá).</li></ul></div></div>
  <div class="modal" id="mem" hidden><div class="card"><div class="row"><h2 style="margin:0" id="mh">👥 Thành viên</h2><span class="sp"></span><button id="mx">Đóng</button></div><div class="mut" id="ms" style="margin:6px 0 10px"></div><input id="mq" placeholder="Tìm thành viên…" style="width:100%"><div class="mlist" id="ml"></div></div></div>
  <div class="modal" id="prm" hidden><div class="card"><div class="row"><h2 style="margin:0" id="prh"></h2><span class="sp"></span><button id="prx">Đóng</button></div><div id="prb"></div></div></div>
  <div class="modal lbm" id="lb" hidden><button id="lbp" class="lbn" title="Ảnh trước">‹</button><img id="lbi" alt=""><button id="lbn" class="lbn" title="Ảnh sau">›</button><button id="lbx" class="lbx" title="Đóng">✕</button></div>
  <div class="modal" id="apm" hidden><div class="card"><div class="row"><h2 style="margin:0">⤴ Áp dụng lịch cá nhân vào nhóm</h2><span class="sp"></span><button id="apx">Đóng</button></div><div id="apb"></div></div></div>
  <div class="modal" id="gm" hidden><div class="card"><div class="row"><h2 style="margin:0" id="gh"></h2><span class="sp"></span><button id="gx">Đóng</button></div><div id="gb"></div></div></div>
  <div class="modal" id="pcm" hidden><div class="card"><div class="row"><h2 style="margin:0">🗳️ Tạo bình chọn</h2><span class="sp"></span><button id="pcx">Đóng</button></div>
   <input id="pt" maxlength="120" placeholder="Tiêu đề, ví dụ: Họp nhóm vào 19h thứ Sáu?" style="width:100%;margin-top:12px">
   <div id="po"></div>
   <div class="row"><button id="pa1">＋ Thêm phương án</button><button id="pa2">Đồng ý / Không đồng ý</button></div>
   <label class="row" style="margin-top:12px;gap:8px;cursor:pointer"><input type="checkbox" id="pmu" onchange="document.getElementById('pmxr').hidden=!this.checked"> Cho phép chọn nhiều phương án</label>
   <label class="row" id="pmxr" hidden style="margin-top:8px;gap:8px">Tối đa <input type="number" id="pmx" min="1" max="10" style="width:80px" placeholder="∞"> phương án mỗi người</label>
   <label class="row" style="margin-top:8px;gap:8px">⏳ Hạn chót <input type="datetime-local" id="pdl"></label>
   <label class="row" style="margin-top:8px;gap:8px;cursor:pointer"><input type="checkbox" id="pan"> 🙈 Ẩn danh (không ai thấy ai chọn gì)</label>
   <div class="row" style="margin-top:14px;justify-content:flex-end"><button id="pcc">Hủy</button><button class="p" id="pgo">Tạo bình chọn</button></div></div></div>`;
  $("tm").onclick=()=>{view="me";go()};$("tt").onclick=()=>{view="team";go()};$("tp").onclick=async()=>{await flush();view="posts";go()};
  $("hp").onclick=()=>{$("help").hidden=false};$("hx").onclick=()=>{$("help").hidden=true};
  $("help").onclick=e=>{if(e.target.id==="help")e.target.hidden=true};
  $("mx").onclick=()=>{$("mem").hidden=true};$("mem").onclick=e=>{if(e.target.id==="mem")e.target.hidden=true};$("mq").oninput=renderMembers;
  $("pcx").onclick=$("pcc").onclick=()=>{$("pcm").hidden=true};$("pcm").onclick=e=>{if(e.target.id==="pcm")e.target.hidden=true};
  $("pa1").onclick=()=>{if(document.querySelectorAll("#po .row").length>=10)return say("Tối đa 10 phương án.");addOpt("").querySelector("input").focus()};
  $("pa2").onclick=()=>{$("po").innerHTML="";addOpt("Đồng ý");addOpt("Không đồng ý");if(!$("pt").value.trim())$("pt").focus()};
  $("pgo").onclick=submitPoll;
  $("lbx").onclick=()=>{$("lb").hidden=true};$("lb").onclick=e=>{if(e.target.id==="lb")e.target.hidden=true};
  $("lbp").onclick=()=>{lb.i=(lb.i+lb.l.length-1)%lb.l.length;showLb()};$("lbn").onclick=()=>{lb.i=(lb.i+1)%lb.l.length;showLb()};
  $("apx").onclick=()=>{$("apm").hidden=true};$("apm").onclick=e=>{if(e.target.id==="apm")e.target.hidden=true};
  $("prx").onclick=()=>{$("prm").hidden=true};
  $("gx").onclick=()=>{$("gm").hidden=true};$("gm").onclick=e=>{if(e.target.id==="gm")e.target.hidden=true};$("prm").onclick=e=>{if(e.target.id==="prm")e.target.hidden=true};
  $("prb").onclick=async ev=>{const a=ev.target.closest("[data-a]");if(a&&await pollAction(revId,a.dataset.a))$("prm").hidden=true};
}
document.addEventListener("keydown",e=>{if(e.key==="Escape")["help","mem","pcm","prm","apm","lb","npn","gm"].forEach(i=>{const h=$(i);if(h)h.hidden=true})});
function go(){$("tm").className=view==="me"?"on":"";$("tt").className=view==="team"?"on":"";$("tp").className=view==="posts"?"on":"";say("");view==="me"?meView():view==="posts"?postsView():teamView();}
