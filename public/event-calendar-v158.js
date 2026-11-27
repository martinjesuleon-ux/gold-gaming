'use strict';
(()=>{const el=document.getElementById('liveEvents'),hud=document.getElementById('hud');if(!el||!hud)return;const names={uridium:'Uridium x2',gateSpecial:'Galaxy Gates x2',hitac:'Hitac',ice:'Meteorito',spaceball:'Spaceball',invasion:'Invasión'};let data={},last=0,busy=false;
 function render(){if(hud.hidden||Date.now()-last>15000){el.hidden=true;return;}const items=Object.entries(data).filter(([k,v])=>names[k]&&v?.active&&(!v.endAt||Date.parse(v.endAt)>Date.now())).map(([k,v])=>{let time='';if(v.endAt){const seconds=Math.max(0,Math.ceil((Date.parse(v.endAt)-Date.now())/1000));time=' '+Math.floor(seconds/3600)+':'+String(Math.floor(seconds/60)%60).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}return names[k]+(v.map?' · '+v.map:'')+time;});const label=items.join(' | ');if(el.textContent!==label)el.textContent=label;el.hidden=!items.length;}
 async function refresh(){if(busy||hud.hidden)return;busy=true;try{const r=await fetch('/api/events/live',{cache:'no-store'});if(!r.ok)throw Error();data=(await r.json()).events||{};last=Date.now();}catch{data={};}finally{busy=false;render();}}
 setInterval(refresh,5000);setInterval(render,1000);refresh();
})();
