import { defineConfig } from 'svelte-imageway/config';
import { local } from 'svelte-imageway/providers/local';
export default defineConfig({ provider: local() });
