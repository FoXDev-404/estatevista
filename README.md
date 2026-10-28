# EstateVista — Assignment Submission

EstateVista is a **frontend-only real-estate website created for a Junior Frontend Developer
assignment**. It is not a real estate company, live marketplace, production business, or
verified property service.

The project demonstrates the requested public pages, reusable React components, data-driven
content, property search, property details, maps, forms, and a browser-based admin CRUD flow.
The assignment brief was provided by [Digitalsdaddy.com](https://digitalsdaddy.com).

## Features

### Public website

- **Home:** five-slide hero, search, featured/trending/latest properties, categories, locations,
  Why Choose Us, services, testimonials, CTA, and footer.
- **Properties:** dynamic cards, keyword/location search, type/purpose/price/featured filters,
  sorting, URL-synced pagination, and grid/list views.
- **Property details:** slug or ID lookup, gallery/lightbox, price, location, map, specifications,
  amenities, facilities, enquiry form, advisor contact, and related properties.
- **About:** company introduction, mission, vision, statistics, values, team, and Why Choose Us.
- **Services:** five data-driven services with descriptions, imagery, and process guidance.
- **Contact:** validated contact form, contact details, business hours, social links, and
  OpenStreetMap office map.
- **404:** branded not-found page for unknown routes and properties.

### Admin studio

- Dashboard with totals and status filters.
- Search by reference, title, slug, city, area, or type.
- Create, edit, delete, validation, duplicate protection, and reset-to-seed data.
- Location map preview in the property editor.
- Browser `localStorage` persistence and cross-tab updates.

## Tech stack

- React 19
- React Router 7
- Vite 8
- JavaScript / JSX
- Plain CSS
- Vitest and Testing Library
- ESLint
- Lucide React

## Getting started

### Requirements

- Node.js 20.19+ (Node.js 22+ recommended)
- npm 10+

### Install and run

```bash
npm install
npm run dev
```

Open the local URL shown by Vite, normally <http://localhost:5173/>.

### Available scripts

```bash
npm run dev       # Start development server
npm run build     # Create production build
npm run preview   # Preview production build
npm test          # Run Vitest tests
npm run lint      # Run ESLint
```

## Routes

### Public

| Route | Page |
| --- | --- |
| `/` | Home |
| `/properties` | Property listing |
| `/properties/:slug` | Property details |
| `/properties/id/:id` | Property details by ID |
| `/about` | About |
| `/services` | Services |
| `/contact` | Contact |
| `*` | Branded 404 |

### Admin

| Route | Page |
| --- | --- |
| `/admin` | Redirects to the dashboard |
| `/admin/properties` | Property dashboard |
| `/admin/properties/new` | Create property |
| `/admin/properties/:id/edit` | Edit property |

## Data architecture

Repeatable content is centralized in `src/data/`:

| File | Content |
| --- | --- |
| `properties.js` | Initial property records |
| `hero-slides.js` | Five hero slides |
| `home.js` | Homepage section copy |
| `services.js` | Service offerings |
| `categories.js` | Property categories |
| `locations.js` | Popular locations |
| `about.js` | Story, mission, vision, values |
| `team.js` | Team profiles |
| `testimonials.js` | Testimonials |
| `contact.js` | Contact information and map |
| `site.js` | Site-wide settings |

All public property sections use the same canonical records from `src/data/properties.js`.
Property selection, filtering, sorting, validation, formatting, and storage logic lives in
`src/services/`.

### Property persistence

The assignment uses browser storage:

```text
estatevista.properties.v1
```

On first load, the repository seeds the collection from `src/data/properties.js`. After that,
valid browser data is preserved. Create, update, delete, and reset operations write immediately
to `localStorage`; other open tabs refresh through the browser `storage` event.

To restore the original seed collection:

1. Open `/admin/properties`.
2. Select **Reset property data**.
3. Confirm the reset.

Or run in browser developer tools:

```js
localStorage.removeItem('estatevista.properties.v1');
location.reload();
```

## Testing

The test suite covers repository CRUD and validation, selectors, URL filters, property listing,
maps, hero behavior, reduced motion, and admin form validation.

Current verification commands:

```bash
npm test
npm run lint
npm run build
```

Browser QA covers the public pages, admin pages, mobile navigation, gallery, filters, pagination,
maps, and the local create → reload → update → delete flow.

## Deployment

This is a Vite single-page application. Build it with:

```bash
npm run build
```

Deploy the `dist/` directory to a static host and configure an SPA fallback to `index.html`.
The repository includes `vercel.json` and `public/_redirects`.

## Assignment scope and limitations

- Property records, prices, availability, addresses, team members, testimonials, and contact
  details are fictional assignment content.
- There is no backend, database, authentication, role-based access control, or cross-device
  synchronization.
- The admin studio is open to anyone who visits `/admin` and stores data only in that browser.
- Contact and property enquiry forms validate input and show success feedback, but do not send or
  persist messages.
- OpenStreetMap embeds are used for the contact and property location previews.
- No payments, saved searches, user accounts, CRM, listing verification, or transaction processing
  are included.
- Replace fictional content, imagery, and contact details with verified production assets before
  commercial use.

## Credits

- **Assignment brief:** [Digitalsdaddy.com](https://digitalsdaddy.com)
- **Photography:** [Unsplash](https://unsplash.com) contributors
- **Icons:** [Lucide](https://lucide.dev)
- **Fonts:** Cormorant Garamond and Manrope

EstateVista is an independent assignment project and frontend demonstration. It is not affiliated
with, endorsed by, or sponsored by any property brand, agency, listing service, or real estate
company.
