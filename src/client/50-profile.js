/* ---------- hồ sơ cá nhân ---------- */
// Lưu trong user_metadata của Supabase Auth: full_name, phone, address, avatar_url (ảnh nằm ở kho post-images/<user_id>/)
const AVB="post-images";
const meta=()=>(user&&user.user_metadata)||{};
const avUrl=()=>meta().avatar_url||"";
const avInner=(url,name)=>url?`<img src="${esc(url)}" alt="">`:ini(name);
function paintWho(){
  const w=$("who");if(!w)return;
  w.innerHTML=user?`<i class="av">${avInner(avUrl(),uname())}</i><span class="wn">${esc(uname())}</span>`:"";
}
function avPath(url){
  if(!url||!user)return null;const k="/"+AVB+"/",i=url.indexOf(k);if(i<0)return null;
  try{const p=decodeURIComponent(url.slice(i+k.length).split("?")[0]);return p.startsWith(user.id+"/")?p:null}catch(e){return null}
}
async function squareAvatar(file){
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>no(new Error("Không đọc được ảnh này."));i.src=url;});
    const s=Math.min(img.naturalWidth,img.naturalHeight),sx=(img.naturalWidth-s)/2,sy=(img.naturalHeight-s)/2,N=256;
    const c=document.createElement("canvas");c.width=c.height=N;const g=c.getContext("2d");
    g.fillStyle="#fff";g.fillRect(0,0,N,N);g.drawImage(img,sx,sy,s,s,0,0,N,N);
    return await new Promise((ok,no)=>c.toBlob(b=>b?ok(b):no(new Error("Không nén được ảnh.")),"image/jpeg",.85));
  }finally{URL.revokeObjectURL(url)}
}
let pfPend=null,pfRemove=false;
const pfSay=t=>{$("pferr").textContent=t||""};
function pfPaint(){
  const url=pfPend?pfPend.url:(pfRemove?"":avUrl());
  $("pfav").innerHTML=avInner(url,$("pfn").value.trim()||uname());
  $("pfrm").hidden=!url;
}
function pfClear(){if(pfPend){URL.revokeObjectURL(pfPend.url);pfPend=null}}
function openProfile(){
  if(!user)return;
  const m=meta();pfClear();pfRemove=false;pfSay("");
  $("pfn").value=uname();$("pfp").value=m.phone||"";$("pfe").value=user.email||"";$("pfa").value=m.address||"";
  $("pfh").textContent=user.new_email?"Đang chờ xác nhận đổi sang "+user.new_email+". Hãy mở hộp thư để xác nhận.":"Đổi email sẽ cần xác nhận qua thư gửi tới địa chỉ mới.";
  pfPaint();$("prf").hidden=false;$("pfn").focus();
}
function closeProfile(){pfClear();$("prf").hidden=true}
async function saveProfile(){
  const name=$("pfn").value.trim(),phone=$("pfp").value.trim(),email=$("pfe").value.trim(),addr=$("pfa").value.trim();
  if(!name)return pfSay("Hãy nhập tên hiển thị.");
  if(phone&&!/^\+?[0-9\s().-]{8,20}$/.test(phone))return pfSay("Số điện thoại chưa đúng định dạng.");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return pfSay("Email chưa đúng định dạng.");
  const btn=$("pfs");btn.disabled=true;btn.textContent="Đang lưu…";pfSay("");
  let newPath=null;
  try{
    const old=avUrl();let url=old;
    if(pfPend){
      newPath=user.id+"/avatar_"+Date.now()+".jpg";
      const r=await SB.storage.from(AVB).upload(newPath,pfPend.blob,{contentType:"image/jpeg",cacheControl:"31536000"});
      if(r.error)throw new Error(/bucket|not found/i.test(r.error.message)?"Chưa tạo kho ảnh trên Supabase: hãy chạy đoạn SQL bài viết.":r.error.message);
      url=imgUrl(newPath);
    }else if(pfRemove)url="";
    const emailChanged=email.toLowerCase()!==(user.email||"").toLowerCase();
    const attrs={data:{full_name:name,phone,address:addr,avatar_url:url}};
    if(emailChanged)attrs.email=email;
    const r=await SB.auth.updateUser(attrs);
    if(r.error)throw r.error;
    if(r.data&&r.data.user)user=r.data.user;
    const op=avPath(old);if(op&&old!==url)SB.storage.from(AVB).remove([op]).then(()=>{},()=>{});
    paintWho();beat();
    const ca=document.querySelector(".composer .av");if(ca&&view==="posts")ca.innerHTML=avInner(avUrl(),uname());
    closeProfile();
    say(emailChanged?"✓ Đã lưu hồ sơ. Hãy mở email mới để xác nhận việc đổi email.":"✓ Đã lưu hồ sơ");
  }catch(e){
    if(newPath)SB.storage.from(AVB).remove([newPath]).then(()=>{},()=>{});
    pfSay("Lỗi: "+(e.message||e));
  }finally{btn.disabled=false;btn.textContent="Lưu hồ sơ"}
}
$("who").onclick=openProfile;
$("prfx").onclick=$("pfc").onclick=closeProfile;
$("prf").onclick=e=>{if(e.target.id==="prf")closeProfile()};
$("pfs").onclick=saveProfile;
$("pfn").oninput=()=>{if(!pfPend&&(pfRemove||!avUrl()))pfPaint()};
$("pfrm").onclick=()=>{pfClear();pfRemove=true;pfPaint()};
$("pffile").onchange=async e=>{
  const f=e.target.files[0];e.target.value="";if(!f)return;
  if(!/^image\//.test(f.type))return pfSay("Chỉ chọn được file ảnh.");
  if(f.size>15*1024*1024)return pfSay("Ảnh quá lớn (tối đa 15 MB).");
  try{const b=await squareAvatar(f);pfClear();pfPend={blob:b,url:URL.createObjectURL(b)};pfRemove=false;pfSay("");pfPaint();}
  catch(er){pfSay(er.message)}
};
$("prf").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.isComposing&&e.target.tagName==="INPUT"&&e.target.type!=="file"){e.preventDefault();saveProfile();}});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("prf").hidden)closeProfile()});
