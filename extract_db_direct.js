#!/usr/bin/env node
/**
 * Direct database extraction script for parts
 */

const { Pool } = require('pg');
const XLSX = require('xlsx');
const path = require('path');

// Try to load environment variables from backend
try {
  const dotenv = require('dotenv');
  // Try loading from backend directory
  dotenv.config({ path: './backend/.env' });
  dotenv.config({ path: './.env' });
} catch (e) {
  console.log('📝 Dotenv not available, checking environment variables...');
}

// Database connection with fallback configurations
const dbConfigs = [
  // Production/Fly.io config
  process.env.DATABASE_URL,
  // Local development configs
  `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'password'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'imms_inventory'}`,
  // Default local config
  'postgresql://postgres:password@localhost:5432/imms_inventory',
  'postgresql://postgres@localhost:5432/imms_inventory'
];

async function connectToDatabase() {
  console.log('🔌 Attempting to connect to database...');
  
  for (let i = 0; i < dbConfigs.length; i++) {
    const config = dbConfigs[i];
    if (!config) continue;
    
    console.log(`📡 Trying connection ${i + 1}...`);
    
    try {
      const pool = new Pool({
        connectionString: config,
        ssl: config.includes('fly.io') || config.includes('amazonaws') ? {
          rejectUnauthorized: false
        } : false,
        connectionTimeoutMillis: 5000
      });
      
      // Test connection
      const client = await pool.connect();
      console.log('✅ Database connection successful!');
      client.release();
      return pool;
      
    } catch (error) {
      console.log(`❌ Connection ${i + 1} failed: ${error.message}`);
      continue;
    }
  }
  
  throw new Error('Could not connect to database with any configuration');
}

