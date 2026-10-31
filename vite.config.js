import {defineConfig} from 'vite';
import {resolve} from 'node:path';

const ids=['raffle','poll','wheel','score','teams','timer','bracket','treasure'];
export default defineConfig({
  build:{
    rollupOptions:{
      input:{
        home:resolve('index.html'),
        ...Object.fromEntries(ids.map(id=>[id,resolve('programs',id,'index.html')]))
      }
    }
  }
});
