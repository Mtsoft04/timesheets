/* ---------- nghi phep va tang ca ---------- */
let timeOffRequests=[],timeOffError=null,personalTimeOffSlots=new Map(),teamTimeOffSlots=[];
const timeOffLabels={leave:"Nghỉ phép",overtime:"Tăng ca",pending:"Chờ duyệt",approved:"Đã duyệt",rejected:"Từ chối",cancelled:"Đã hủy"};
function timeOffSlotRows(requests,from,to){
  const out=[],lo=parse(from),hi=parse(to);
  for(const r of requests){if(r.status!=="approved")continue;const start=new Date(r.starts_at),end=new Date(r.ends_at);if(!Number.isFinite(+start)||!Number.isFinite(+end)||end<=lo||start>=hi)continue;
    const p=new Date(Math.max(+start,+lo));p.setMinutes(0,0,0);const stop=Math.min(+end,+hi);
    while(+p<stop){const date=fmt(p);out.push({user_id:r.user_id,slot_date:date,hour:p.getHours(),label:r.request_type==="leave"?"Nghỉ":"Tăng ca",note:r.request_type==="leave"?"Nghỉ phép đã duyệt":"Tăng ca đã duyệt",time_off_id:r.id});p.setHours(p.getHours()+1);}
  }
  return out;
}
function personalTimeOffCell(k){const items=personalTimeOffSlots.get(k);return items?.length?{cls:"busy timeoff",txt:items[0].label,tip:items.map(x=>x.note).join("\n")}:null;}
function teamTimeOffCell(k){const items=teamTimeOffSlots.filter(x=>K(x.slot_date,x.hour)===k&&x.user_id===user.id);return items.length?{cls:"busy timeoff",txt:items[0].label,tip:items.map(x=>x.note).join("\n")}:null;}
async function loadTimeOff(){
  timeOffError=null;const r=await SB.from("time_off_requests").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(30);
  if(r.error){timeOffError=r.error.message;timeOffRequests=[];personalTimeOffSlots=new Map();return;}
  timeOffRequests=r.data||[];const[a,b]=wlWeekRange(),rows=timeOffSlotRows(timeOffRequests,a,b),map=new Map();
  for(const x of rows){const k=K(x.slot_date,x.hour);map.set(k,[...(map.get(k)||[]),x]);}personalTimeOffSlots=map;
}
function timeOffCard(){return `<aside class="card side notes time-off-card" id="timeoff-card"><h2>🌿 Nghỉ phép &amp; tăng ca</h2>${timeOffInner()}</aside>`;}
function timeOffInner(){
  const items=timeOffRequests.slice(0,5).map(r=>`<div class="to-item"><div><b>${timeOffLabels[r.request_type]||r.request_type}</b><span class="tag ${r.status==="approved"?"ok":r.status==="pending"?"open":""}">${timeOffLabels[r.status]||r.status}</span></div><small>${wlDate(r.starts_at)} – ${wlDate(r.ends_at)}</small>${r.reason?`<small>${esc(r.reason)}</small>`:""}${r.review_reason?`<small class="wl-reject-reason">Lý do: ${esc(r.review_reason)}</small>`:""}${r.status==="pending"?`<button type="button" data-to-cancel="${r.id}">Hủy yêu cầu</button>`:""}</div>`).join("");
  return `${timeOffError?`<div class="wl-error">Chưa tải được yêu cầu. Hãy chạy migration <b>20261125_time_off_requests.sql</b> sau migration duyệt giờ công.<small>${esc(timeOffError)}</small></div>`:`<button type="button" class="p" data-to-new>＋ Xin nghỉ / tăng ca</button>`}<div class="to-list">${items||(!timeOffError?"<span class='mut'>Chưa có yêu cầu trong lịch sử.</span>":"")}</div>`;
}
function paintTimeOff(){const el=$("timeoff-card");if(el){el.innerHTML=`<h2>🌿 Nghỉ phép &amp; tăng ca</h2>${timeOffInner()}`;bindTimeOff();}}
function bindTimeOff(){const el=$("timeoff-card");if(!el)return;el.onclick=async ev=>{if(ev.target.closest("[data-to-new]")){openTimeOffForm();return;}const b=ev.target.closest("[data-to-cancel]");if(b){if(!confirm("Hủy yêu cầu đang chờ duyệt này?"))return;b.disabled=true;const r=await SB.rpc("cancel_time_off_request",{p_request:b.dataset.toCancel});if(r.error){b.disabled=false;return say("Không hủy được yêu cầu: "+r.error.message);}await loadTimeOff();paintTimeOff();say("Đã hủy yêu cầu.");}};}
function openTimeOffForm(){
  if(timeOffError)return say("Cơ sở dữ liệu nghỉ phép chưa sẵn sàng. Hãy áp dụng migration 20261125_time_off_requests.sql.");
  if(!workLogTeams.length)return say("Bạn cần tham gia ít nhất một nhóm để gửi yêu cầu cho trưởng nhóm.");
  const now=new Date(),start=new Date(now.getTime()+3600000),end=new Date(start.getTime()+3600000),p=d=>wlLocalValue(d);
  openGm("🌿 Xin nghỉ phép / tăng ca",`<div class="xfrm wl-form"><label class="f">Loại yêu cầu<select id="to-type"><option value="leave">Nghỉ phép</option><option value="overtime">Tăng ca</option></select></label><label class="f">Gửi trưởng nhóm<select id="to-team">${workLogTeams.map((t,i)=>`<option value="${t.id}" ${i===0?"selected":""}>${esc(t.name)}</option>`).join("")}</select></label><label class="f">Bắt đầu<input id="to-start" type="datetime-local" value="${p(start)}"></label><label class="f">Kết thúc<input id="to-end" type="datetime-local" value="${p(end)}"></label><label class="f">Lý do<textarea id="to-reason" maxlength="1000" rows="3" placeholder="Nội dung gửi trưởng nhóm"></textarea></label><label class="wl-billing"><input id="to-all" type="checkbox" checked> Cập nhật trạng thái bận ở tất cả nhóm tôi tham gia</label><div class="row" style="justify-content:flex-end"><button type="button" id="to-cancel">Đóng</button><button type="button" class="p" id="to-save">Gửi yêu cầu</button></div></div>`);
  $("to-cancel").onclick=()=>$("gm").hidden=true;$("to-save").onclick=submitTimeOff;
}
async function submitTimeOff(){
  const start=new Date($("to-start").value),end=new Date($("to-end").value);if(!Number.isFinite(+start)||!Number.isFinite(+end)||end<=start)return say("Thời điểm kết thúc phải sau thời điểm bắt đầu.");
  const btn=$("to-save");btn.disabled=true;const r=await SB.from("time_off_requests").insert({user_id:user.id,team_id:$("to-team").value,request_type:$("to-type").value,applies_to_all_teams:$("to-all").checked,starts_at:start.toISOString(),ends_at:end.toISOString(),reason:$("to-reason").value.trim()}).select().single();
  if(r.error){btn.disabled=false;return say("Không gửi được yêu cầu: "+r.error.message);}
  $("gm").hidden=true;await loadTimeOff();paintTimeOff();say("Đã gửi yêu cầu cho trưởng nhóm.");
}
function openTimeOffApprovals(){
  if(view!=="team"||!team||!isAdminT())return say("Chỉ trưởng nhóm hoặc quản trị viên được duyệt yêu cầu.");
  openGm("🌿 Duyệt nghỉ phép &amp; tăng ca · "+team.name,`<div class="wla-panel"><div id="to-approvals" class="mut">Đang tải yêu cầu…</div></div>`);loadTimeOffApprovals();
}
async function loadTimeOffApprovals(){
  const el=$("to-approvals");if(!el||!team)return;const r=await SB.from("time_off_requests").select("*").eq("team_id",team.id).order("created_at",{ascending:false}).limit(100);
  if(r.error){el.innerHTML=`<div class="wl-error">Chưa tải được yêu cầu. Hãy áp dụng migration <b>20261125_time_off_requests.sql</b>.<small>${esc(r.error.message)}</small></div>`;return;}
  const requests=r.data||[],statusRows=requests.map(x=>{const member=members.find(m=>m.user_id===x.user_id),name=member?.name||(x.user_id===user.id?"Bạn":"Thành viên"),act=x.status==="pending"&&x.user_id!==user.id?`<div class="to-actions"><input id="tor-${x.id}" maxlength="1000" placeholder="Lý do nếu từ chối"><button class="p" data-to-review="approve" data-to-id="${x.id}">Duyệt</button><button data-to-review="reject" data-to-id="${x.id}">Từ chối</button></div>`:"";
    return `<article class="wla-card"><header><div><b>${esc(name)} · ${timeOffLabels[x.request_type]}</b><div class="mut">${wlDate(x.starts_at)} – ${wlDate(x.ends_at)}${x.applies_to_all_teams?" · áp dụng mọi nhóm":" · chỉ nhóm này"}</div></div><span class="tag ${x.status==="approved"?"ok":x.status==="pending"?"open":""}">${timeOffLabels[x.status]}</span></header>${x.reason?`<div class="mut">Lý do: ${esc(x.reason)}</div>`:""}${x.review_reason?`<div class="wl-reject-reason">Phản hồi: ${esc(x.review_reason)}</div>`:""}${act}</article>`;
  }).join("");
  el.innerHTML=statusRows||"<div class='mut wla-empty'>Chưa có yêu cầu nghỉ phép hoặc tăng ca.</div>";
  el.onclick=async ev=>{const b=ev.target.closest("[data-to-review]");if(!b)return;const action=b.dataset.toReview,id=b.dataset.toId,reason=action==="reject"?$("tor-"+id).value.trim():"";if(action==="reject"&&!reason)return say("Nhập lý do từ chối trước.");if(action==="approve"&&!confirm("Duyệt yêu cầu và cập nhật bận trên lịch nhóm?"))return;b.disabled=true;const res=await SB.rpc("review_time_off_request",{p_request:id,p_action:action,p_reason:reason});if(res.error){b.disabled=false;return say("Không xử lý được yêu cầu: "+res.error.message);}await loadTimeOffApprovals();await loadTeam(true);say(action==="approve"?"Đã duyệt. Trạng thái lịch sẽ cập nhật theo phạm vi yêu cầu.":"Đã từ chối và gửi lý do.");};
}
