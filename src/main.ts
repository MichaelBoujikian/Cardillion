/**
 * Entry point. During milestone M1 this boots the throwaway look prototype; from M2 on it
 * boots the real app router (`src/app`).
 */
const root = document.getElementById('app');
if (!root) throw new Error('#app root missing');

root.innerHTML = `
  <main style="display:grid;place-items:center;height:100%;text-align:center">
    <div>
      <h1 style="font-weight:600;letter-spacing:0.08em;margin:0 0 0.5rem">CARDILLION</h1>
      <p style="opacity:0.7;margin:0">Milestone M0 - scaffold. See <code>spec.md</code>.</p>
    </div>
  </main>
`;
