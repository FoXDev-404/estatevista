import { createApp } from './app.js';
import { assertProductionConfig, config } from './lib/config.js';
import { isSupabaseConfigured } from './supabaseClient.js';

assertProductionConfig();

const app = createApp();

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log(`EstateVista API server running on http://localhost:${config.port}`);
    if (isSupabaseConfigured) {
      console.log('Supabase configuration detected.');
    } else {
      console.warn('Supabase is not configured yet — API endpoints will return a configuration error.');
    }
  });
}

export default app;
