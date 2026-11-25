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
  <div class="modal guide-modal" id="help" hidden><div class="card guide-card"><div class="row guide-header"><div><div class="guide-eyebrow">TRUNG TÂM TRỢ GIÚP</div><h2 style="margin:0">📖 Hướng dẫn &amp; lưu ý</h2></div><span class="sp"></span><button id="hx">Đóng</button></div>
  <p class="guide-intro">Tra cứu cách dùng từng khu vực. Chọn một mục bên dưới để đi thẳng đến hướng dẫn.</p>
  <nav class="guide-toc" aria-label="Mục lục hướng dẫn"><a href="#guide-start">Bắt đầu</a><a href="#guide-personal">Lịch cá nhân</a><a href="#guide-team">Lịch nhóm</a><a href="#guide-work">Giờ công &amp; chi phí</a><a href="#guide-leave">Nghỉ phép &amp; tăng ca</a><a href="#guide-shifts">Ca làm &amp; QR</a><a href="#guide-posts">Bài viết &amp; chat</a><a href="#guide-data">Dữ liệu &amp; quyền riêng tư</a></nav>
  <main class="guide-sections">
   <section class="guide-section" id="guide-start"><div class="guide-heading"><span>01</span><div><h3>Bắt đầu sử dụng</h3><p>Các thao tác chung để làm quen với ứng dụng.</p></div></div><div class="guide-grid"><article><h4>Đăng nhập và điều hướng</h4><ol><li>Đăng nhập bằng tài khoản của bạn. Hoàn tất tên hiển thị trong Hồ sơ để đồng đội nhận ra bạn.</li><li>Dùng thanh điều hướng để mở <b>Lịch cá nhân</b>, <b>Lịch nhóm</b> hoặc <b>Bài viết</b>.</li><li>Trong lịch tuần, dùng mũi tên, <b>Hôm nay</b> hoặc ô ngày để chuyển tuần.</li></ol></article><article><h4>Lưu và trạng thái</h4><p>Lịch cá nhân được lưu khi bạn bấm thao tác lưu hoặc chuyển tuần. Lịch nhóm cần bấm <b>Chốt lịch</b> để báo đã hoàn tất tuần. Nếu thấy lỗi tải/lưu, hãy kiểm tra kết nối và báo quản trị viên; đừng gửi lại liên tục khi chưa rõ dữ liệu đã được lưu hay chưa.</p></article></div></section>
   <section class="guide-section" id="guide-personal"><div class="guide-heading"><span>02</span><div><h3>Lịch cá nhân</h3><p>Lên kế hoạch thời gian bận, ghi chú và chia sẻ lịch.</p></div></div><div class="guide-grid"><article><h4>Tô lịch bận và ghi chú</h4><ol><li>Ô xanh dương biểu thị giờ bận; ô trống là thời gian chưa đánh dấu bận.</li><li>Bấm hoặc kéo trên lưới để chọn khung giờ. Dùng <b>Chọn nhanh khung giờ</b> để điền buổi sáng, chiều, tối hoặc giờ hành chính.</li><li>Chuyển sang chế độ <b>Ghi chú</b> để thêm nội dung cho khung giờ, ví dụ Focus Time, họp hoặc việc cần làm; lưu thay đổi theo nút trên trang.</li><li>Dùng <b>Lặp lại</b> để sao chép lịch sang các tuần tiếp theo hoặc ngày khác; kiểm tra tuần đích trước khi áp dụng.</li></ol></article><article><h4>Công cụ cá nhân</h4><ul><li><b>Tổng hợp giờ nhanh / Phân tích:</b> xem phân bố giờ bận và rảnh.</li><li><b>Công việc của tôi:</b> thêm việc, ngày đến hạn và trạng thái hoàn thành.</li><li><b>Nhắc lịch:</b> cấu hình nhắc theo tùy chọn hiển thị. Thông báo nền phụ thuộc quyền thông báo của trình duyệt và cài đặt thiết bị.</li><li><b>Chia sẻ:</b> tạo liên kết xem lịch. Gửi liên kết chỉ cho người bạn tin cậy; thu hồi hoặc đặt hạn dùng nếu trang cung cấp tùy chọn đó.</li><li><b>Áp dụng lịch cá nhân vào nhóm:</b> chọn nhóm để sao chép các khung giờ cá nhân sang lịch nhóm; rà soát nội dung trước khi chia sẻ.</li></ul></article><article><h4>Nhập và xuất lịch</h4><p>Dùng công cụ <b>.ics</b> để nhập tệp lịch ngoài thành các giờ bận cá nhân hoặc xuất tuần hiện tại sang ứng dụng lịch. Đây là thao tác nhập/xuất tệp thủ công; hiện chưa tự đồng bộ hai chiều với Google Calendar, Apple Calendar hay Outlook. Kiểm tra ngày, múi giờ và sự kiện nhập được trước khi dựa vào lịch.</p></article></div></section>
   <section class="guide-section" id="guide-team"><div class="guide-heading"><span>03</span><div><h3>Lịch nhóm</h3><p>Phối hợp thời gian, cuộc họp, tài nguyên và công việc.</p></div></div><div class="guide-grid"><article><h4>Tạo nhóm và chốt lịch</h4><ol><li>Tạo nhóm để nhận mã tham gia hoặc nhập mã nhóm do trưởng nhóm cung cấp.</li><li>Mỗi thành viên đánh dấu giờ bận, thêm ghi chú nếu cần rồi bấm <b>Chốt lịch</b>.</li><li>Mở <b>Kết quả chung</b> để xem mức độ khả dụng; chọn một ô để xem thành viên phù hợp theo dữ liệu đã gửi.</li><li>Dùng <b>Gợi ý lịch họp</b> để tìm khung giờ chung. Có thể xuất .ics hoặc tạo sự kiện nhóm nếu các nút tương ứng khả dụng.</li></ol></article><article><h4>Công cụ cộng tác</h4><ul><li><b>Thành viên:</b> xem người trong nhóm, trạng thái chốt lịch và vai trò. Quyền quản trị tùy vai trò được cấp.</li><li><b>Chat nhóm:</b> gửi trao đổi ngắn trong nhóm; tránh gửi mật khẩu, khóa truy cập hay thông tin nhạy cảm.</li><li><b>Bình chọn:</b> tạo câu hỏi và phương án, theo dõi kết quả; người có quyền quản lý có thể đóng bình chọn.</li><li><b>Sự kiện:</b> tạo lịch hẹn và mời thành viên xác nhận tham gia. Link họp trực tuyến cần được thêm theo các trường có trên biểu mẫu; ứng dụng chưa tự tạo link Meet/Zoom/Teams.</li><li><b>Phòng &amp; tài nguyên:</b> chọn tài nguyên và khoảng giờ trước khi đặt; xác nhận trạng thái đặt thành công để tránh trùng.</li><li><b>Công việc nhóm:</b> giao việc, đặt thời gian và cập nhật hoàn thành theo quyền truy cập.</li></ul></article></div></section>
   <section class="guide-section" id="guide-work"><div class="guide-heading"><span>04</span><div><h3>Ghi nhận giờ công &amp; chi phí</h3><p>Ghi giờ theo cá nhân hoặc theo một nhóm cụ thể.</p></div></div><div class="guide-grid"><article><h4>Đồng hồ và nhập giờ thủ công</h4><ol><li>Mở mục <b>Giờ công / Theo dõi giờ làm</b> trên lịch cá nhân hoặc lịch nhóm.</li><li>Ở trường <b>Ghi giờ cho</b>, chọn <b>Chỉ mình tôi</b> hoặc đúng nhóm cần ghi nhận. Nhật ký được gắn với phạm vi đã chọn.</li><li>Nhập tên công việc, ghi chú và thời điểm bắt đầu/kết thúc; hoặc bấm bắt đầu bộ đếm khi làm việc và dừng khi hoàn tất.</li><li>Kiểm tra nhật ký, tổng thời lượng và tuần công trước khi nộp. Nhật ký thuộc nhóm chỉ xuất hiện trong hàng chờ duyệt của nhóm sau khi bạn nộp tuần.</li></ol></article><article><h4>Nộp, duyệt và khóa kỳ</h4><ul><li>Thành viên chọn đúng nhóm và bấm <b>Nộp tuần này để trưởng nhóm duyệt</b>. Không thể nộp tuần rỗng hoặc khi còn bộ đếm đang chạy.</li><li>Trưởng nhóm xem danh sách chờ duyệt, duyệt hoặc từ chối; khi từ chối cần ghi lý do để thành viên chỉnh sửa và nộp lại.</li><li>Kỳ đã nộp hoặc duyệt sẽ khóa chỉnh sửa theo trạng thái. Chỉ người có quyền quản lý mới có thể mở lại nếu tính năng mở khóa được bật.</li><li>Trước khi duyệt, đối chiếu người làm, công việc, ngày giờ, ghi chú và kỳ tuần. Bản ghi giờ làm là dữ liệu phục vụ đối soát, không tự xác nhận sự hiện diện tại nơi làm việc.</li></ul></article><article><h4>Giờ tính phí và báo cáo</h4><p>Khi cấu hình tính phí đã được bật, đánh dấu <b>Giờ tính phí</b> và nhập đơn giá theo giờ cho từng nhật ký. Ứng dụng cộng chi phí dự kiến từ thời lượng và đơn giá. Đây là số liệu tham khảo để đối soát; kiểm tra tiền tệ, đơn giá và quy tắc làm tròn trước khi dùng tính lương hoặc xuất hóa đơn. Nếu thiếu trường tính phí hoặc báo cáo, quản trị viên cần áp dụng migration <code>work_log_billing</code> trong Supabase. Không nhập đơn giá nếu chưa được phép chia sẻ dữ liệu chi phí.</p></article></div></section>
   <section class="guide-section" id="guide-leave"><div class="guide-heading"><span>05</span><div><h3>Nghỉ phép &amp; tăng ca</h3><p>Gửi yêu cầu và theo dõi phản hồi của trưởng nhóm.</p></div></div><div class="guide-grid"><article><h4>Gửi yêu cầu</h4><ol><li>Chọn <b>Nghỉ phép</b> hoặc <b>Tăng ca</b>, nhóm gửi yêu cầu, thời gian bắt đầu/kết thúc và lý do.</li><li>Chọn phạm vi cập nhật lịch (nhóm này hay các nhóm tham gia) rồi gửi.</li><li>Theo dõi trạng thái <b>Chờ duyệt / Đã duyệt / Từ chối</b>. Yêu cầu đang chờ có thể hủy nếu nút hủy còn hiển thị.</li></ol></article><article><h4>Dành cho người duyệt</h4><p>Trưởng nhóm xem các yêu cầu đang chờ, duyệt hoặc từ chối kèm lý do. Khi duyệt, trạng thái bận/nghỉ cập nhật theo phạm vi đã chọn. Nếu mục nghỉ phép không tải, yêu cầu lỗi hoặc trạng thái lịch chưa đổi, cần kiểm tra các migration của chức năng nghỉ phép và quyền Supabase; không coi yêu cầu đang chờ là đã được chấp thuận.</p></article></div></section>
   <section class="guide-section" id="guide-shifts"><div class="guide-heading"><span>06</span><div><h3>Ca làm &amp; chấm công QR</h3><p>Đăng ký ca và ghi nhận tại điểm làm việc.</p></div></div><div class="guide-grid"><article><h4>Đổi ca có duyệt</h4><ol><li>Quản lý tạo ca và phân công thành viên.</li><li>Người đang được xếp ca đăng ca cần nhượng; người khác gửi yêu cầu nhận ca.</li><li>Quản lý xem yêu cầu và duyệt hoặc từ chối. Chỉ coi ca đã đổi sau khi trạng thái được cập nhật thành công.</li></ol><p>Nếu trang ca làm trống hoặc báo lỗi, cần kiểm tra migration và quyền truy cập bảng/RPC ca làm trong Supabase.</p></article><article><h4>Check-in / check-out bằng QR</h4><ol><li>Quản lý tạo mã QR cho đúng nhóm/địa điểm. Nhân viên mở trang chấm công và cho phép camera khi trình duyệt hỏi.</li><li>Quét mã tại lúc bắt đầu và quét lại khi kết thúc ca nếu quy trình yêu cầu.</li><li>Quản lý xem bản ghi và xử lý duyệt theo trạng thái.</li></ol><p><b>Lưu ý:</b> QR ghi nhận việc quét mã, không chứng minh GPS hay danh tính người đang cầm thiết bị. Chỉ chia sẻ mã tại địa điểm dự kiến và thay/thu hồi mã khi nghi bị lộ. Chấm công GPS/geofencing chưa được cung cấp.</p></article></div></section>
   <section class="guide-section" id="guide-posts"><div class="guide-heading"><span>07</span><div><h3>Bài viết, thông báo &amp; hồ sơ</h3><p>Trao đổi thông tin và quản lý thông tin tài khoản.</p></div></div><div class="guide-grid"><article><h4>Bài viết cộng đồng</h4><ul><li>Soạn nội dung, chọn chủ đề và thêm ảnh theo giới hạn hiển thị trên biểu mẫu.</li><li>Dùng bộ lọc để xem bài theo chủ đề; có thể thả cảm xúc, bình luận và trả lời bình luận.</li><li>Kiểm tra nội dung và ảnh trước khi đăng. Bài hoặc bình luận có thể được nhìn thấy bởi người dùng được cấp quyền truy cập khu vực này.</li></ul></article><article><h4>Thông báo, chat và hồ sơ</h4><ul><li>Mở biểu tượng chuông để xem thông báo; xóa/đánh dấu đã đọc theo các nút có sẵn.</li><li>Chat trực tiếp chỉ nên dùng cho nội dung công việc phù hợp; xác minh người nhận trước khi gửi tệp hoặc thông tin nhạy cảm.</li><li>Hồ sơ cho phép cập nhật tên hiển thị và tùy chọn giao diện. Đăng xuất khi dùng thiết bị dùng chung.</li></ul></article></div></section>
   <section class="guide-section guide-cautions" id="guide-data"><div class="guide-heading"><span>08</span><div><h3>Dữ liệu, quyền truy cập &amp; lưu ý</h3><p>Đọc trước khi chia sẻ, duyệt hoặc xóa dữ liệu.</p></div></div><div class="guide-grid"><article><h4>Quyền xem và chia sẻ</h4><ul><li>Người tham gia nhóm có thể xem dữ liệu lịch nhóm theo quyền được cấp; mã tham gia và liên kết chia sẻ cần được giữ riêng tư.</li><li>Lịch cá nhân có thể chứa thông tin nhạy cảm. Chỉ ghi chú những gì cần thiết; tránh nhập dữ liệu cá nhân đặc biệt hoặc bí mật công ty.</li><li>Chia sẻ .ics, liên kết xem lịch, mã QR hoặc mã nhóm có thể làm lộ lịch/khả năng tham gia cho người nhận. Thu hồi liên kết hoặc thay mã nếu bị chia sẻ nhầm.</li></ul></article><article><h4>Xóa dữ liệu và xử lý lỗi</h4><ul><li>Trưởng nhóm xóa nhóm có thể làm mất dữ liệu liên quan như lịch, trao đổi và bình chọn. Rời nhóm có thể xóa phần lịch/phiếu của bạn trong nhóm. Kiểm tra trước khi xác nhận.</li><li>Nếu chức năng không hiển thị, báo lỗi quyền hoặc thiếu bảng/cột, quản trị viên kiểm tra migration và RLS trên Supabase. Các tính năng mới cần đúng migration trước khi dùng.</li><li>Mục giờ công cần các migration <code>create_work_logs</code> và <code>work_log_approvals</code>; tính phí cần <code>work_log_billing</code>. Nghỉ phép, ca làm và QR cũng cần các migration tương ứng trong thư mục <code>supabase/migrations</code>.</li><li>Ứng dụng hiện hỗ trợ nhập/xuất lịch bằng .ics thủ công; chưa có đồng bộ hai chiều tự động, tự tạo link họp trực tuyến hoặc xác minh vị trí GPS.</li><li>Không chia sẻ mật khẩu, khóa API, chuỗi kết nối cơ sở dữ liệu hoặc dữ liệu đăng nhập trong bài viết, chat hay ghi chú.</li></ul></article></div><div class="guide-footer">Cần hỗ trợ? Gửi quản trị viên tên trang, thao tác vừa thực hiện và nội dung lỗi hiển thị; không gửi mật khẩu hoặc khóa truy cập.</div></section>
  </main></div></div>
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
  $("hp").onclick=()=>{$("help").hidden=false;const card=$("help").querySelector(".guide-card");if(card)card.scrollTop=0};$("hx").onclick=()=>{$("help").hidden=true};
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
  $("gx").onclick=()=>{$("gm").hidden=true;if(typeof stopAttendanceScanner==="function")stopAttendanceScanner()};$("gm").onclick=e=>{if(e.target.id==="gm"){$("gm").hidden=true;if(typeof stopAttendanceScanner==="function")stopAttendanceScanner()}};$("prm").onclick=e=>{if(e.target.id==="prm")e.target.hidden=true};
  $("prb").onclick=async ev=>{const a=ev.target.closest("[data-a]");if(a&&await pollAction(revId,a.dataset.a))$("prm").hidden=true};
}
document.addEventListener("keydown",e=>{if(e.key==="Escape")["help","mem","pcm","prm","apm","lb","npn","gm"].forEach(i=>{const h=$(i);if(h)h.hidden=true})});
function go(){$("tm").className=view==="me"?"on":"";$("tt").className=view==="team"?"on":"";$("tp").className=view==="posts"?"on":"";say("");view==="me"?meView():view==="posts"?postsView():teamView();}
