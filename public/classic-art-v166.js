'use strict';
// Original material pass, applied only to classic sprites at cache creation. No external textures.
(function(root){
 function finish(c,kind,color,size){
  const half=size/2;
  c.save();c.globalCompositeOperation='source-atop';
  // Directional metallic shading across the existing hull silhouette.
  const metal=c.createLinearGradient(-half,-half,half,half);
  metal.addColorStop(0,'#e9f0ef70');metal.addColorStop(.32,'#d4e0e231');metal.addColorStop(.53,'#060a1430');metal.addColorStop(.72,'#0a080d60');metal.addColorStop(1,'#040508b0');
  c.fillStyle=metal;c.fillRect(-half,-half,size,size);
  // Deterministic brushed armor microtexture and panel lines, clipped to the opaque sprite.
  let seed=2166136261;for(const ch of kind+color){seed=Math.imul(seed^ch.charCodeAt(0),16777619)>>>0;}
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<Math.round(size*5);i++){const x=rand()*size-half,y=rand()*size-half,w=.5+rand()*2.2;c.fillStyle=i%3===0?'#f2e7d42b':'#00000026';c.fillRect(x,y,w,.65);}
  c.lineWidth=.55;c.strokeStyle='#080d1666';for(let x=-half+5;x<half;x+=9){c.beginPath();c.moveTo(x,-half);c.lineTo(x+size*.28,half);c.stroke();}
  c.globalCompositeOperation='source-atop';c.strokeStyle='#dbe3e32b';for(let x=-half+6;x<half;x+=9){c.beginPath();c.moveTo(x,-half);c.lineTo(x+size*.28,half);c.stroke();}
  c.restore();
 }
 root.ggClassicArt={finish};
})(window);