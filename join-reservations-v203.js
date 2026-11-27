'use strict';
// Reserve an account before performing expensive loading. Release only the matching lease.
function createJoinReservations({capacity=40}={}){
 const leases=new Map();
 function acquire(accountId,owner,active){
  if(active.has(accountId)||leases.has(accountId))return {ok:false,code:'ACCOUNT_BUSY'};
  if(active.size+leases.size>=capacity)return {ok:false,code:'SERVER_FULL'};
  const lease={accountId,owner};leases.set(accountId,lease);return {ok:true,lease};
 }
 function release(lease){if(lease&&leases.get(lease.accountId)===lease){leases.delete(lease.accountId);return true;}return false;}
 return {acquire,release,size:()=>leases.size};
}
module.exports={createJoinReservations};
