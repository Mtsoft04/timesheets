const SUPABASE_URL=window.APP_CONFIG?.supabaseUrl||"";
const SUPABASE_KEY=window.APP_CONFIG?.supabaseKey||"";
const DAYS=["Thứ 2","Thứ 3","Thứ 4","Thứ 5","Thứ 6","Thứ 7","CN"],H=[...Array(24).keys()];
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const say=t=>{$("msg").textContent=t||"";clearTimeout(say.t);if(t)say.t=setTimeout(()=>{$("msg").textContent=""},6000)};
