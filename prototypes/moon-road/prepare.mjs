import {readFileSync, readdirSync, mkdirSync, writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
const encoded=readdirSync(join(root,'runtime')).filter(f=>f.endsWith('.txt')).sort().map(f=>readFileSync(join(root,'runtime',f),'utf8')).join('');
const files=JSON.parse(gunzipSync(Buffer.from(encoded,'base64')));
for(const [name,data] of Object.entries(files)){const dest=join(root,'dist',name);mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,Buffer.from(data,'base64'));}
console.log('Runtime ready. Serve dist and open /poc-vii/. Standalone Core Clash is at /.');
