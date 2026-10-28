import { Navigate, Route, Routes } from 'react-router-dom';
import PublicLayout from '../components/layout/PublicLayout';
import AdminLayout from '../components/admin/AdminLayout';
import Home from '../pages/Home';
import Properties from '../pages/Properties';
import PropertyDetails from '../pages/PropertyDetails';
import About from '../pages/About';
import Services from '../pages/Services';
import Contact from '../pages/Contact';
import NotFound from '../pages/NotFound';
import AdminProperties from '../pages/admin/AdminProperties';
import AdminPropertyCreate from '../pages/admin/AdminPropertyCreate';
import AdminPropertyEdit from '../pages/admin/AdminPropertyEdit';
import AdminLogin from '../pages/admin/AdminLogin';

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="properties" element={<Properties />} />
        <Route path="properties/:slug" element={<PropertyDetails />} />
        <Route path="properties/id/:id" element={<PropertyDetails />} />
        <Route path="about" element={<About />} />
        <Route path="services" element={<Services />} />
        <Route path="contact" element={<Contact />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route path="/admin" element={<AdminLayout />}>
        <Route path="login" element={<AdminLogin />} />
        <Route index element={<Navigate to="properties" replace />} />
        <Route path="properties" element={<AdminProperties />} />
        <Route path="properties/new" element={<AdminPropertyCreate />} />
        <Route path="properties/:id/edit" element={<AdminPropertyEdit />} />
      </Route>
    </Routes>
  );
}