async function extractPartsData(pool) {
  console.log('📊 Extracting parts data from database...');
  
  const query = `
    SELECT 
      p.part_id,
      p.name,
      p.description,
      p.manufacturer_part_number,
      p.internal_part_number,
      p.quantity,
      p.minimum_quantity,
      p.supplier,
      p.unit_cost,
      p.notes,
      p.created_at,
      p.updated_at,
      COALESCE(pl.name, 'Unknown Location') as location_name,
      COALESCE(pl.description, '') as location_description,
      CASE 
        WHEN p.quantity = 0 THEN 'Out of Stock'
        WHEN p.quantity <= p.minimum_quantity THEN 'Low Stock'
        ELSE 'In Stock'
      END as stock_status
    FROM parts p
    LEFT JOIN part_locations pl ON p.location_id = pl.location_id
    ORDER BY p.part_id;
  `;
  
  try {
    const result = await pool.query(query);
    console.log(`✅ Successfully extracted ${result.rows.length} parts from database`);
    
    if (result.rows.length === 0) {
      console.log('⚠️  No parts found in database');
      
      // Try to check if tables exist
      const tableCheck = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('parts', 'part_locations')
      `);
      
      console.log('📋 Available tables:', tableCheck.rows.map(r => r.table_name));
      
      if (tableCheck.rows.length === 0) {
        console.log('❌ Parts tables not found. Database may need initialization.');
      }
    }
    
    return result.rows;
    
  } catch (error) {
    console.error('❌ Error executing query:', error.message);
    
    // Try simplified query without joins
    console.log('🔄 Trying simplified query without location join...');
    
    const simpleQuery = `
      SELECT 
        part_id,
        name,
        description,
        manufacturer_part_number,
        internal_part_number,
        quantity,
        minimum_quantity,
        supplier,
        unit_cost,
        notes,
        created_at,
        updated_at,
        'Unknown' as location_name,
        '' as location_description,
        CASE 
          WHEN quantity = 0 THEN 'Out of Stock'
          WHEN quantity <= minimum_quantity THEN 'Low Stock'
          ELSE 'In Stock'
        END as stock_status
      FROM parts
      ORDER BY part_id;
    `;
    
    try {
      const simpleResult = await pool.query(simpleQuery);
      console.log(`✅ Simplified query successful: ${simpleResult.rows.length} parts found`);
      return simpleResult.rows;
    } catch (simpleError) {
      console.error('❌ Simplified query also failed:', simpleError.message);
      throw simpleError;
    }
  }
}

async function exportToExcel(partsData) {
  console.log('📁 Exporting data to Excel...');
  
  // Transform data for Excel export
  const excelData = partsData.map(part => ({
    'Part ID': part.part_id,
    'Name': part.name || '',
    'Description': part.description || '',
    'Manufacturer Part Number': part.manufacturer_part_number || '',
    'Internal Part Number': part.internal_part_number || '',
    'Quantity': part.quantity || 0,
    'Minimum Quantity': part.minimum_quantity || 0,
    'Supplier': part.supplier || '',
    'Unit Cost': part.unit_cost || 0,
    'Location': part.location_name || 'Unknown',
    'Location Description': part.location_description || '',
    'Stock Status': part.stock_status || '',
    'Notes': part.notes || '',
    'Created At': part.created_at ? new Date(part.created_at).toISOString().split('T')[0] : '',
    'Updated At': part.updated_at ? new Date(part.updated_at).toISOString().split('T')[0] : ''
  }));
  
  // Create workbook
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(excelData);
  
  // Auto-size columns
  const colWidths = [];
  if (excelData.length > 0) {
    const headers = Object.keys(excelData[0]);
    headers.forEach((header, index) => {
      const maxLength = Math.max(
        header.length,
        ...excelData.map(row => String(row[header] || '').length)
      );
      colWidths[index] = { width: Math.min(Math.max(maxLength + 2, 10), 50) };
    });
    worksheet['!cols'] = colWidths;
  }
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Database Parts');
  
  // Generate filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `Database_Parts_Export_${timestamp}.xlsx`;
  
  // Write file
  XLSX.writeFile(workbook, filename);
  
  console.log(`✅ Parts exported to: ${filename}`);
  
  return filename;
}

async function showSummary(partsData) {
  console.log('\n📈 DATABASE PARTS SUMMARY:');
  console.log(`   Total Parts: ${partsData.length}`);
  
  if (partsData.length === 0) return;
  
  // Stock status summary
  const stockSummary = partsData.reduce((acc, part) => {
    const status = part.stock_status || 'Unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  
  console.log('\n📊 Stock Status:');
  Object.entries(stockSummary).forEach(([status, count]) => {
    console.log(`   ${status}: ${count} parts`);
  });
  
  // Location summary
  const locationSummary = partsData.reduce((acc, part) => {
    const location = part.location_name || 'Unknown';
    acc[location] = (acc[location] || 0) + 1;
    return acc;
  }, {});
  
  console.log('\n📍 Parts by Location:');
  Object.entries(locationSummary).slice(0, 10).forEach(([location, count]) => {
    console.log(`   ${location}: ${count} parts`);
  });
  
  // Show sample parts
  console.log('\n📋 Sample Parts:');
  partsData.slice(0, 5).forEach((part, index) => {
    console.log(`   ${index + 1}. ${part.name || 'Unnamed'} (ID: ${part.part_id}) - Qty: ${part.quantity}`);
  });
}

async function main() {
  console.log('🗄️ DATABASE PARTS EXTRACTION');
  console.log('=' * 50);
  
  let pool = null;
  
  try {
    // Connect to database
    pool = await connectToDatabase();
    
    // Extract parts data
    const partsData = await extractPartsData(pool);
    
    // Export to Excel
    const filename = await exportToExcel(partsData);
    
    // Show summary
    await showSummary(partsData);
    
    console.log(`\n🎯 Database extraction completed successfully!`);
    console.log(`📁 Excel file: ${filename}`);
    console.log(`🔄 Ready for matching with ZZ110 inventory!`);
    
    return filename;
    
  } catch (error) {
    console.error('💥 Database extraction failed:', error.message);
    console.log('\n🔧 Troubleshooting steps:');
    console.log('   1. Check if the database server is running');
    console.log('   2. Verify database connection settings');
    console.log('   3. Ensure the parts table exists and has data');
    throw error;
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Run if called directly
if (require.main === module) {
  main()
    .then((filename) => {
      console.log(`\n✅ Success! Database parts exported to: ${filename}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Extraction failed:', error.message);
      process.exit(1);
    });
}

module.exports = { main };
