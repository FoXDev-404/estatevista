# EstateVista — Full-Stack Real Estate Marketplace

EstateVista is a modern, data-driven real estate platform built with **React 19, Node.js / Express, Supabase (PostgreSQL), and Supabase Cloud Storage**, deployed seamlessly with **Vercel Serverless Functions**.

The project features a polished public discovery portal, responsive property filters, dynamic galleries, interactive maps, validated enquiry workflows, and an admin studio backed by live cloud persistence and media uploads.

---

## 🌟 Architecture & Key Features

### 🏢 Public Marketplace
- **Hero Carousel:** 5-slide editorial showcase with touch, keyboard, and accessibility controls.
- **Dynamic Property Catalog:** Search by keyword, city, area; filter by type (apartment, house, villa, plot, commercial), purpose (sale/rent), and price range; sort and switch between responsive grid/list views.
- **Property Details:** Slug-based routing, image gallery with lightbox, specifications, amenities, location maps, and interactive enquiry modals.
- **Enquiry Pipeline:** Contact and property enquiry forms submit directly to the Supabase PostgreSQL database (`enquiries` table).
- **Editorial Pages:** Curated About, Services, Contact, and custom 404 pages.

### 🛠️ Admin Studio (`/admin/properties`)
- **Live Database CRUD:** Create, read, update, and delete property records backed by Supabase PostgreSQL.
- **Direct Cloud Photo Upload:** Admins can upload property photos directly to the Supabase Storage bucket (`property-images`) via `POST /api/upload`.
- **Validation & Integrity:** Server and client-side validation, slug uniqueness checks, and safe delete confirmations.
- **Cross-Device Sync:** Changes made from any browser or device immediately reflect across the entire marketplace.

---

## 💻 Tech Stack

- **Frontend:** React 19, React Router 7, Vite 8, Plain CSS (BEM & Design Tokens), Lucide Icons
- **Backend:** Node.js, Express 5, Vercel Serverless Functions (`/api/*`)
- **Database:** PostgreSQL on Supabase (with JSONB specifications, performance indexes, and Row-Level Security)
- **Cloud Storage:** Supabase Cloud Storage (CDN-backed public bucket for property media)
- **Testing:** Vitest, Testing Library (59 passing tests)
- **Code Quality:** ESLint with React Hooks enforcement

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+ (Node.js 22+ recommended)
- npm 10+

### Installation
```bash
git clone https://github.com/FoXDev-404/estatevista.git
cd estatevista
npm install
```

### Environment Configuration
Create a `.env` file from `.env.example`:
```env
PORT=5000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Vite frontend at `http://localhost:5173` |
| `npm run dev:server` | Starts Node.js Express API server at `http://localhost:5000` |
| `npm run dev:all` | Runs both frontend and backend concurrently |
| `npm run db:seed` | Populates Supabase PostgreSQL with canonical seed properties |
| `npm run test:crud` | Runs automated end-to-end CRUD verification against Supabase |
| `npm test` | Runs the Vitest test suite |
| `npm run lint` | Checks codebase with ESLint |
| `npm run build` | Compiles the production bundle into `dist/` |

---

## 📡 API Endpoints

EstateVista runs as an Express API locally and as a unified Vercel Serverless Function in production:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | API and Supabase database health status |
| `GET` | `/api/properties` | Fetch filtered and sorted properties |
| `GET` | `/api/properties/:idOrSlug` | Fetch a single property by ID or slug |
| `POST` | `/api/properties` | Create a new property in Supabase |
| `PUT` | `/api/properties/:id` | Update an existing property in Supabase |
| `DELETE` | `/api/properties/:id` | Delete a property from Supabase |
| `POST` | `/api/upload` | Upload image buffer to Supabase Cloud Storage |
| `POST` | `/api/enquiries` | Save contact / property enquiry to PostgreSQL |
| `POST` | `/api/properties/reset`| Reset properties table to original canonical seeds |

---

## 🧪 Testing & Verification

The project includes thorough unit, component, and integration tests:
- **59 / 59 Vitest tests passing** covering repository logic, property selectors, search query serialization, accessibility, and form validation.
- **Zero ESLint warnings or errors**.
- Automated live database verification script (`npm run test:crud`).

---

## 📄 License & Credits
- **UI & Architecture:** EstateVista
- **Icons:** [Lucide](https://lucide.dev)
- **Fonts:** Cormorant Garamond & Manrope
- **Assignment Brief:** [Digitalsdaddy.com](https://digitalsdaddy.com)
