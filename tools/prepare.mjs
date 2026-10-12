import {copyFileSync} from 'node:fs';
copyFileSync('functions/game-engine.cjs','public/js/game-engine.js');
copyFileSync('public/data/games.json','functions/starter-games.json');
