// Set up test environment variables
process.env.NODE_ENV = 'test';

// Mock any global functions if needed
global.console.log = jest.fn();

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
}); 