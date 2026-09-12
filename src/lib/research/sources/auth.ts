import { registerProviderHeaders } from '../safe-fetch';
export function registerSourceAuthentication(): void { registerProviderHeaders('companies-house', secret => ({ Authorization: 'Basic ' + Buffer.from(secret + ':').toString('base64'), Accept: 'application/json' })); }
