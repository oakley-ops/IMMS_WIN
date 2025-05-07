const request = require('supertest');
const app = require('../../src/app'); // Make sure this exports the app without starting the server

// Mock the database connection
jest.mock('../../src/config/db', () => ({
  query: jest.fn(),
  connect: jest.fn()
}));

describe('API Integration Tests', () => {
  let authToken;
  let testPartId;

  // Before all tests, get authentication token
  beforeAll(async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: process.env.TEST_USER,
        password: process.env.TEST_PASSWORD
      });
    authToken = response.body.token;
  });

  // Clean up after tests
  afterAll(async () => {
    // Mock cleanup
  });

  describe('Parts API', () => {
    test('GET /api/parts should return parts list', async () => {
      const response = await request(app)
        .get('/api/parts')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('POST /api/parts should create new part', async () => {
      const newPart = {
        name: 'Test Part',
        quantity: 10,
        manufacturer_part_number: 'TEST-123',
        fiserv_part_number: 'FIS-123'
      };

      const response = await request(app)
        .post('/api/parts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newPart);

      expect(response.status).toBe(201);
      expect(response.body.name).toBe(newPart.name);
      testPartId = response.body.part_id;
    });

    test('PUT /api/parts/:id should update part', async () => {
      const updateData = {
        quantity: 15
      };

      const response = await request(app)
        .put(`/api/parts/${testPartId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.quantity).toBe(15);
    });
  });

  describe('Authentication', () => {
    test('should reject invalid login', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'invalid',
          password: 'invalid'
        });

      expect(response.status).toBe(401);
    });

    test('should reject requests without token', async () => {
      const response = await request(app)
        .get('/api/parts');

      expect(response.status).toBe(401);
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'OK');
    });
  });
}); 