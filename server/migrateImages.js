import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase, isSupabaseConfigured } from './supabaseClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUCKET_NAME = 'property-images';
const IMAGES_DIR = path.resolve(__dirname, '../public/images');

async function migrateImages() {
  console.log('🚀 Starting Local Image Migration to Supabase Storage...\n');

  if (!isSupabaseConfigured || !supabase) {
    console.error('❌ Supabase is not configured. Check your .env file.');
    process.exit(1);
  }

  // 1. Ensure public bucket exists
  console.log(`1️⃣ Ensuring bucket "${BUCKET_NAME}" exists and is public...`);
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = (buckets || []).some((b) => b.name === BUCKET_NAME);

  if (!exists) {
    const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
    });

    if (createError && !createError.message.includes('already exists')) {
      console.error('❌ Failed to create bucket:', createError.message);
      process.exit(1);
    }
    console.log(`   ✅ Created public bucket "${BUCKET_NAME}".`);
  } else {
    console.log(`   ✅ Bucket "${BUCKET_NAME}" already exists.`);
  }

  // 2. Upload all images from public/images
  console.log('\n2️⃣ Reading local images from public/images...');
  const files = fs.readdirSync(IMAGES_DIR);
  console.log(`   Found ${files.length} images to upload.`);

  const urlMap = new Map();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(IMAGES_DIR, file);
    const buffer = fs.readFileSync(filePath);

    const ext = path.extname(file).toLowerCase();
    let contentType = 'image/jpeg';
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.svg') contentType = 'image/svg+xml';

    process.stdout.write(`   [${i + 1}/${files.length}] Uploading ${file}... `);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(file, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.log(`❌ Failed: ${uploadError.message}`);
    } else {
      const { data: publicUrlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(file);

      urlMap.set(`/images/${file}`, publicUrlData.publicUrl);
      console.log('✅ Done');
    }
  }

  console.log('\n3️⃣ Updating database property records with cloud URLs...');

  const { data: properties, error: fetchError } = await supabase
    .from('properties')
    .select('id, title, images');

  if (fetchError) {
    console.error('❌ Failed to fetch properties:', fetchError.message);
    process.exit(1);
  }

  let updatedCount = 0;

  for (const property of properties) {
    const originalImages = Array.isArray(property.images) ? property.images : [];
    let hasChanges = false;

    const newImages = originalImages.map((img) => {
      if (typeof img === 'string') {
        const trimmed = img.trim();
        // Check if it's a local /images/ path
        if (urlMap.has(trimmed)) {
          hasChanges = true;
          return urlMap.get(trimmed);
        }
        // Match /images/filename.jpg
        const match = trimmed.match(/\/images\/([^/]+)$/);
        if (match && urlMap.has(`/images/${match[1]}`)) {
          hasChanges = true;
          return urlMap.get(`/images/${match[1]}`);
        }
      }
      return img;
    });

    if (hasChanges) {
      const { error: updateError } = await supabase
        .from('properties')
        .update({ images: newImages })
        .eq('id', property.id);

      if (updateError) {
        console.error(`   ❌ Failed to update ${property.id}:`, updateError.message);
      } else {
        updatedCount++;
        console.log(`   ✅ Updated ${property.id} (${property.title}): ${newImages.length} cloud images.`);
      }
    } else {
      console.log(`   ℹ️  ${property.id} (${property.title}) already using external or cloud URLs.`);
    }
  }

  console.log(`\n🎉 Image migration complete! ${updatedCount} properties updated in PostgreSQL.`);
  console.log('All images are now hosted in Supabase Storage with permanent public URLs.');
}

migrateImages().catch((err) => {
  console.error('\n❌ Unexpected error during migration:', err);
  process.exit(1);
});
