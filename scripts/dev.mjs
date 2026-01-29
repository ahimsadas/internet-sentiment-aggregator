#!/usr/bin/env node
import { networkInterfaces } from 'os';
import { spawn } from 'child_process';

const PORT = process.env.PORT || 3000;

// Get local IP address
function getLocalIP() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const localIP = getLocalIP();

console.log('\n');
console.log('  ┌─────────────────────────────────────────────┐');
console.log('  │                                             │');
console.log(`  │  Local:    http://localhost:${PORT}           │`);
console.log(`  │  Network:  http://${localIP}:${PORT}        │`);
console.log('  │                                             │');
console.log('  └─────────────────────────────────────────────┘');
console.log('\n');

// Run next dev with hostname 0.0.0.0 to allow network access
const next = spawn('npx', ['next', 'dev', '-H', '0.0.0.0', '-p', PORT.toString()], {
  stdio: 'inherit',
  shell: true,
});

next.on('close', (code) => {
  process.exit(code);
});
