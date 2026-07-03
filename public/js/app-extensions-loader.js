import './soft-orange-accent-fix.js';
import { EXTENSION_MODULES, importModuleGroup } from './app-module-registry.js';

importModuleGroup(EXTENSION_MODULES, { label: 'extensions' }).then(failed => {
  if (failed.length) console.warn('[sosoking extensions] failed modules:', failed);
  window.dispatchEvent(new CustomEvent('sosoking:extensions-ready', { detail: { failed } }));
});
