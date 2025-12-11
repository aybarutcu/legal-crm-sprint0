#!/usr/bin/env tsx
/**
 * Test runner for document and folder tests
 * Usage: npx tsx tests/run-document-tests.ts
 */

import { spawn } from 'child_process';

const tests = [
  'tests/api/documents/upload.spec.ts',
  'tests/api/folders/folder-hierarchy.spec.ts',
  'tests/api/workflows/document-requests.spec.ts',
];

console.log('🧪 Running Document & Folder Tests\n');
console.log('Tests to run:');
tests.forEach((test, i) => {
  console.log(`  ${i + 1}. ${test}`);
});
console.log('');

const runTests = () => {
  const vitest = spawn('npx', ['vitest', 'run', ...tests], {
    stdio: 'inherit',
    shell: true,
  });

  vitest.on('close', (code) => {
    if (code === 0) {
      console.log('\n✅ All tests passed!');
    } else {
      console.log(`\n❌ Tests failed with code ${code}`);
      process.exit(code ?? 1);
    }
  });

  vitest.on('error', (err) => {
    console.error('Failed to run tests:', err);
    process.exit(1);
  });
};

runTests();
