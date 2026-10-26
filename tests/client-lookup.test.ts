import { it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

it('reads unregistered URLs without maps or provider parsing and still resolves later registrations', async () => {
  // A fresh real Node realm detects first-read allocations independently of other tests.
  const module = new URL('../packages/svelte-imageway/dist/core/artifact.js', import.meta.url).href;
  const props = new URL('../packages/svelte-imageway/dist/props.js', import.meta.url).href;
  const source = `
    import assert from 'node:assert/strict';
    const {resolveImageArtifact,registerImageArtifact,imageRepresentation}=await import(${JSON.stringify(module)});
    const {getImageProps}=await import(${JSON.stringify(props)});
    const key=Symbol.for('svelte-imageway.assets.v2');
    assert.equal(Object.hasOwn(globalThis,key),false);
    assert.equal(resolveImageArtifact('/unknown.jpg'),undefined);
    const NativeURL=globalThis.URL;let parses=0;
    globalThis.URL=class extends NativeURL{constructor(...args){parses++;super(...args)}};
    for(const src of ['/uploads/a.jpg','https://images.example/a.jpg','data:image/png;base64,YQ==']) {
      assert.equal(getImageProps({src,alt:''}).src,src);
    }
    assert.equal(parses,0);
    assert.equal(Object.hasOwn(globalThis,key),false);
    const artifact={src:'/fallback.jpg',width:640,height:400,aspectRatio:1.6,sources:[],img:{src:'/native.webp',width:640,height:400}};
    assert.equal(resolveImageArtifact(artifact),artifact);
    registerImageArtifact('/original.jpg',artifact,'module-a');
    assert.equal(resolveImageArtifact('/original.jpg'),artifact);
    assert.equal(imageRepresentation(artifact),artifact.img);
    assert.equal(getImageProps({src:'/original.jpg',alt:'',formatStrategy:'img'}).src,'/native.webp');
    assert.equal(getImageProps({src:'/original.jpg',alt:'',formatStrategy:'picture'}).src,'/fallback.jpg');
    assert.equal(getImageProps({src:'/unknown.jpg',alt:'',config:{providers:{}}}).src,'/unknown.jpg');
    assert.equal(parses,1);
    console.log('fresh registry and URL contract verified');
  `;
  const result = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', source]);
  expect(result.stdout.trim()).toBe('fresh registry and URL contract verified');
});
