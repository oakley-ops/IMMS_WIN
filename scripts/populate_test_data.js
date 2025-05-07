const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:4000/api/v1'; // Adjust if your API is on a different port/path
const TOKEN = process.env.AUTH_TOKEN || ''; // Set your authentication token if required

// Create axios instance with auth header
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': TOKEN ? `Bearer ${TOKEN}` : ''
  }
});

// Vendor data
const vendors = [
  {
    name: 'TechSupply Co.',
    contact_name: 'John Smith',
    email: 'john@techsupply.example.com',
    phone: '555-123-4567',
    address: '123 Tech Way, Silicon Valley, CA 94025',
    notes: 'Primary supplier for printer parts'
  },
  {
    name: 'ServerParts Inc.',
    contact_name: 'Alice Johnson',
    email: 'alice@serverparts.example.com',
    phone: '555-987-6543',
    address: '456 Server Road, Austin, TX 78701',
    notes: 'Specializes in server and networking equipment'
  },
  {
    name: 'Electronics Warehouse',
    contact_name: 'Bob Williams',
    email: 'bob@electronics.example.com',
    phone: '555-555-5555',
    address: '789 Circuit Drive, Boston, MA 02108',
    notes: 'Good prices on bulk electronic components'
  }
];

// Parts data - we'll link these to vendors once we have vendor IDs
const partsTemplate = [
  {
    name: 'HP Toner Cartridge',
    description: 'Black toner cartridge for HP LaserJet printers',
    manufacturer_part_number: 'HP78A-BLK',
    fiserv_part_number: 'FS-T001',
    location: 'Shelf A1',
    quantity: 15,
    minimum_quantity: 5,
    unit_cost: 89.99
  },
  {
    name: 'Dell Server RAM',
    description: '16GB DDR4 RAM for Dell PowerEdge servers',
    manufacturer_part_number: 'DELL-RAM16',
    fiserv_part_number: 'FS-M001',
    location: 'Cabinet B3',
    quantity: 8,
    minimum_quantity: 4,
    unit_cost: 129.50
  },
  {
    name: 'Network Cable Cat6',
    description: '10ft Cat6 Ethernet cable',
    manufacturer_part_number: 'CC-CAT6-10FT',
    fiserv_part_number: 'FS-N001',
    location: 'Drawer C2',
    quantity: 42,
    minimum_quantity: 20,
    unit_cost: 12.99
  },
  {
    name: 'Power Supply 650W',
    description: '650W ATX power supply for workstations',
    manufacturer_part_number: 'PS650W-ATX',
    fiserv_part_number: 'FS-P001',
    location: 'Shelf D1',
    quantity: 7,
    minimum_quantity: 3,
    unit_cost: 65.75
  },
  {
    name: 'USB-C Dock',
    description: 'Universal USB-C docking station',
    manufacturer_part_number: 'DOCK-USB-C',
    fiserv_part_number: 'FS-D001',
    location: 'Cabinet E2',
    quantity: 12,
    minimum_quantity: 5,
    unit_cost: 149.99
  },
  {
    name: 'Laptop Battery',
    description: 'Replacement battery for Dell Latitude laptops',
    manufacturer_part_number: 'BATT-DELL-LAT',
    fiserv_part_number: 'FS-B001',
    location: 'Drawer F3',
    quantity: 4,
    minimum_quantity: 6,
    unit_cost: 89.95
  },
  {
    name: 'Wireless Mouse',
    description: 'Logitech wireless mouse',
    manufacturer_part_number: 'LOGI-M720',
    fiserv_part_number: 'FS-M002',
    location: 'Shelf G1',
    quantity: 18,
    minimum_quantity: 10,
    unit_cost: 34.99
  },
  {
    name: 'SSD Drive 1TB',
    description: '1TB SATA SSD for workstations',
    manufacturer_part_number: 'SSD1TB-SATA',
    fiserv_part_number: 'FS-S001',
    location: 'Cabinet H2',
    quantity: 9,
    minimum_quantity: 5,
    unit_cost: 119.95
  },
  {
    name: 'LCD Monitor 24"',
    description: '24-inch LCD monitor 1080p',
    manufacturer_part_number: 'LCD24-1080P',
    fiserv_part_number: 'FS-L001',
    location: 'Room J1',
    quantity: 3,
    minimum_quantity: 2,
    unit_cost: 179.99
  },
  {
    name: 'Keyboard',
    description: 'USB wired keyboard',
    manufacturer_part_number: 'KB-USB-STD',
    fiserv_part_number: 'FS-K001',
    location: 'Shelf K3',
    quantity: 11,
    minimum_quantity: 8,
    unit_cost: 29.99
  }
];

// Map parts to specific vendors (will be populated after vendors are created)
let parts = [];

// Function to add vendors
async function addVendors() {
  const vendorIds = [];
  console.log('Adding vendors...');
  
  for (const vendor of vendors) {
    try {
      const response = await api.post('/vendors', vendor);
      console.log(`Added vendor: ${vendor.name} with ID: ${response.data.vendor_id}`);
      vendorIds.push(response.data.vendor_id);
    } catch (error) {
      console.error(`Error adding vendor ${vendor.name}:`, error.response?.data || error.message);
    }
  }
  
  return vendorIds;
}

// Function to add parts
async function addParts(vendorIds) {
  console.log('Adding parts...');
  
  // Distribute parts among vendors
  parts = partsTemplate.map((part, index) => {
    const vendorIndex = index % vendorIds.length;
    return {
      ...part,
      vendor_id: vendorIds[vendorIndex]
    };
  });
  
  for (const part of parts) {
    try {
      const response = await api.post('/parts', part);
      console.log(`Added part: ${part.name} with ID: ${response.data.part_id}`);
    } catch (error) {
      console.error(`Error adding part ${part.name}:`, error.response?.data || error.message);
    }
  }
}

// Function to create a low stock scenario for testing
async function createLowStockScenario() {
  console.log('Creating low stock scenario...');
  
  // Set 3 parts to below minimum quantity
  const lowStockParts = [1, 5, 8]; // Using array indices
  
  for (const index of lowStockParts) {
    if (index < parts.length) {
      const part = parts[index];
      try {
        // Get the current part data
        const getResponse = await api.get(`/parts/${part.part_id}`);
        const currentPart = getResponse.data;
        
        // Update the quantity to below minimum
        const updateData = {
          ...currentPart,
          quantity: Math.max(0, currentPart.minimum_quantity - 2) // 2 below minimum or 0
        };
        
        await api.put(`/parts/${part.part_id}`, updateData);
        console.log(`Updated part ${part.name} to low stock (${updateData.quantity})`);
      } catch (error) {
        console.error(`Error updating part quantity:`, error.response?.data || error.message);
      }
    }
  }
}

// Main function to run everything
async function populateTestData() {
  try {
    const vendorIds = await addVendors();
    if (vendorIds.length === 0) {
      console.error('No vendors were created. Aborting parts creation.');
      return;
    }
    
    await addParts(vendorIds);
    await createLowStockScenario();
    
    console.log('Test data population complete!');
  } catch (error) {
    console.error('Error populating test data:', error);
  }
}

// Run the script
populateTestData();
