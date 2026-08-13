import { serve } from 'bun'; import { createApp } from './http/app'; import { config } from './config';
serve({port:config.port,fetch:createApp()}); console.log(JSON.stringify({level:'info',message:`Equinoxe API écoute sur http://localhost:${config.port}`}));
