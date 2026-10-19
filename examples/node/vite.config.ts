import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-node';
import { imageway } from 'svelte-imageway/vite';
import { imageAdapter } from 'svelte-imageway/kit';
import config from './imageway.config.ts';
export default defineConfig({ plugins: [imageway({ config }), sveltekit({ adapter: imageAdapter(adapter()) })] });
