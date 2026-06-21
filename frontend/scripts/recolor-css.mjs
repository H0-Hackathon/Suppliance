import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../src');

const pageReplacements = [
  ['margin-left: 224px', 'margin-left: var(--sidebar-w)'],
  ['#0a0a0b', '#faf8f5'],
  ['#0c0c0e', '#ffffff'],
  ['#0f0f11', '#ffffff'],
  ['#141416', '#ffffff'],
  ['#151510', '#ffffff'],
  ['#18181c', '#f5f1ec'],
  ['#090909', '#faf8f5'],
  ['#0e0e10', '#faf8f5'],
  ['#f0ede8', '#2B5260'],
  ['#e8e3d8', '#2B5260'],
  ['#f59e0b', '#548C92'],
  ['rgba(245, 158, 11', 'rgba(84, 140, 146'],
  ['rgba(245,158,11', 'rgba(84,140,146'],
  ['#10b981', '#3d7a6e'],
  ['rgba(16,185,129', 'rgba(61,122,110'],
  ['rgba(16, 185, 129', 'rgba(61, 122, 110'],
  ['#ef4444', '#b54a3a'],
  ['#dc2626', '#b54a3a'],
  ['rgba(255, 255, 255, 0.06)', 'rgba(171, 144, 114, 0.15)'],
  ['rgba(255, 255, 255, 0.05)', 'rgba(171, 144, 114, 0.12)'],
  ["font-family: 'Inter'", "font-family: 'Manrope'"],
];

const componentReplacements = [
  ['#e8e3d8', 'var(--ocean)'],
  ['#f1f5f9', 'var(--ocean)'],
  ['#ef4444', '#b54a3a'],
  ['#dc2626', '#b54a3a'],
  ['#f59e0b', '#548C92'],
  ['#10b981', '#3d7a6e'],
  ['#14b8a6', '#548C92'],
  ['#60a5fa', '#548C92'],
  ['#94a3b8', '#8a7560'],
  ['#6b7280', '#8a7560'],
  ['rgba(150,140,100,0.7)', 'var(--text-muted)'],
  ['rgba(150,140,100,0.75)', 'var(--text-muted)'],
  ['rgba(150,140,100,0.6)', 'var(--text-muted)'],
  ['rgba(180,170,140,0.85)', 'var(--text-secondary)'],
  ['rgba(180,170,140,0.8)', 'var(--text-secondary)'],
  ['rgba(245,158,11,0.08)', 'var(--border-soft)'],
  ['rgba(245,158,11,0.12)', 'var(--border-soft)'],
  ['#141416', 'var(--surface)'],
  ['#0e0e10', 'var(--sand-warm)'],
  ['Inter, sans-serif', 'var(--font)'],
  ['Inter, system-ui', 'var(--font)'],
];

function apply(file, replacements) {
  const path = join(root, file);
  let c = readFileSync(path, 'utf8');
  for (const [from, to] of replacements) {
    c = c.split(from).join(to);
  }
  writeFileSync(path, c);
  console.log('Updated', file);
}

for (const f of ['pages/AlertsPage.css', 'pages/SuppliersPage.css']) {
  apply(f, pageReplacements);
}

for (const f of [
  'components/dashboard/LiveAgentResults.tsx',
  'components/AgentDebugPanel.tsx',
  'components/settings/SettingsShared.tsx',
]) {
  try {
    apply(f, componentReplacements);
  } catch (e) {
    console.log('Skip', f, e.message);
  }
}
