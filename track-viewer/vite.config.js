// Dev-only: POST /__snap?name=x with a PNG body saves it to track-viewer/shots/x.png. viewer.snap('x') renders a frame
// and sends it, so review stills do not depend on the browser pane being visible (hidden pages never present frames).
import { mkdirSync, writeFileSync, createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: { manifest: true, rollupOptions: { input: { game: 'index.html', audioLab: 'audio-lab.html' } } },
  // the cars reuse car-lab's vehicle modules (read-only): allow the parent folder, and keep one copy of three
  server: { fs: { allow: ['..'] } },
  resolve: { dedupe: ['three'] },
  plugins: [{
    name: 'snap',
    apply: 'serve',
    configureServer(server) {
      // Local A/B profiling only; never included in the production build.
      server.middlewares.use('/__venue-profile', (req,res)=>{
        const query=new URL(req.url,'http://x').searchParams,ktx=query.get('texture')==='ktx2';
        const variant=query.get('variant');
        if(!['whole','sectors'].includes(variant)){res.statusCode=400;res.end('Unknown venue profile.');return;}
        const file=join(server.config.root,'..','tracks','marina','out','web',`marina_visual${ktx?'_ktx2':''}_${variant==='sectors'?'sectors':'shell'}.glb`);
        if(!existsSync(file)){res.statusCode=404;res.end('Build scenery shells first.');return;}
        res.setHeader('Content-Type','model/gltf-binary');createReadStream(file).pipe(res);
      });
      server.middlewares.use('/__snap', (req, res) => {
        const name = (new URL(req.url, 'http://x').searchParams.get('name') || 'shot').replace(/[^\w-]/g, '_');
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
          const dir = join(server.config.root, 'shots');
          mkdirSync(dir, { recursive: true });
          writeFileSync(join(dir, `${name}.png`), Buffer.concat(chunks));
          res.end('ok');
        });
      });
      // car QA pipeline (sandbox.html): POST /__qa?car=av12&file=report.json saves to track-viewer/qa/av12/report.json
      server.middlewares.use('/__qa', (req, res) => {
        const q = new URL(req.url, 'http://x').searchParams;
        const car = (q.get('car') || 'car').replace(/[^\w-]/g, '_'), file = (q.get('file') || 'out.bin').replace(/[^\w.-]/g, '_');
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
          const dir = join(server.config.root, 'qa', car);
          mkdirSync(dir, { recursive: true });
          writeFileSync(join(dir, file), Buffer.concat(chunks));
          res.end('ok');
        });
      });
    },
  }],
});
