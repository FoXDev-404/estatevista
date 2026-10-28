import { useContext } from 'react';
import PropertyContext from '../context/PropertyContext';

export default function useProperties() {
  const context = useContext(PropertyContext);
  if (!context) {
    throw new Error('useProperties must be used within a PropertyProvider.');
  }
  return context;
}
