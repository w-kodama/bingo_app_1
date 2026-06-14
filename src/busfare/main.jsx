import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import BusFare from './BusFare.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BusFare />
  </StrictMode>,
);
