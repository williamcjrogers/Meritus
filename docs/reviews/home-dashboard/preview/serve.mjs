import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url);
const pluginRequire=createRequire(require.resolve('@vitejs/plugin-react'));
const {createServer}=await import(pluginRequire.resolve('vite'));
const {default:react}=await import('@vitejs/plugin-react');
const preview=fileURLToPath(new URL('.',import.meta.url));
const repo=path.resolve(preview,'../../../..');
const server=await createServer({
 configFile:false,root:preview,plugins:[react()],
 resolve:{alias:[
  {find:'@/lib/actions/server',replacement:path.join(preview,'action-mocks.js')},
  {find:'@clerk/nextjs',replacement:path.join(preview,'clerk-mock.jsx')},
  {find:'next/navigation',replacement:path.join(preview,'navigation-mocks.js')},
  {find:'next/link',replacement:path.join(preview,'link-mock.jsx')},
  {find:'@',replacement:path.join(repo,'src')}
 ]},
 css:{postcss:repo},
 server:{host:'127.0.0.1',port:4318,strictPort:true,fs:{allow:[repo]}},
});
await server.listen();server.printUrls();
