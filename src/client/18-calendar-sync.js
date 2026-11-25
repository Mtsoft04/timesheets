/* ---------- nhap va xuat lich iCalendar ---------- */
function calendarSyncTools(){return `<div class="calendar-sync"><h3>🔄 Đồng bộ lịch .ics</h3><p class="mut">Nhập lịch ngoài thành giờ bận cá nhân; xuất lịch tuần hiện tại để đưa sang ứng dụng lịch.</p><input id="ics-file" type="file" accept=".ics,text/calendar" hidden><button id="ics-import" type="button">⬆ Nhập tệp .ics</button><button id="ics-export" type="button">⬇ Xuất tuần này (.ics)</button></div>`;}
function unescapeIcs(v){return String(v||"").replace(/\\n/gi,"\n").replace(/\\,/g,",").replace(/\\;/g,";").replace(/\\\\/g,"\\");}
function parseIcsDate(raw){
  const value=String(raw||"").trim();if(/^\d{8}$/.test(value))return{date:value.slice(0,4)+"-"+value.slice(4,6)+"-"+value.slice(6,8),hour:0,allDay:true};
  const m=value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);if(!m)return null;
  const d=new Date(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0));if(m[7]){const utc=new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0)));return{date:fmt(utc),hour:utc.getHours(),instant:utc};}
  return{date:fmt(d),hour:d.getHours(),instant:d};
}
async function importIcsFile(file){
  const text=await file.text(),unfolded=text.replace(/\r?\n[ \t]/g,""),events=unfolded.split(/BEGIN:VEVENT/i).slice(1).map(x=>x.split(/END:VEVENT/i)[0]),slots=new Map();
  for(const ev of events){const lines=ev.split(/\r?\n/),get=name=>{const line=lines.find(x=>new RegExp("^"+name+"(?:;[^:]*)?:","i").test(x));if(!line)return"";return line.slice(line.indexOf(":")+1).trim();},start=parseIcsDate(get("DTSTART")),end=parseIcsDate(get("DTEND"));if(!start||!end)continue;
    const summary=unescapeIcs(get("SUMMARY"))||"Lịch ngoài",a=start.instant||parse(start.date),b=end.instant||parse(end.date);if(b<=a)continue;
    const p=new Date(a);p.setMinutes(0,0,0);while(p<b){const key=K(fmt(p),p.getHours());slots.set(key,"📅 "+summary.slice(0,70));p.setHours(p.getHours()+1);}
  }
  if(!slots.size)return say("Không tìm thấy sự kiện .ics có ngày giờ hợp lệ.");
  const keys=[...slots.keys()],existing=await SB.from("personal_slots").select("slot_date,hour").eq("user_id",user.id).gte("slot_date",keys.map(k=>k.split("|")[0]).sort()[0]).lte("slot_date",keys.map(k=>k.split("|")[0]).sort().at(-1));
  if(existing.error)return say("Không đọc được lịch cá nhân: "+existing.error.message);
  const occupied=new Set((existing.data||[]).map(x=>K(x.slot_date,x.hour))),rows=[...slots].filter(([k])=>!occupied.has(k)).map(([k,note])=>{const[d,h]=k.split("|");return{user_id:user.id,slot_date:d,hour:+h,note};});
  if(rows.length){const r=await SB.from("personal_slots").insert(rows);if(r.error)return say("Không nhập được lịch: "+r.error.message);}
  await meView();say(`Đã nhập ${slots.size} khung giờ từ .ics; thêm ${rows.length} khung còn trống vào lịch cá nhân.`);
}
function bindCalendarSync(){
  const imp=$("ics-import"),file=$("ics-file"),exp=$("ics-export");if(imp&&file){imp.onclick=()=>file.click();file.onchange=async()=>{const f=file.files&&file.files[0];if(f){await importIcsFile(f);file.value="";}};}
  if(exp)exp.onclick=async()=>{const[a,b]=wkRange(),r=await SB.from("personal_slots").select("slot_date,hour,note").eq("user_id",user.id).gte("slot_date",a).lte("slot_date",b).order("slot_date").order("hour");if(r.error)return say("Không xuất được lịch: "+r.error.message);
    const z=new Date().toISOString().replace(/[-:]|\.\d{3}/g,""),events=(r.data||[]).map(x=>{const d=x.slot_date.replace(/-/g,""),s=String(x.hour).padStart(2,"0"),end=new Date(parse(x.slot_date));end.setHours(x.hour+1,0,0,0);const ed=fmt(end).replace(/-/g,"")+String(end.getHours()).padStart(2,"0")+"0000";return["BEGIN:VEVENT","UID:busy-"+x.slot_date+"-"+x.hour+"@timesheet","DTSTAMP:"+z,"DTSTART;TZID=Asia/Ho_Chi_Minh:"+d+"T"+s+"0000","DTEND;TZID=Asia/Ho_Chi_Minh:"+ed,"SUMMARY:"+icsEsc(x.note||"Bận"),"END:VEVENT"].join("\r\n");});
    const blob=new Blob(["BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Timesheet//VI\r\nCALSCALE:GREGORIAN\r\n"+events.join("\r\n")+"\r\nEND:VCALENDAR\r\n"],{type:"text/calendar;charset=utf-8"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="lich-ca-nhan-"+a+".ics";link.click();URL.revokeObjectURL(url);say("Đã xuất lịch cá nhân dạng .ics.");};
}
