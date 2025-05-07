import { AxiosInstance } from 'axios';

const mockAxios: jest.Mocked<AxiosInstance> = {
  create: jest.fn(() => mockAxios),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn(),
  head: jest.fn(),
  options: jest.fn(),
  request: jest.fn(),
  interceptors: {
    request: { use: jest.fn(), eject: jest.fn(), clear: jest.fn(), handlers: [] },
    response: { use: jest.fn(), eject: jest.fn(), clear: jest.fn(), handlers: [] }
  },
  defaults: {
    headers: {
      common: {},
      delete: {},
      get: {},
      head: {},
      post: {},
      put: {},
      patch: {}
    },
    baseURL: '',
    transformRequest: [],
    transformResponse: [],
    timeout: 0,
    withCredentials: false,
    adapter: jest.fn(),
    responseType: 'json',
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
    maxContentLength: -1,
    validateStatus: jest.fn(),
    maxBodyLength: -1,
    maxRedirects: 5,
    beforeRedirect: jest.fn(),
    socketPath: null,
    httpAgent: undefined,
    httpsAgent: undefined
  },
  getUri: jest.fn()
} as any;

export default mockAxios; 