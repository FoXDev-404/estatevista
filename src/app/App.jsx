import PropertyProvider from '../context/PropertyProvider';
import ToastProvider from '../context/ToastProvider';
import AuthProvider from '../context/AuthProvider';
import AppRoutes from './router';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <PropertyProvider>
          <AppRoutes />
        </PropertyProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
