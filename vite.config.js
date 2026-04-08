import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { apiPlugin } from './src/api-plugin.js'

export default defineConfig({
  plugins: [apiPlugin(), svelte()],
})
