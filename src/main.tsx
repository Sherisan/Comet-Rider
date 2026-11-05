import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import '@fontsource/outfit/800.css';
import '@fontsource/outfit/900.css';
import '@fontsource/geist-mono/700.css';
import '@fontsource/geist-mono/800.css';
import '@fontsource/geist-mono/900.css';
import './styles/global.css';
import { getEvolution } from './api/rest';
import { applyEvolutionMultipliers } from './game/tiers';

// Evolution multipliers come from the Game Back Office. Wait briefly for them so the first round
// already uses them; if the API is slow or down the built-in values in tiers.ts are used.
const EVOLUTION_TIMEOUT_MS = 2500;
const evolution = getEvolution('comet-rider')
  .then(applyEvolutionMultipliers)
  .catch((err) => console.warn('Evolution config unavailable — using built-in multipliers', err));

Promise.race([evolution, new Promise((resolve) => setTimeout(resolve, EVOLUTION_TIMEOUT_MS))]).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
