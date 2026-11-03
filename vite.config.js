import {defineConfig} from 'vite';
// Copy only new public assets; do not publish the legacy game assets.
export default defineConfig({publicDir:'site-assets',build:{outDir:'dist',emptyOutDir:true}});
