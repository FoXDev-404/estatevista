import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import propertiesRouter from './routes/properties.js';
import enquiriesRouter from './routes/enquiries.js';
import uploadRouter from './routes/upload.js';
import { isSupabaseConfigured, supabase } from './supabaseClient.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Routes
app.use('/api/properties', propertiesRouter);
app.use('/api/enquiries', enquiriesRouter);
app.use('/api/upload', uploadRouter);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  let dbStatus;
  let propertiesCount = 0;

  if (isSupabaseConfigured && supabase) {
    try {
      const { count, error } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true });

      if (!error) {
        dbStatus = 'connected';
        propertiesCount = count || 0;
      } else {
        dbStatus = `error: ${error.message}`;
      }
    } catch (e) {
      dbStatus = `error: ${e.message}`;
    }
  } else {
    dbStatus = 'not configured (missing SUPABASE_URL or keys in .env)';
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    supabaseConfigured: isSupabaseConfigured,
    database: dbStatus,
    propertiesCount,
  });
});

// Start listening if run directly (and not in Vercel serverless)
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 EstateVista API server running on http://localhost:${PORT}`);
    if (isSupabaseConfigured) {
      console.log('✅ Supabase configuration detected.');
    } else {
      console.log('⚠️  Supabase is not configured yet in .env — endpoints will return fallback warnings.');
    }
  });
}

export default app;
