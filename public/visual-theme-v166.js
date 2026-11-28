'use strict';
(function(root){
 const key='gg.visual.theme.v2',normalize=v=>v==='classic'?'classic':'gold';
 let active='gold';
 try{const saved=root.localStorage.getItem(key);active=normalize(saved);}catch{}
 function apply(){if(root.document?.documentElement)root.document.documentElement.dataset.ggTheme=active;}
 function set(value){const next=normalize(value);if(next===active)return;active=next;apply();try{root.localStorage.setItem(key,active);}catch{}root.dispatchEvent?.(new Event('gg:visualTheme'));}
 function layoutKey(mode=active){return 'gg.hud.layout.v2.'+normalize(mode);}
 apply();root.ggVisualTheme={current:()=>active,set,normalize,layoutKey};
})(window);
