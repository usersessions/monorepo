require('ts-node').register();
const { getEnvVar } = require('./apps/dashboard/lib/cf-env.ts');
getEnvVar('PAYSTACK_SECRET_KEY').then(console.log).catch(console.error);
