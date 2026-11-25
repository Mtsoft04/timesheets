/* ---------- ghi nhận giờ làm cá nhân ---------- */
let workLogs=[],activeWorkLog=null,workLogErr=null,workLogTeams=[],selectedWorkLogTeam="",workLogSubmission=null,workLogTeamErr=null,workLogBillingAvailable=false;
const wlWeekRange=()=>{const start=new Date(weekStart.getFullYear(),weekStart.getMonth(),weekStart.getDate());return[fmt(start),fmt(addD(start,7))]};
const wlTaskId=title=>(myTk.find(t=>t.title.trim()===title.trim())||{}).id||null;
const wlDuration=(start,end)=>{const mins=Math.max(0,Math.floor(((end?new Date(end):new Date())-new Date(start))/60000));return Math.floor(mins/60)+"h "+String(mins%60).padStart(2,"0")+"m"};
const wlDurationMs=ms=>{const mins=Math.max(0,Math.floor(ms/60000));return Math.floor(mins/60)+"h "+String(mins%60).padStart(2,"0")+"m"};
const wlDate=s=>new Date(s).toLocaleString("vi-VN",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
const wlLocalValue=d=>{const x=new Date(d),p=n=>String(n).padStart(2,"0");return x.getFullYear()+"-"+p(x.getMonth()+1)+"-"+p(x.getDate())+"T"+p(x.getHours())+":"+p(x.getMinutes())};
async function loadWorkLogs(){
  workLogErr=null;workLogTeamErr=null;workLogSubmission=null;const[from,to]=wlWeekRange();
  const[t,a,b,billing]=await Promise.all([
    SB.from("teams").select("id,name").order("created_at"),
    SB.from("work_logs").select("*").eq("user_id",user.id).is("end_at",null).maybeSingle(),
    SB.from("work_logs").select("*").eq("user_id",user.id).not("end_at","is",null).gte("work_date",from).lt("work_date",to).order("start_at",{ascending:false}).limit(50),
    SB.from("work_logs").select("billable,hourly_rate").limit(0)
  ]);
  if(t.error)workLogTeamErr=t.error.message;workLogTeams=t.data||[];
  workLogBillingAvailable=!billing.error;
  if(a.error||b.error){workLogErr=(a.error||b.error).message;activeWorkLog=null;workLogs=[];return;}
  activeWorkLog=a.data||null;workLogs=b.data||[];
  if(activeWorkLog)selectedWorkLogTeam=activeWorkLog.team_id||"";
  else if(selectedWorkLogTeam&&!workLogTeams.some(x=>x.id===selectedWorkLogTeam))selectedWorkLogTeam="";
  if(selectedWorkLogTeam){const s=await SB.from("work_log_submissions").select("*").eq("team_id",selectedWorkLogTeam).eq("user_id",user.id).eq("week_start",from).maybeSingle();if(s.error)workLogErr=s.error.message;else workLogSubmission=s.data||null;}
}
function timeLogCard(){return `<aside class="card side notes time-tracker-card" id="wl-card"><h2>⏱️ Theo dõi giờ làm</h2>${timeLogInner()}</aside>`;}
function timeLogInner(){
  if(workLogErr)return `<div class="wl-error">Chưa tải được dữ liệu bảng công. Hãy chạy lần lượt các migration theo thứ tự trong README, gồm <b>create_work_logs</b>, <b>work_log_approvals</b> và <b>work_log_billing</b> trong Supabase → SQL Editor.<div class="mut">${esc(workLogErr)}</div></div>`;
  const scoped=workLogs.filter(w=>(w.team_id||"")===selectedWorkLogTeam),activeInScope=activeWorkLog&&(activeWorkLog.team_id||"")===selectedWorkLogTeam,locked=!!(workLogSubmission&&["submitted","approved"].includes(workLogSubmission.status));
  const total=scoped.reduce((n,w)=>n+(new Date(w.end_at)-new Date(w.start_at)),0)+(activeInScope?Math.max(0,Date.now()-Math.max(new Date(activeWorkLog.start_at).getTime(),weekStart.getTime())):0),billableCost=scoped.filter(w=>w.billable).reduce((n,w)=>n+Math.max(0,new Date(w.end_at)-new Date(w.start_at))/3600000*Number(w.hourly_rate||0),0);
  const billingFields=workLogBillingAvailable?`<label class="wl-billing"><input id="wl-billable" type="checkbox"> Giờ tính phí</label><label class="f">Đơn giá (₫/giờ)<input id="wl-rate" type="number" min="0" max="1000000000" step="1000" value="0" aria-label="Đơn giá mỗi giờ"></label>`:"";
  const scope=`<label class="wl-scope">Ghi giờ cho<select id="wl-team" ${activeWorkLog?"disabled":""}><option value="" ${!selectedWorkLogTeam?"selected":""}>Chỉ mình tôi</option>${workLogTeams.map(t=>`<option value="${t.id}" ${selectedWorkLogTeam===t.id?"selected":""}>${esc(t.name)}</option>`).join("")}</select></label>${workLogTeamErr?`<div class="mut wl-team-error">Không tải được danh sách nhóm: ${esc(workLogTeamErr)}</div>`:""}`;
  const teamName=workLogTeams.find(t=>t.id===selectedWorkLogTeam)?.name||"Nhóm";
  const status=selectedWorkLogTeam?`<div class="wl-submission"><div class="wl-submission-status"><b>Bảng công · ${esc(teamName)}</b><span class="tag ${workLogSubmission?.status==="approved"?"ok":workLogSubmission?.status==="submitted"?"open":""}">${workLogSubmission?({submitted:"Đã nộp",approved:"Đã duyệt",rejected:"Cần chỉnh sửa",draft:"Bản nháp"}[workLogSubmission.status]||""):"Chưa nộp"}</span></div>${workLogSubmission?.reject_reason?`<div class="wl-reject-reason">Lý do: ${esc(workLogSubmission.reject_reason)}</div>`:""}${locked?`<div class="mut">Kỳ này đã khóa chỉnh sửa.</div>`:`<div class="mut">Giờ đã lưu trong nhóm này chỉ chuyển sang hàng chờ của trưởng nhóm sau khi bạn nộp bảng công tuần.</div><button type="button" class="p" data-wl-submit ${(!scoped.some(w=>w.end_at)||activeInScope)?"disabled":""}>${workLogSubmission?.status==="rejected"?"Nộp lại tuần này":"Nộp tuần này để trưởng nhóm duyệt"}</button>`}</div>`:"";
  const active=activeInScope?`<div class="wl-active"><div class="wl-live"><i></i><b>Đang bấm giờ</b><span class="sp"></span><b id="wl-elapsed">${wlDuration(activeWorkLog.start_at)}</b></div><div class="wl-title">${esc(activeWorkLog.task_title)}</div>${activeWorkLog.note?`<div class="mut">${esc(activeWorkLog.note)}</div>`:""}<button class="p" type="button" data-wl-stop>■ Dừng và lưu</button></div>`
   :activeWorkLog?`<div class="mut">Đang có đồng hồ chạy cho nhóm khác. Hãy dừng đồng hồ đó trước khi đổi nhóm.</div>`
   :locked?`<div class="wl-lock-note">🔒 Tuần này đã nộp/duyệt, không thể thêm giờ mới.</div>`
   :`<div class="wl-start-form"><input id="wl-task" maxlength="200" list="wl-task-options" placeholder="Tên công việc" aria-label="Tên công việc"><datalist id="wl-task-options">${myTk.map(t=>`<option value="${esc(t.title)}">`).join("")}</datalist>${billingFields}<textarea id="wl-note" maxlength="1000" rows="2" placeholder="Ghi chú (không bắt buộc)" aria-label="Ghi chú"></textarea><button class="p" type="button" data-wl-start>▶ Bắt đầu bấm giờ</button></div>`;
  const logs=scoped.slice(0,8).map(w=>{const ms=Math.max(0,new Date(w.end_at)-new Date(w.start_at)),cost=w.billable?ms/3600000*Number(w.hourly_rate||0):0;return `<div class="wl-item"><div class="wl-item-head"><b>${esc(w.task_title)}</b>${locked?"":`<button type="button" class="wl-edit" data-wl-edit="${w.id}" title="Chỉnh thời gian">✎</button>`}</div><div class="mut">${selectedWorkLogTeam?`Nhóm: ${esc(teamName)} · `:"Cá nhân · "}${wlDate(w.start_at)} – ${wlDate(w.end_at)} · <b>${wlDuration(w.start_at,w.end_at)}</b></div><div class="mut">${w.billable?`Tính phí · ${Number(w.hourly_rate||0).toLocaleString("vi-VN")} ₫/giờ · ${Math.round(cost).toLocaleString("vi-VN")} ₫`:"Không tính phí"}</div>${w.note?`<div class="wl-note">${esc(w.note)}</div>`:""}</div>`}).join("");
  return `${scope}${status}${active}<div class="wl-actions"><button type="button" data-wl-manual ${locked||activeWorkLog?"disabled":""}>＋ Nhập giờ thủ công</button></div><div class="wl-summary">${selectedWorkLogTeam?`Tuần này · nhóm ${esc(teamName)}`:"Tuần này · cá nhân"}<b>${wlDurationMs(total)}</b></div><div class="mut">${workLogBillingAvailable?`Chi phí dự kiến: <b>${Math.round(billableCost).toLocaleString("vi-VN")} ₫</b>`:"Tính phí chưa bật; giờ làm vẫn lưu bình thường. Cần áp dụng migration work_log_billing."}</div><div class="wl-list">${logs||"<span class='mut'>Chưa có giờ làm trong kỳ này.</span>"}</div>`;
}
function paintWorkLogs(){const card=$("wl-card");if(!card)return;card.innerHTML=`<h2>⏱️ Theo dõi giờ làm</h2>${timeLogInner()}`;bindWorkLogs();}
function bindWorkLogs(){const card=$("wl-card");if(!card)return;
  card.onchange=async ev=>{if(ev.target.id==="wl-team"){selectedWorkLogTeam=ev.target.value;await loadWorkLogs();paintWorkLogs();return;}if(ev.target.id==="wl-task"){const t=myTk.find(x=>x.title.trim()===ev.target.value.trim());if(t&&t.team_id){selectedWorkLogTeam=t.team_id;await loadWorkLogs();paintWorkLogs();}}};
  card.onclick=ev=>{const b=ev.target.closest("[data-wl-start],[data-wl-stop],[data-wl-manual],[data-wl-edit],[data-wl-submit]");if(!b)return;
    if(b.hasAttribute("data-wl-start"))return startWorkLog();
    if(b.hasAttribute("data-wl-stop"))return stopWorkLog();
    if(b.hasAttribute("data-wl-manual"))return openWorkLogForm();
    if(b.hasAttribute("data-wl-submit"))return submitWorkLogWeek();
    if(b.dataset.wlEdit){const w=workLogs.find(x=>x.id===b.dataset.wlEdit);if(w)openWorkLogForm(w);}};
  card.onkeydown=ev=>{if(ev.key==="Enter"&&!ev.isComposing&&ev.target.id==="wl-task"){ev.preventDefault();startWorkLog();}};
}
async function startWorkLog(){
  const title=$("wl-task").value.trim();if(!title)return say("Hãy nhập tên công việc trước khi bấm giờ.");
  const now=new Date(),task=myTk.find(t=>t.title.trim()===title);
  if(task?.team_id)selectedWorkLogTeam=task.team_id;
  if(task&&!task.team_id&&selectedWorkLogTeam)return say("Công việc cá nhân không thể ghi vào bảng công nhóm. Hãy nhập tên việc khác hoặc chọn “Chỉ mình tôi”.");
  const b=document.querySelector("[data-wl-start]");if(b)b.disabled=true;
  const rate=workLogBillingAvailable?Math.max(0,Number($("wl-rate").value)||0):0,billable=workLogBillingAvailable&&$("wl-billable").checked;
  const payload={user_id:user.id,team_id:selectedWorkLogTeam||null,work_date:fmt(now),task_id:wlTaskId(title),task_title:title,note:$("wl-note").value.trim(),start_at:now.toISOString()};if(workLogBillingAvailable){payload.billable=billable;payload.hourly_rate=billable?rate:0;}
  try{const r=await SB.from("work_logs").insert(payload).select().single();
    if(r.error){if(b)b.disabled=false;return say(/duplicate|unique/i.test(r.error.message)?"Bạn đang có một đồng hồ chạy. Hãy dừng đồng hồ đó trước.":"Không bắt đầu được: "+r.error.message);}
    if(!r.data){if(b)b.disabled=false;return say("Supabase không trả bản ghi giờ công đã lưu. Kiểm tra quyền SELECT/INSERT trên work_logs.");}
    activeWorkLog=r.data;await loadWorkLogs();paintWorkLogs();say("▶ Đã bắt đầu bấm giờ.");
  }catch(e){if(b)b.disabled=false;say("Không kết nối/lưu được giờ công: "+(e.message||e));}
}
async function stopWorkLog(){if(!activeWorkLog)return;const stop=document.querySelector("[data-wl-stop]");if(stop)stop.disabled=true;
  const r=await SB.from("work_logs").update({end_at:new Date().toISOString()}).eq("id",activeWorkLog.id).eq("user_id",user.id).is("end_at",null).select().maybeSingle();
  if(r.error||!r.data){if(stop)stop.disabled=false;return say("Không dừng được đồng hồ: "+(r.error?r.error.message:"bản ghi đã được cập nhật ở nơi khác."));}
  await loadWorkLogs();paintWorkLogs();say("✓ Đã lưu giờ làm: "+wlDuration(r.data.start_at,r.data.end_at));
}
function openWorkLogForm(row=null){
  const now=new Date(),start=row?new Date(row.start_at):new Date(now.getTime()-60*60000),end=row?new Date(row.end_at):now;
  const billingFields=workLogBillingAvailable?`<label class="wl-billing"><input id="wlm-billable" type="checkbox" ${row?.billable?"checked":""}> Giờ tính phí</label><label class="f">Đơn giá (₫/giờ)<input id="wlm-rate" type="number" min="0" max="1000000000" step="1000" value="${Number(row?.hourly_rate||0)}"></label>`:"<div class='mut'>Tính phí chưa bật; có thể lưu giờ làm bình thường.</div>";
  openGm(row?"✎ Chỉnh giờ làm":"＋ Nhập giờ làm thủ công",`<div class="xfrm wl-form"><label class="f">Nhóm<select id="wlm-team" ${row?"disabled":""}><option value="" ${!(row?row.team_id:selectedWorkLogTeam)?"selected":""}>Chỉ mình tôi</option>${workLogTeams.map(t=>`<option value="${t.id}" ${(row?row.team_id:selectedWorkLogTeam)===t.id?"selected":""}>${esc(t.name)}</option>`).join("")}</select></label><label class="f">Công việc<input id="wlm-task" maxlength="200" list="wlm-task-options" value="${esc(row?row.task_title:"")}" placeholder="Tên công việc"></label><datalist id="wlm-task-options">${myTk.map(t=>`<option value="${esc(t.title)}">`).join("")}</datalist>${billingFields}<label class="f">Ghi chú<textarea id="wlm-note" maxlength="1000" rows="3">${esc(row?row.note||"":"")}</textarea></label><div class="row"><label class="f sp">Bắt đầu<input id="wlm-start" type="datetime-local" value="${wlLocalValue(start)}"></label><label class="f sp">Kết thúc<input id="wlm-end" type="datetime-local" value="${wlLocalValue(end)}"></label></div><div class="row" style="justify-content:flex-end"><button type="button" id="wlm-cancel">Hủy</button><button type="button" class="p" id="wlm-save">${row?"Lưu thay đổi":"Lưu giờ làm"}</button></div></div>`);
  $("wlm-cancel").onclick=()=>{$("gm").hidden=true};$("wlm-save").onclick=()=>saveWorkLog(row);
}
async function saveWorkLog(row){
  const title=$("wlm-task").value.trim(),s=$("wlm-start").value,e=$("wlm-end").value;
  if(!title)return say("Hãy nhập tên công việc.");if(!s||!e)return say("Hãy nhập đủ thời gian bắt đầu và kết thúc.");
  const start=new Date(s),end=new Date(e);if(!Number.isFinite(+start)||!Number.isFinite(+end)||end<=start)return say("Thời gian kết thúc phải sau thời gian bắt đầu.");if(end>Date.now())return say("Giờ làm đã ghi nhận không thể kết thúc trong tương lai.");
  const task=myTk.find(t=>t.title.trim()===title),teamId=row?row.team_id:$("wlm-team").value||null;
  if(task&&(task.team_id||null)!==teamId)return say("Công việc này thuộc phạm vi khác. Hãy chọn đúng nhóm hoặc ghi tên việc khác.");
  const billable=workLogBillingAvailable&&$("wlm-billable").checked,rate=workLogBillingAvailable?Math.max(0,Number($("wlm-rate").value)||0):0;
  const payload={team_id:teamId,work_date:fmt(start),task_id:wlTaskId(title),task_title:title,note:$("wlm-note").value.trim(),start_at:start.toISOString(),end_at:end.toISOString()};if(workLogBillingAvailable){payload.billable=billable;payload.hourly_rate=billable?rate:0;}
  const btn=$("wlm-save");btn.disabled=true;
  let q=row?SB.from("work_logs").update(payload).eq("id",row.id).eq("user_id",user.id):SB.from("work_logs").insert({...payload,user_id:user.id});
  try{const r=await q.select().maybeSingle();if(r.error||!r.data){btn.disabled=false;return say("Không lưu được giờ làm: "+(r.error?r.error.message:"không nhận được bản ghi sau khi lưu; kiểm tra quyền INSERT/SELECT và RLS trên work_logs."));}
    $("gm").hidden=true;await loadWorkLogs();paintWorkLogs();say(row?"✓ Đã cập nhật giờ làm.":"✓ Đã thêm giờ làm.");
  }catch(e){btn.disabled=false;say("Không kết nối/lưu được giờ công: "+(e.message||e));}
}
async function submitWorkLogWeek(){
  if(!selectedWorkLogTeam)return;const btn=document.querySelector("[data-wl-submit]");if(btn)btn.disabled=true;
  const r=await SB.rpc("submit_work_log_week",{p_team:selectedWorkLogTeam,p_week_start:wkRange()[0]});
  if(r.error){if(btn)btn.disabled=false;return say("Không nộp được bảng công: "+r.error.message);}
  await loadWorkLogs();paintWorkLogs();say("✓ Đã nộp bảng công tuần này cho trưởng nhóm.");
}
function openTimesheetApprovals(){
  if(view!=="team"||!team||!isAdminT())return say("Chỉ trưởng nhóm hoặc quản trị viên được duyệt giờ công.");
  openGm("🧾 Duyệt giờ công · "+team.name,`<div class="wla-panel"><label class="f">Chọn một ngày trong tuần<input id="wla-week" type="date" value="${fmt(weekStart)}"></label><div id="wla-content" class="mut">Đang tải bảng công…</div></div>`);
  const from=$("wla-week");from.onchange=()=>loadTimesheetApprovals(from.value);
  loadTimesheetApprovals(from.value);
}
function exportTimesheetCsv(rows,submissions,weekStartDate,teamName){
  const state=new Map(submissions.map(s=>[s.user_id,s.status])),csvCell=v=>{let s=String(v??"");if(/^[=+@\-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  const header=["Nhóm","Tuần bắt đầu","Thành viên ID","Trạng thái","Công việc","Ngày","Bắt đầu","Kết thúc","Giờ","Loại giờ","Đơn giá (VND/giờ)","Chi phí (VND)","Ghi chú"];
  const body=rows.map(w=>{const ms=Math.max(0,new Date(w.end_at)-new Date(w.start_at)),hours=ms/3600000,rate=Number(w.hourly_rate||0),cost=w.billable?Math.round(hours*rate):0;return[teamName,weekStartDate,w.user_id,state.get(w.user_id)||"—",w.task_title,fmt(new Date(w.start_at)),new Date(w.start_at).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit",hour12:false}),w.end_at?new Date(w.end_at).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit",hour12:false}):"",hours.toFixed(2),w.billable?"Tính phí":"Không tính phí",w.billable?rate:0,cost,w.note||""];});
  const content="\uFEFF"+[header,...body].map(r=>r.map(csvCell).join(",")).join("\r\n"),blob=new Blob([content],{type:"text/csv;charset=utf-8;"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`bang-cong-${weekStartDate}-${teamName.replace(/[^\p{L}\p{N}-]+/gu,"-")}.csv`;a.click();URL.revokeObjectURL(url);
}
async function loadTimesheetApprovals(day){
  const el=$("wla-content");if(!el||!team)return;el.innerHTML="<div class='mut'>Đang tải bảng công…</div>";
  const monday=mondayOf(parse(day||fmt(weekStart))),from=fmt(monday),to=fmt(addD(monday,7)),tid=team.id;
  const sr=await SB.from("work_log_submissions").select("*").eq("team_id",tid).eq("week_start",from).order("created_at");
  if(sr.error){el.innerHTML=`<div class="wl-error">Chưa tải được các lần nộp. Hãy chạy <b>supabase/migrations/20261125_work_log_approvals.sql</b> trong Supabase → SQL Editor.<div class="mut">${esc(sr.error.message)}</div></div>`;return;}
  const submissions=sr.data||[],ids=submissions.map(s=>s.id);
  const userIds=[...new Set(submissions.map(s=>s.user_id))];
  const [wr,er]=await Promise.all([
    SB.from("work_logs").select("*").eq("team_id",tid).gte("work_date",from).lt("work_date",to).order("start_at"),
    ids.length?SB.from("work_log_submission_events").select("*").in("submission_id",ids).order("created_at",{ascending:false}):Promise.resolve({data:[],error:null})
  ]);
  if(wr.error||er.error){el.innerHTML=`<div class="wl-error">Không tải được chi tiết hoặc lịch sử: ${esc((wr.error||er.error).message)}</div>`;return;}
  const entries=wr.data||[],events=er.data||[];
  const cr=userIds.length?await SB.from("work_log_changes").select("*").eq("team_id",tid).in("user_id",userIds).order("changed_at",{ascending:false}).limit(500):{data:[],error:null};
  if(cr.error){el.innerHTML=`<div class="wl-error">Không tải được nhật ký thay đổi: ${esc(cr.error.message)}</div>`;return;}
  const status={submitted:"Đã nộp",approved:"Đã duyệt",rejected:"Cần chỉnh sửa",draft:"Đã mở lại"},changesAll=(cr.data||[]).filter(x=>{const a=x.after_entry?.work_date,b=x.before_entry?.work_date;return(a>=from&&a<to)||(b>=from&&b<to)});
  const person=id=>(members.find(m=>m.user_id===id)||{}).name||(id===user.id?"Bạn":"Thành viên"),actionName={submitted:"Đã nộp",resubmitted:"Nộp lại",approved:"Đã duyệt",rejected:"Từ chối",reopened:"Mở lại",inserted:"Thêm mục",updated:"Sửa mục",deleted:"Xóa mục"};
  const cards=submissions.map(s=>{
    const mine=entries.filter(w=>w.user_id===s.user_id),ms=mine.reduce((n,w)=>n+(w.end_at?new Date(w.end_at)-new Date(w.start_at):0),0),cost=mine.filter(w=>w.billable&&w.end_at).reduce((n,w)=>n+(new Date(w.end_at)-new Date(w.start_at))/3600000*Number(w.hourly_rate||0),0),evs=events.filter(x=>x.submission_id===s.id),changes=changesAll.filter(x=>x.user_id===s.user_id);
    const rows=mine.map(w=>{const hours=w.end_at?Math.max(0,new Date(w.end_at)-new Date(w.start_at))/3600000:0,amount=w.billable?hours*Number(w.hourly_rate||0):0;return `<div class="wla-entry"><b>${esc(w.task_title)}</b><span>${wlDate(w.start_at)}–${wlDate(w.end_at)} · ${w.end_at?wlDuration(w.start_at,w.end_at):"Đang chạy"} · ${w.billable?`Tính phí · ${Number(w.hourly_rate||0).toLocaleString("vi-VN")} ₫/giờ · ${Math.round(amount).toLocaleString("vi-VN")} ₫`:"Không tính phí"}</span>${w.note?`<small>${esc(w.note)}</small>`:""}</div>`}).join("");
    const hist=evs.map(x=>`<div>${wlDate(x.created_at)} · ${esc(person(x.actor_id))}: ${esc(actionName[x.action]||x.action)}${x.reason?` — ${esc(x.reason)}`:""}</div>`).join("");
    const audit=changes.slice(0,12).map(x=>{const old=x.before_entry||{},next=x.after_entry||{},diff=[];if(old.task_title!==next.task_title)diff.push("công việc: "+(old.task_title||"—")+" → "+(next.task_title||"—"));if(old.start_at!==next.start_at)diff.push("bắt đầu: "+(old.start_at?wlDate(old.start_at):"—")+" → "+(next.start_at?wlDate(next.start_at):"—"));if(old.end_at!==next.end_at)diff.push("kết thúc: "+(old.end_at?wlDate(old.end_at):"—")+" → "+(next.end_at?wlDate(next.end_at):"—"));if(old.note!==next.note)diff.push("ghi chú: "+(old.note||"—")+" → "+(next.note||"—"));return `<div>${wlDate(x.changed_at)} · ${esc(person(x.actor_id))}: ${esc(actionName[x.action]||x.action)}${diff.length?` — ${esc(diff.join("; "))}`:old.task_title||next.task_title?` · ${esc(old.task_title||next.task_title)}`:""}</div>`}).join("");
    const self=s.user_id===user.id,actions=s.status==="submitted"&&!self?`<div class="wla-review"><button class="p" data-wla-action="approve" data-wla-id="${s.id}">✓ Duyệt</button><input id="wlr-${s.id}" maxlength="1000" placeholder="Lý do từ chối"><button data-wla-action="reject" data-wla-id="${s.id}">Từ chối</button></div>`:s.status==="approved"&&!self?`<button data-wla-action="reopen" data-wla-id="${s.id}">↶ Mở lại kỳ đã duyệt</button>`:s.status==="submitted"?`<div class="mut">Bạn không thể tự duyệt kỳ công của mình.</div>`:"";
    return `<article class="wla-card"><header><div><b>${esc(person(s.user_id))}</b><div class="mut">${mine.length} mục · tổng ${wlDurationMs(ms)} · chi phí tính phí ${Math.round(cost).toLocaleString("vi-VN")} ₫</div></div><span class="tag ${s.status==="approved"?"ok":s.status==="submitted"?"open":""}">${status[s.status]||esc(s.status)}</span></header><div class="wla-entries">${rows||"<span class='mut'>Không còn mục giờ làm trong tuần này.</span>"}</div>${s.reject_reason?`<div class="wl-reject-reason">Lý do từ chối: ${esc(s.reject_reason)}</div>`:""}${actions}${hist||audit?`<details class="wla-history"><summary>Lịch sử nộp và chỉnh sửa</summary>${hist?`<div><b>Trạng thái</b>${hist}</div>`:""}${audit?`<div><b>Thay đổi giờ làm</b>${audit}</div>`:""}</details>`:""}</article>`;
  }).join("");
  const billableEntries=entries.filter(w=>w.billable),billableMs=billableEntries.reduce((n,w)=>n+(w.end_at?Math.max(0,new Date(w.end_at)-new Date(w.start_at)):0),0),estimatedCost=billableEntries.reduce((n,w)=>n+(w.end_at?Math.max(0,new Date(w.end_at)-new Date(w.start_at))/3600000*Number(w.hourly_rate||0):0),0);
  el.innerHTML=`<div class="wla-head"><div>Tuần ${dm(monday)} – ${dm(addD(monday,6))}/${addD(monday,6).getFullYear()}<small class="mut">${submissions.filter(s=>s.status==="submitted").length} đang chờ duyệt · ${submissions.length} lần nộp<br>Giờ tính phí: ${wlDurationMs(billableMs)} · Chi phí dự kiến: ${Math.round(estimatedCost).toLocaleString("vi-VN")} ₫</small></div><button type="button" class="p" id="wla-export" ${entries.length?"":"disabled"}>↓ Xuất bảng công CSV</button></div>${cards||"<div class='mut wla-empty'>Chưa có thành viên nào nộp bảng công trong tuần này.</div>"}`;
  const exportBtn=$("wla-export");if(exportBtn)exportBtn.onclick=()=>exportTimesheetCsv(entries,submissions,from,team.name);
  el.onclick=async ev=>{const b=ev.target.closest("[data-wla-action]");if(!b)return;const action=b.dataset.wlaAction,id=b.dataset.wlaId,reason=action==="reject"?$("wlr-"+id).value.trim():"";
    if(action==="reject"&&!reason)return say("Nhập lý do từ chối trước.");if(action==="approve"&&!confirm("Duyệt và khóa kỳ công này?"))return;if(action==="reopen"&&!confirm("Mở lại kỳ đã duyệt để thành viên chỉnh sửa?"))return;
    b.disabled=true;const r=await SB.rpc("review_work_log_submission",{p_submission:id,p_action:action,p_reason:reason});if(r.error){b.disabled=false;return say("Không cập nhật được trạng thái: "+r.error.message);}say(action==="approve"?"✓ Đã duyệt và khóa kỳ công.":action==="reject"?"Đã từ chối và gửi lý do cho thành viên.":"Đã mở lại kỳ công.");await loadTimesheetApprovals($("wla-week").value);};
}
setInterval(()=>{const el=$("wl-elapsed");if(el&&activeWorkLog)el.textContent=wlDuration(activeWorkLog.start_at)},1000);
