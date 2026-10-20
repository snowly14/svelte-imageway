import { render } from 'svelte/server';
import App from './App.svelte';
export function page() {
  return render(App);
}
