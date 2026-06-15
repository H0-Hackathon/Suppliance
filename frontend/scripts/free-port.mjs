// Frees up a local TCP port by killing whatever process is bound to it.
// Runs before `dev` so a leftover Vite instance doesn't block the port.
import { execSync } from 'node:child_process';

const port = process.argv[2];
if (!port) {
  process.exit(0);
}

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8' });
  } catch {
    return '';
  }
}

if (process.platform === 'win32') {
  const output = run('netstat -ano');
  const pids = new Set();
  for (const line of output.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5 || parts[0] !== 'TCP') continue;
    const [, localAddr, , , pid] = parts;
    if (localAddr.split(':').pop() === port && pid !== '0') {
      pids.add(pid);
    }
  }
  for (const pid of pids) {
    console.log(`[free-port] Port ${port} in use by PID ${pid} -- killing it`);
    run(`taskkill /F /PID ${pid}`);
  }
} else {
  const output = run(`lsof -ti:${port}`);
  for (const pid of output.split('\n').map((p) => p.trim()).filter(Boolean)) {
    console.log(`[free-port] Port ${port} in use by PID ${pid} -- killing it`);
    run(`kill -9 ${pid}`);
  }
}
