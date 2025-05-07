/**
 * Test data for Purchase Order mockup testing
 */

// Sample purchase order data for testing PDF generation
export const samplePurchaseOrder = {
  poNumber: 'PO-2023-1234',
  requestedBy: 'John Doe',
  approvedBy: 'Jane Smith',
  createdAt: new Date().toISOString(),
  urgent: true,
  nextDayShipping: true,
  supplier: {
    name: 'ABC Electronics Supply',
    contactName: 'Robert Johnson',
    address: '123 Main Street, Suite 100, Anytown, CA 12345',
    email: 'sales@abcelectronics.example.com',
    phone: '(555) 123-4567'
  },
  items: [
    {
      name: 'Processor Board',
      partNumber: 'FV-CPU-2022',
      quantity: 5,
      price: 249.99
    },
    {
      name: 'Memory Module 16GB',
      partNumber: 'FV-RAM-16G',
      quantity: 10,
      price: 89.95
    },
    {
      name: 'Power Supply 750W',
      partNumber: 'FV-PSU-750',
      quantity: 3,
      price: 119.50
    }
  ],
  shipping_cost: 45.00,
  tax_amount: 123.75
};

// Sample supplier list for dropdown options
export const sampleSuppliers = [
  {
    id: 1,
    name: 'ABC Electronics Supply',
    contactName: 'Robert Johnson',
    address: '123 Main Street, Suite 100, Anytown, CA 12345',
    email: 'sales@abcelectronics.example.com',
    phone: '(555) 123-4567'
  },
  {
    id: 2,
    name: 'Tech Components Inc.',
    contactName: 'Sarah Williams',
    address: '456 Tech Blvd, Building B, Techville, NY 54321',
    email: 'orders@techcomponents.example.com',
    phone: '(555) 987-6543'
  },
  {
    id: 3,
    name: 'Global Parts Distributors',
    contactName: 'Michael Chen',
    address: '789 Distribution Way, Warehouse 5, Shiptown, TX 67890',
    email: 'sales@globalparts.example.com',
    phone: '(555) 456-7890'
  }
];

// Sample part information for suggestions
export const sampleParts = [
  {
    name: 'Processor Board',
    partNumber: 'FV-CPU-2022',
    defaultPrice: 249.99
  },
  {
    name: 'Memory Module 16GB',
    partNumber: 'FV-RAM-16G',
    defaultPrice: 89.95
  },
  {
    name: 'Power Supply 750W',
    partNumber: 'FV-PSU-750',
    defaultPrice: 119.50
  },
  {
    name: 'Network Card 10GbE',
    partNumber: 'FV-NET-10G',
    defaultPrice: 179.99
  },
  {
    name: 'SSD 1TB',
    partNumber: 'FV-SSD-1T',
    defaultPrice: 149.95
  }
]; 