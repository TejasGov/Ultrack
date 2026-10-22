import { defineConfig } from 'vite';
import { createReadStream, statSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const models = {
  'furari-488.glb': resolve(root, '../meshy_output/batch-1/furari-488.glb'),
  'lambo2.glb': resolve(root, '../meshy_output/batch-1/lambo2.glb'),
  'mclaren.glb': resolve(root, '../meshy_output/batch-1/mclaren.glb'),
  'mclaren-body-shell.glb': resolve(root, '../meshy_output/mclaren-body-only/model.glb')
};
const reviewSources = {
  'lambo-body-shell.glb': resolve(root, '../meshy_output/body-shell-test/model.glb'),
  'furari-488-source.glb': resolve(root, '../meshy_output/cars/furari-488/20261018_145934_furari-488_01a15060/assets/model.pre_remeshed.glb'),
  'lambo2-source.glb': resolve(root, '../meshy_output/cars/lambo2/20261018_145934_lambo2_01a15060/assets/model.pre_remeshed.glb'),
  'mclaren-source.glb': resolve(root, '../meshy_output/cars/mclaren/20261018_145934_mclaren_01a15060/assets/model.pre_remeshed.glb')
};
for(const key of ['mustang','porsche1','aston-martin-valk'])models[`${key}-body-shell.glb`]=resolve(root,`../meshy_output/body-batch-2/${key}/model.glb`);
for(const key of ['buggati','bentley-gt','bmw1'])models[`${key}-body-shell.glb`]=resolve(root,`../meshy_output/body-batch-3/${key}/model.glb`);
for(const key of ['jaguarxkjss','nuvolari','tesla1']){models[`${key}-body-shell.glb`]=resolve(root,`../meshy_output/body-batch-4/${key}/model-clean.glb`);models[`${key}-raw-shell.glb`]=resolve(root,`../meshy_output/body-batch-4/${key}/model.glb`);}
models['tesla1-body-shell.glb']=resolve(root,'../meshy_output/body-batch-4/tesla1/model-refined.glb');
models['furari-488-body-shell.glb']=resolve(root,'../meshy_output/body-batch-5/furari-488/model-assembly.glb');
models['furari-488-raw-shell.glb']=resolve(root,'../meshy_output/body-batch-5/furari-488/model.glb');
for(const key of ['mp1x','jaguarxkjss','nuvolari'])models[key+'-complete.glb']=resolve(root,'../assets/cars/'+key+'/car_lod0.glb');
export default defineConfig({
  plugins: [{
    name: 'local-car-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = req.url?.split('?')[0]?.replace(/^\/models\//, '');
        const file = models[name] ?? reviewSources[name];
        if (!req.url?.startsWith('/models/') || !file) return next();
        try {
          res.setHeader('Content-Type', 'model/gltf-binary');
          res.setHeader('Content-Length', statSync(file).size);
          res.setHeader('Cache-Control', 'public, max-age=3600');
          createReadStream(file).on('error', () => res.destroy()).pipe(res);
        } catch { res.statusCode = 404; res.end('Car asset not found.'); }
      });
    },
    closeBundle() {
      mkdirSync(resolve(root, 'dist/models'), { recursive: true });
      for (const [name, file] of Object.entries({...models,'lambo-body-shell.glb':reviewSources['lambo-body-shell.glb']})) copyFileSync(file, resolve(root, 'dist/models', name));
    }
  }],
  build: { chunkSizeWarningLimit: 800, rollupOptions: { input: {main:resolve(root,'index.html'),assembly:resolve(root,'assembly-lab.html')} } }
});
