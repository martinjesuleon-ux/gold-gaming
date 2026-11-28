'use strict';
// Offline packaging only. No network requests, no executable SWF, no game data.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const keyPattern=/^[a-zA-Z0-9_.:-]{1,120}$/,filePattern=/^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(png|webp|jpg|jpeg)$/i;
const allowed=/^(sprite:|npc:|drone:|shop:|map:|portal:|projectile:|impact:|mine:|loot:|base:|ui:)/;
function checked(root,name){
 if(typeof name!=='string'||!filePattern.test(name))throw Error('Unsafe raster path: '+name);
 const full=path.resolve(root,name),rel=path.relative(root,full);
 if(rel.startsWith('..')||path.isAbsolute(rel))throw Error('Path outside input folder');
 const real=fs.realpathSync(full),actual=path.relative(fs.realpathSync(root),real);
 if(actual.startsWith('..')||path.isAbsolute(actual))throw Error('Symlink outside input folder');
 if(!fs.statSync(real).isFile())throw Error('Not a file: '+name);
 return real;
}
function pngSize(b){if(b.length<33||!b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||b.toString('ascii',12,16)!=='IHDR')throw Error('Invalid PNG signature');return [b.readUInt32BE(16),b.readUInt32BE(20)];}
function webpSize(b){
 if(b.length<30||b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WEBP')throw Error('Invalid WebP signature');
 const type=b.toString('ascii',12,16);
 if(type==='VP8X')return [1+b.readUIntLE(24,3),1+b.readUIntLE(27,3)];
 if(type==='VP8L'&&b[20]===47){const n=b.readUInt32LE(21);return [1+(n&16383),1+((n>>>14)&16383)];}
 if(type==='VP8 '&&b[23]===157&&b[24]===1&&b[25]===42)return [b.readUInt16LE(26)&16383,b.readUInt16LE(28)&16383];
 throw Error('Unsupported WebP header');
}
function jpegSize(b){if(b[0]!==255||b[1]!==216)throw Error('Invalid JPEG signature');let i=2;while(i+8<b.length){if(b[i++]!==255)throw Error('Invalid JPEG marker');while(b[i]===255)i++;const m=b[i++];if(m===217||m===218)break;const n=b.readUInt16BE(i);if(n<2||i+n>b.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(m)&&n>=7)return [b.readUInt16BE(i+5),b.readUInt16BE(i+3)];i+=n;}throw Error('Missing JPEG dimensions');}
function dimensions(b,name){const ext=path.extname(name).toLowerCase();return ext==='.png'?pngSize(b):ext==='.webp'?webpSize(b):jpegSize(b);}
function plan(input,mapping){
 if(mapping?.version!==1||!Array.isArray(mapping.assets)||mapping.assets.length>5000)throw Error('Invalid mapping');
 const keys=new Set(),files=new Map(),assets=[],report=[];
 for(const e of mapping.assets){
  if(typeof e?.key!=='string'||!keyPattern.test(e.key)||!allowed.test(e.key)||keys.has(e.key))throw Error('Invalid or duplicate key: '+e?.key);
  keys.add(e.key);
  if(typeof e.source!=='string'||!e.source.trim()||typeof e.permission!=='string'||!e.permission.trim())throw Error('Source and permission required: '+e.key);
  const mode=e.mode??'static',frames=e.frames??1,columns=e.columns??frames,fps=e.fps??12,heading=e.heading??0,width=e.width??112,height=e.height??width;
  if(!['static','directional','animated'].includes(mode)||!Number.isInteger(frames)||frames<1||frames>120||!Number.isInteger(columns)||columns<1||columns>frames||(mode==='static'&&frames!==1)||!Number.isFinite(fps)||fps<1||fps>60||!Number.isFinite(heading)||Math.abs(heading)>360||[width,height].some(n=>!Number.isFinite(n)||n<1||n>2048))throw Error('Invalid display metadata: '+e.key);
  let image=files.get(e.file);
  if(!image){const p=checked(input,e.file),stat=fs.statSync(p);if(stat.size>32*1024*1024)throw Error('Image exceeds 32 MiB: '+e.file);const bytes=fs.readFileSync(p),[w,h]=dimensions(bytes,e.file);if(w<1||h<1||w>8192||h>8192)throw Error('Image dimensions out of range: '+e.file);image={path:p,w,h,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:stat.size};files.set(e.file,image);}
  if(image.w%columns||image.h%Math.ceil(frames/columns))throw Error('Non-uniform atlas cells: '+e.key);
  assets.push({key:e.key,file:e.file,source:e.source,permission:e.permission,mode,frames,columns,fps,heading,width,height});
  report.push({key:e.key,file:e.file,pixelWidth:image.w,pixelHeight:image.h,sha256:image.sha256,bytes:image.bytes});
 }
 return {manifest:{version:1,assets},files,report:{assetCount:assets.length,uniqueFiles:files.size,bytes:[...files.values()].reduce((n,v)=>n+v.bytes,0),entries:report}};
}
function build(input,mapping,out){
 const p=plan(input,mapping),dest=path.resolve(out);
 if(fs.existsSync(dest))throw Error('Output must be a new directory: '+dest);
 const parent=path.dirname(dest);fs.mkdirSync(parent,{recursive:true});const stage=fs.mkdtempSync(path.join(parent,'.classic-stage-'));
 try{for(const [file,image] of p.files){const target=path.join(stage,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(image.path,target,fs.constants.COPYFILE_EXCL);if(crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')!==image.sha256)throw Error('Source changed during packaging: '+file);}
 fs.writeFileSync(path.join(stage,'manifest.json'),JSON.stringify(p.manifest,null,2)+'\n');fs.writeFileSync(path.join(stage,'audit.json'),JSON.stringify(p.report,null,2)+'\n');fs.renameSync(stage,dest);return p.report;
 }catch(e){fs.rmSync(stage,{recursive:true,force:true});throw e;}
}
if(require.main===module){try{const [cmd,input,map,out]=process.argv.slice(2);if(!['check','build'].includes(cmd)||!input||!map||(cmd==='build'&&!out))throw Error('Usage: node tools/build-classic-pack.js check INPUT MAPPING.json | build INPUT MAPPING.json NEW_OUTPUT');const mapping=JSON.parse(fs.readFileSync(map,'utf8'));console.log(JSON.stringify(cmd==='check'?plan(input,mapping).report:build(input,mapping,out),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={plan,build,dimensions};
