import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-static';
import { imageway } from 'svelte-imageway/vite';
import { imageAdapter } from 'svelte-imageway/kit';
export default defineConfig({
  plugins: [imageway(), sveltekit({ adapter: imageAdapter(adapter()) })],
});
