import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { ParlayProvider } from './context/ParlayContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <ThemeProvider>
      <ParlayProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ParlayProvider>
    </ThemeProvider>
  </ErrorBoundary>
);


