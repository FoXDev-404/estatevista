import PropertyProvider from '../context/PropertyProvider';
import ToastProvider from '../context/ToastProvider';
import AppRoutes from './router';

export default function App() {
  return (
    <ToastProvider>
      <PropertyProvider>
        <AppRoutes />
      </PropertyProvider>
    </ToastProvider>
  );
}
