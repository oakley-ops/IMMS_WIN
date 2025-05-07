// Mock localStorage
export const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn(),
  removeItem: jest.fn(),
  key: jest.fn(),
  length: 0
};

// Set up mock localStorage
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });
