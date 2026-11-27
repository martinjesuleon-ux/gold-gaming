'use strict';
const {TEST_ACCOUNT}=require('./pet-test-kit-v175');
const ADMIN_KAMIKAZE_DAMAGE=100000000;
function kamikazeForPilot(p,spec){
 // Only the already authorized test administrator receives the override.
 // Preserve the equipped module's radius and cooldown and existing fuel authorization.
 return p?.godAllowed===true&&p.accountId===TEST_ACCOUNT?{...spec,damage:ADMIN_KAMIKAZE_DAMAGE}:spec;
}
module.exports={ADMIN_KAMIKAZE_DAMAGE,kamikazeForPilot};
