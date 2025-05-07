const swaggerJsdoc = require('swagger-jsdoc');
const { version } = require('../package.json');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Fiserv Inventory API Documentation',
      version,
      description: 'API documentation for the Fiserv Inventory Management System',
      license: {
        name: 'Private',
        url: 'https://yourcompany.com',
      },
      contact: {
        name: 'API Support',
        url: 'https://yourcompany.com/support',
        email: 'support@yourcompany.com',
      },
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:3001',
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        csrfToken: {
          type: 'apiKey',
          in: 'header',
          name: 'X-CSRF-Token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              description: 'Error type',
            },
            message: {
              type: 'string',
              description: 'Error message',
            },
            details: {
              type: 'object',
              description: 'Additional error details',
            },
          },
        },
        Part: {
          type: 'object',
          required: ['name', 'fiserv_part_number', 'quantity'],
          properties: {
            part_id: {
              type: 'integer',
              description: 'Unique identifier for the part',
            },
            name: {
              type: 'string',
              description: 'Name of the part',
            },
            description: {
              type: 'string',
              description: 'Description of the part',
            },
            manufacturer_part_number: {
              type: 'string',
              description: 'Manufacturer part number',
            },
            fiserv_part_number: {
              type: 'string',
              description: 'Fiserv part number',
            },
            quantity: {
              type: 'integer',
              description: 'Current quantity in stock',
            },
            minimum_quantity: {
              type: 'integer',
              description: 'Minimum quantity threshold',
            },
            manufacturer: {
              type: 'string',
              description: 'Manufacturer name',
            },
            cost: {
              type: 'number',
              description: 'Cost per unit',
            },
            location: {
              type: 'string',
              description: 'Storage location',
            },
            notes: {
              type: 'string',
              description: 'Additional notes',
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'discontinued'],
              description: 'Part status',
            },
          },
        },
        Machine: {
          type: 'object',
          required: ['name', 'serial_number'],
          properties: {
            machine_id: {
              type: 'integer',
              description: 'Unique identifier for the machine',
            },
            name: {
              type: 'string',
              description: 'Machine name',
            },
            serial_number: {
              type: 'string',
              description: 'Machine serial number',
            },
            model: {
              type: 'string',
              description: 'Machine model',
            },
            location: {
              type: 'string',
              description: 'Machine location',
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'maintenance'],
              description: 'Machine status',
            },
          },
        },
        User: {
          type: 'object',
          required: ['username', 'role'],
          properties: {
            user_id: {
              type: 'integer',
              description: 'Unique identifier for the user',
            },
            username: {
              type: 'string',
              description: 'Username',
            },
            role: {
              type: 'string',
              enum: ['admin', 'user'],
              description: 'User role',
            },
            is_active: {
              type: 'boolean',
              description: 'Whether the user is active',
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.js'], // Path to the API routes
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec; 