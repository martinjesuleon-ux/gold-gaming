'use strict';
const SWITCHABLE=Object.freeze(['AROL-X','RL-LB1','NC-AWB','AIM-02','NC-RRB','R0K-T01','MIN-T02']);
function cpuEnabled(p,code){return !!p.cpus?.includes(code)&&!p.disabledCpus?.has(code);}
function setCpu(p,code,enabled){if(!SWITCHABLE.includes(code)||typeof enabled!=='boolean'||!p.cpus?.includes(code))return false;p.disabledCpus??=new Set();if(enabled)p.disabledCpus.delete(code);else p.disabledCpus.add(code);return true;}
function cpuState(p){return Object.fromEntries(SWITCHABLE.filter(code=>p.cpus?.includes(code)).map(code=>[code,cpuEnabled(p,code)]));}
function autoWeapons(p,now){const choices=[];if(cpuEnabled(p,'AROL-X')&&now>=(p.rocketUntil||0))choices.push('rocket');if(p.launcher&&cpuEnabled(p,'RL-LB1')&&now>=(p.ordnanceUntil?.hellstorm||0))choices.push('shell');return choices;}
function extraView(p){return {cpuStates:cpuState(p),launcher:p.launcher||null,rocketUntil:p.rocketUntil||0,ordnanceUntil:p.ordnanceUntil||{},empUntil:p.empUntil||0};}
module.exports={SWITCHABLE,cpuEnabled,setCpu,cpuState,autoWeapons,extraView};
