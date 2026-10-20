import { mount, hydrate } from 'svelte';
import App from './App.svelte';
const target = document.getElementById('app')!;
if (target.hasChildNodes()) hydrate(App, { target });
else mount(App, { target });
