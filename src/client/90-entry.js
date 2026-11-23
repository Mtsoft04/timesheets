/* ---------- vẽ lại theo ngữ cảnh ---------- */
const _meView=meView,_drawMe=drawMe,_drawTeam=drawTeam;
meView=async function(){setMeCtx();await _meView();};
drawMe=function(){setMeCtx();_drawMe();};
drawTeam=function(){setTeamCtx();_drawTeam();};

/* ---------- khởi động ---------- */
function start(){
  try{
    const initialView=document.body.dataset.initialView;
    const routeView={"/schedule":"me","/teams":"team","/community":"posts"}[location.pathname];
    const queryView=new URLSearchParams(location.search).get("view");
    if(["me","team","posts"].includes(initialView))view=initialView;
    else if(routeView)view=routeView;else if(["me","team","posts"].includes(queryView))view=queryView;
    if(/^#share=/.test(location.hash)){shareView();return;}
    if(!SUPABASE_URL||!SUPABASE_KEY){$("app").innerHTML="<div class='card'>Chưa cấu hình Supabase trong .env.</div>";return;}
    if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL.trim())){$("app").innerHTML="<div class='card'>Project URL chưa đúng. Phải có dạng https://xxxxxxxx.supabase.co (không thêm /rest/v1 hay dấu cách).</div>";return;}
    if(/^#live=/.test(location.hash)){liveStart();return;}
    SB=supabase.createClient(SUPABASE_URL.trim(),SUPABASE_KEY.trim());
    $("out").onclick=()=>SB.auth.signOut();
    SB.auth.onAuthStateChange((ev,session)=>{
      try{
        user=session?session.user:null;
        $("out").hidden=!user;$("bell").hidden=!user;paintWho();
        if(!user){team=null;stopNotifs();stopRemind();authView();return;}
        if(ev==="SIGNED_IN"||ev==="INITIAL_SESSION"){shell();go();initNotifs();initRemind();beat();pollUnread();}
      }catch(e){showErr(e)}
    });
    setInterval(()=>{const a=document.activeElement;if(user&&view==="team"&&team&&drag===null&&!dirty&&!(a&&["ci","nt"].includes(a.id)&&a.value))loadTeam(false);},15000);
    setInterval(()=>{if(user&&view==="team"&&team)pollChat();},3000);
  }catch(e){showErr(e)}
}
function showErr(e){$("app").innerHTML="<div class='card'><b>Lỗi khởi động:</b> "+esc(e&&e.message||e)+"</div>";}
window.addEventListener("error",e=>{if(!$("app").innerHTML)showErr(e.message)});
if(window.supabase)start();
else{const sc=document.createElement("script");sc.src="https://unpkg.com/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
  sc.onload=start;sc.onerror=()=>{$("app").innerHTML="<div class='card'>Không tải được thư viện Supabase. Kiểm tra mạng hoặc tắt trình chặn quảng cáo rồi tải lại.</div>"};
  document.head.appendChild(sc);}
