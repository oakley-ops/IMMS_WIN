module.exports = {
  // Use node environment for API/backend tests
  testEnvironment: 'node',
  
  // Define where to find test files
  testMatch: [
    "**/__tests__/**/*.test.js"
  ],
  
  // Files to collect coverage from
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/**/*.test.js"
  ],
  
  // Coverage configuration
  coverageDirectory: "coverage",
  
  // Automatically clear mock calls between every test
  clearMocks: true,
}; 