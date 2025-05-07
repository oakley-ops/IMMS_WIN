require('dotenv').config();
const { spawnSync } = require('child_process');

// Run basic test first
console.log('Running basic re-routing test...');
const basicTestResult = spawnSync('node', ['src/tests/emailReroutingTest.js'], {
  stdio: 'inherit'
});

if (basicTestResult.status !== 0) {
  console.error('Basic test failed. Aborting further tests.');
  process.exit(1);
}

// Run full suite
console.log('Running comprehensive test suite...');
const suiteResult = spawnSync('node', ['src/tests/emailReroutingSuite.js'], {
  stdio: 'inherit'
});

if (suiteResult.status !== 0) {
  console.error('Test suite failed.');
  process.exit(1);
}

console.log('All tests passed successfully!');
process.exit(0);



