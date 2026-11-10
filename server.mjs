import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
const root=resolve('dist');
http.createServer(async(req,res)=>{try{const file=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname)); if(!file.startsWith(root+'/')&&file!==root)throw Error(); const path=file===root||file===root+'/'?root+'/index.html':file;res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'})[extname(path)]||'application/octet-stream');res.end(await readFile(path));}catch{res.writeHead(404);res.end('Not found');}}).listen(5173,'0.0.0.0',()=>console.log('TyroSense: http://localhost:5173'));
