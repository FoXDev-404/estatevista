import app from '../server/index.js';
import http from 'http';

const TEST_PORT = 5055;

// High quality architectural real estate photos from Unsplash
const UNSPLASH_IMAGES = [
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
];

async function runCrudTest() {
  console.log('🧪 Starting Full CRUD Verification with Unsplash Images...\n');

  // Start temporary server instance
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  const baseUrl = `http://localhost:${TEST_PORT}/api`;

  try {
    // 1. HEALTH CHECK
    console.log('1️⃣ Checking API & Supabase Health...');
    const healthRes = await fetch(`${baseUrl}/health`);
    const health = await healthRes.json();
    console.log('   Status:', health.status);
    console.log('   Database:', health.database);
    console.log('   Initial Properties Count:', health.propertiesCount);

    if (health.database !== 'connected') {
      throw new Error(`Database is not connected: ${health.database}`);
    }

    // 2. CREATE (POST /api/properties) with Unsplash Images
    console.log('\n2️⃣ Testing CREATE with Unsplash Images...');
    const newPropertyPayload = {
      title: 'Azure Horizon Penthouse',
      slug: 'azure-horizon-penthouse-bandra',
      type: 'penthouse',
      purpose: 'sale',
      price: 85000000,
      currency: 'INR',
      location: {
        city: 'Mumbai',
        area: 'Bandra West',
        address: '88 Carter Road, Bandra West, Mumbai 400050',
      },
      specifications: {
        bedrooms: 4,
        bathrooms: 5,
        area: 3400,
        areaUnit: 'sqft',
      },
      images: UNSPLASH_IMAGES,
      description: 'A spectacular sky penthouse with unobstructed Arabian Sea views, infinity pool terrace, and bespoke modernist finishes.',
      amenities: ['Sea view', 'Private terrace', 'Infinity pool', 'Concierge', 'Private elevator', '4 Covered parking'],
      facilities: ['24x7 Security', 'Power backup', 'Clubhouse', 'Gymnasium'],
      status: 'available',
      featured: true,
      trending: true,
    };

    const createRes = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPropertyPayload),
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(`Failed to create property: ${JSON.stringify(err)}`);
    }

    const createdProperty = await createRes.json();
    console.log('   ✅ Created Property ID:', createdProperty.id);
    console.log('   ✅ Title:', createdProperty.title);
    console.log('   ✅ Unsplash Images saved:', createdProperty.images.length);
    console.log('   ✅ Sample Image URL:', createdProperty.images[0]);

    const createdId = createdProperty.id;

    // 3. READ (GET by ID & Slug)
    console.log('\n3️⃣ Testing READ (by ID and by Slug)...');
    const getByIdRes = await fetch(`${baseUrl}/properties/${createdId}`);
    if (!getByIdRes.ok) throw new Error(`Failed to get property by ID: ${createdId}`);
    const fetchedById = await getByIdRes.json();
    console.log('   ✅ Fetched by ID successfully:', fetchedById.title);

    const getBySlugRes = await fetch(`${baseUrl}/properties/${createdProperty.slug}`);
    if (!getBySlugRes.ok) throw new Error(`Failed to get property by slug: ${createdProperty.slug}`);
    const fetchedBySlug = await getBySlugRes.json();
    console.log('   ✅ Fetched by Slug successfully:', fetchedBySlug.slug);

    // Verify Unsplash links
    if (!fetchedBySlug.images[0].includes('images.unsplash.com')) {
      throw new Error('Unsplash image URL was not stored correctly!');
    }

    // 4. UPDATE (PUT /api/properties/:id)
    console.log('\n4️⃣ Testing UPDATE (Modifying Price, Title, and adding another Unsplash Image)...');
    const extraUnsplashImage = 'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1200&q=80';
    const updatePayload = {
      title: 'Azure Horizon Sky Villa',
      price: 92000000,
      images: [...UNSPLASH_IMAGES, extraUnsplashImage],
    };

    const updateRes = await fetch(`${baseUrl}/properties/${createdId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatePayload),
    });

    if (!updateRes.ok) {
      const err = await updateRes.json();
      throw new Error(`Failed to update property: ${JSON.stringify(err)}`);
    }

    const updatedProperty = await updateRes.json();
    console.log('   ✅ Updated Title:', updatedProperty.title);
    console.log('   ✅ Updated Price:', updatedProperty.price);
    console.log('   ✅ Updated Image Count (4 Unsplash photos):', updatedProperty.images.length);

    // 5. DELETE (DELETE /api/properties/:id)
    console.log('\n5️⃣ Testing DELETE...');
    const deleteRes = await fetch(`${baseUrl}/properties/${createdId}`, {
      method: 'DELETE',
    });

    if (!deleteRes.ok) {
      const err = await deleteRes.json();
      throw new Error(`Failed to delete property: ${JSON.stringify(err)}`);
    }

    const deletedProperty = await deleteRes.json();
    console.log('   ✅ Deleted Property ID:', deletedProperty.id);

    // Verify it is gone
    const verifyDeleteRes = await fetch(`${baseUrl}/properties/${createdId}`);
    if (verifyDeleteRes.status === 404) {
      console.log('   ✅ Confirmed: Property is 404 Not Found after deletion.');
    } else {
      throw new Error('Property was not deleted properly!');
    }

    console.log('\n🎉 ALL CRUD OPERATIONS WITH UNSPLASH IMAGES PASSED SUCCESSFULLY!');
    server.close(() => process.exit(0));
  } finally {
    server.close();
  }
}

runCrudTest().catch((err) => {
  console.error('\n❌ CRUD test failed:', err);
  process.exit(1);
});
