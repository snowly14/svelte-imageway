import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { imageway } from 'svelte-imageway/vite';
export default defineConfig({ plugins: [imageway(), svelte()], ssr: { noExternal: ['svelte-imageway'] } });
