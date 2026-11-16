import { Navigate, Route, Routes } from 'react-router-dom';
import PublicLayout from '../components/layout/PublicLayout';
import AdminLayout from '../components/admin/AdminLayout';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import Login from '../pages/Login';
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
import AdminProjects from '../pages/admin/AdminProjects';
import AdminProjectForm from '../pages/admin/AdminProjectForm';
import AdminProjectDetail from '../pages/admin/AdminProjectDetail';
import AdminUnits from '../pages/admin/AdminUnits';
import AdminLeads from '../pages/admin/AdminLeads';
import AdminLeadDetail from '../pages/admin/AdminLeadDetail';
import AdminVisits from '../pages/admin/AdminVisits';
import AdminCustomers from '../pages/admin/AdminCustomers';
import AdminSettings from '../pages/admin/AdminSettings';
import AdminBranches from '../pages/admin/AdminBranches';
import AdminTeam from '../pages/admin/AdminTeam';
import AdminRoles from '../pages/admin/AdminRoles';
import AdminRoleEditor from '../pages/admin/AdminRoleEditor';
import AdminAuditLogs from '../pages/admin/AdminAuditLogs';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

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

      <Route path="/admin" element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to="properties" replace />} />
          <Route
            path="properties"
            element={
              <ProtectedRoute permission="properties.view">
                <AdminProperties />
              </ProtectedRoute>
            }
          />
          <Route
            path="properties/new"
            element={
              <ProtectedRoute permission="properties.manage">
                <AdminPropertyCreate />
              </ProtectedRoute>
            }
          />
          <Route
            path="properties/:id/edit"
            element={
              <ProtectedRoute permission="properties.manage">
                <AdminPropertyEdit />
              </ProtectedRoute>
            }
          />
          <Route
            path="projects"
            element={
              <ProtectedRoute permission="projects.view">
                <AdminProjects />
              </ProtectedRoute>
            }
          />
          <Route
            path="projects/new"
            element={
              <ProtectedRoute permission="projects.create">
                <AdminProjectForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="projects/:id"
            element={
              <ProtectedRoute permission="projects.view">
                <AdminProjectDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="projects/:id/edit"
            element={
              <ProtectedRoute permission="projects.edit">
                <AdminProjectForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="units"
            element={
              <ProtectedRoute permission="units.view">
                <AdminUnits />
              </ProtectedRoute>
            }
          />
          <Route
            path="leads"
            element={
              <ProtectedRoute permission="leads.view">
                <AdminLeads />
              </ProtectedRoute>
            }
          />
          <Route
            path="leads/:id"
            element={
              <ProtectedRoute permission="leads.view">
                <AdminLeadDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="visits"
            element={
              <ProtectedRoute permission="visits.view">
                <AdminVisits />
              </ProtectedRoute>
            }
          />
          <Route
            path="customers"
            element={
              <ProtectedRoute permission="customers.view">
                <AdminCustomers />
              </ProtectedRoute>
            }
          />
          <Route
            path="settings"
            element={
              <ProtectedRoute permission="settings.view">
                <AdminSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="branches"
            element={
              <ProtectedRoute permission="branches.view">
                <AdminBranches />
              </ProtectedRoute>
            }
          />
          <Route
            path="team"
            element={
              <ProtectedRoute permission="team.view">
                <AdminTeam />
              </ProtectedRoute>
            }
          />
          <Route
            path="roles"
            element={
              <ProtectedRoute permission="roles.view">
                <AdminRoles />
              </ProtectedRoute>
            }
          />
          <Route
            path="roles/new"
            element={
              <ProtectedRoute permission="roles.create">
                <AdminRoleEditor />
              </ProtectedRoute>
            }
          />
          <Route
            path="roles/:id/edit"
            element={
              <ProtectedRoute permission="roles.edit">
                <AdminRoleEditor />
              </ProtectedRoute>
            }
          />
          <Route
            path="audit-logs"
            element={
              <ProtectedRoute permission="audit.view">
                <AdminAuditLogs />
              </ProtectedRoute>
            }
          />
        </Route>
      </Route>
    </Routes>
  );
}
