// Runs the server (tsx watch) and Vite together. Ctrl+C stops both.
// shortcut: shared/ is built once at start; rerun `npm run dev` after editing shared/.
import { spawn } from 'node:child_process';

const procs = ['server', 'web'].map((w) =>
  spawn('npm', ['run', 'dev', '-w', w], { stdio: 'inherit', shell: process.platform === 'win32' }),
);
const stop = () => procs.forEach((p) => p.kill('SIGTERM'));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
procs.forEach((p) => p.on('exit', (code) => { if (code) { stop(); process.exitCode = code; } }));
