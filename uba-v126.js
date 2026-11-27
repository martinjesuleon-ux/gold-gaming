'use strict';
const crypto=require('node:crypto');
const RULES=Object.freeze({minLevel:14,acceptMs:40000,nextAcceptMs:30000,countdownMs:15000,roundMs:315000,maxRounds:3,wins:2,minScore:50,winPoints:10,weakWinPoints:5,lossPoints:5,weakGap:200});
const fail=message=>Object.assign(Error(message),{status:400});
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
function scoreResult(winner,loser){return {winner:Math.max(RULES.minScore,winner)+(winner-loser>=RULES.weakGap?RULES.weakWinPoints:RULES.winPoints),loser:Math.max(RULES.minScore,loser-RULES.lossPoints)};}
function createMatch(a,b,now=Date.now()){
 if(!a||!b||a.id===b.id||a.level<RULES.minLevel||b.level<RULES.minLevel)throw fail('Pilotos no elegibles');
 return {id:crypto.randomUUID(),players:[a.id,b.id],round:1,score:[0,0],accepted:[],phase:'offer',until:now+RULES.acceptMs,winner:null};
}
function accept(m,id,now=Date.now()){
 if(m.phase!=='offer'||now>=m.until||!m.players.includes(id))throw fail('Oferta no disponible');
 if(!m.accepted.includes(id))m.accepted.push(id);
 if(m.accepted.length===2){m.phase='countdown';m.until=now+RULES.countdownMs;}return m;
}
function advance(m,now=Date.now()){
 if(now<m.until)return m;
 if(m.phase==='offer'){m.phase='cancelled';m.until=0;}
 else if(m.phase==='countdown'){m.phase='fight';m.until+=RULES.roundMs;}
 return m;
}
function finishRound(m,winner,now=Date.now()){
 if(m.phase!=='fight'||winner!==null&&!m.players.includes(winner))throw fail('Ronda no disponible');
 if(winner!==null)m.score[m.players.indexOf(winner)]++;
 if(m.score.includes(RULES.wins)||m.round>=RULES.maxRounds){
  m.phase='finished';m.winner=m.score[0]===m.score[1]?null:m.players[m.score[0]>m.score[1]?0:1];m.until=0;
 }else{m.round++;m.phase='offer';m.accepted=[];m.until=now+RULES.nextAcceptMs;}return m;
}
function createLobby(){
 const waiting=new Map(),matches=new Map();
 function enqueue(p,now=Date.now()){
  if(!p||p.level<RULES.minLevel)throw fail('Nivel 14 requerido');
  if(matches.has(p.id))return matches.get(p.id);
  if(waiting.has(p.id))return null;
  const opponent=[...waiting.values()].find(q=>q.id!==p.id);
  if(!opponent){waiting.set(p.id,p);return null;}
  waiting.delete(opponent.id);const m=createMatch(opponent,p,now);for(const id of m.players)matches.set(id,m);return m;
 }
 function get(id){return matches.get(id)||null;}
 function remove(id){waiting.delete(id);const m=matches.get(id);if(m){for(const pid of m.players)matches.delete(pid);}return m;}
 function tick(now=Date.now()){const unique=[...new Set(matches.values())];for(const m of unique)advance(m,now);return unique;}
 return {enqueue,get,remove,tick,queued:id=>waiting.has(id)};
}
function createUBA(pool){
 async function ready(){await pool.query(`CREATE TABLE IF NOT EXISTS gg_uba_scores(account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,score integer NOT NULL DEFAULT 50 CHECK(score>=50),wins integer NOT NULL DEFAULT 0,losses integer NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS gg_uba_results(match_id uuid PRIMARY KEY,winner uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,loser uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,response jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());`);}
 async function status(id){
  const own=(await pool.query('SELECT score,wins,losses FROM gg_uba_scores WHERE account_id=$1',[id])).rows[0]||{score:50,wins:0,losses:0};
  const rows=(await pool.query('SELECT a.username AS name,s.score,s.wins,s.losses,s.account_id=$1 AS own FROM gg_uba_scores s JOIN accounts a ON a.id=s.account_id ORDER BY s.score DESC,s.wins DESC,a.username LIMIT 100',[id])).rows;
  return {rules:RULES,own,rows,enabled:false};
 }
 // Only the trusted game loop may settle a completed duel. No client score inputs.
 async function settle(matchId,winner,loser){
  if(![matchId,winner,loser].every(uuid)||winner===loser)throw fail('Resultado inválido');
  const c=await pool.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(71413005)');
   const prior=(await c.query('SELECT winner,loser,response FROM gg_uba_results WHERE match_id=$1',[matchId])).rows[0];if(prior){if(prior.winner!==winner||prior.loser!==loser)throw fail('Resultado en conflicto');await c.query('COMMIT');return prior.response;}
   for(const id of [winner,loser].sort())await c.query('INSERT INTO gg_uba_scores(account_id) VALUES($1) ON CONFLICT DO NOTHING',[id]);
   const rows=(await c.query('SELECT account_id,score FROM gg_uba_scores WHERE account_id=ANY($1::uuid[]) FOR UPDATE',[[winner,loser]])).rows;
   const next=scoreResult(rows.find(r=>r.account_id===winner).score,rows.find(r=>r.account_id===loser).score);
   await c.query('UPDATE gg_uba_scores SET score=$2,wins=wins+1 WHERE account_id=$1',[winner,next.winner]);
   await c.query('UPDATE gg_uba_scores SET score=$2,losses=losses+1 WHERE account_id=$1',[loser,next.loser]);
   const result={winner,loser,...{winnerScore:next.winner,loserScore:next.loser}};
   await c.query('INSERT INTO gg_uba_results(match_id,winner,loser,response) VALUES($1,$2,$3,$4)',[matchId,winner,loser,JSON.stringify(result)]);
   await c.query('COMMIT');return result;
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 }
 return {ready,status,settle};
}
module.exports={RULES,scoreResult,createMatch,accept,advance,finishRound,createLobby,createUBA};
