import {defineConfig} from 'vite';
// Do not copy legacy games or assets from the previous public directory.
export default defineConfig({publicDir:false,build:{outDir:'dist',emptyOutDir:true}});
