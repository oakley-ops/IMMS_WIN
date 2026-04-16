#!/usr/bin/env node
/**
 * Extract all parts from the database and export to Excel
 */

const { Pool } = require('pg');
const fs = require('fs');
const XLSX = require('xlsx');
require('dotenv').config();

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

async function extractPartsFromDatabase() {
  console.log('🔍 Extracting all parts from database...');
  
  try {
    // Query to get all parts with location information
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
    
    console.log('📊 Running database query...');
    const result = await pool.query(query);
    
    console.log(`✅ Found ${result.rows.length} parts in database`);
    
    if (result.rows.length === 0) {
      console.log('⚠️  No parts found in database');
      return [];
    }
    
    // Show sample of data
    console.log('\n📋 Sample parts data:');
    result.rows.slice(0, 5).forEach((part, index) => {
      console.log(`  ${index + 1}. ID: ${part.part_id}, Name: ${part.name}, Qty: ${part.quantity}, Location: ${part.location_name}`);
    });
    
    // Export to Excel
    console.log('\n📁 Exporting to Excel...');
    
    // Clean data for Excel export
    const excelData = result.rows.map(part => ({
      'Part ID': part.part_id,
      'Name': part.name || '',
      'Description': part.description || '',
      'Manufacturer Part Number': part.manufacturer_part_number || '',
      'Internal Part Number': part.internal_part_number || '',
      'Quantity': part.quantity || 0,
      'Minimum Quantity': part.minimum_quantity || 0,
      'Supplier': part.supplier || '',
      'Unit Cost': part.unit_cost || 0,
      'Location': part.location_name || '',
      'Location Description': part.location_description || '',
      'Stock Status': part.stock_status || '',
      'Notes': part.notes || '',
      'Created At': part.created_at ? new Date(part.created_at).toISOString().split('T')[0] : '',
      'Updated At': part.updated_at ? new Date(part.updated_at).toISOString().split('T')[0] : ''
    }));
    
    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Auto-size columns
    const colWidths = [];
    const headers = Object.keys(excelData[0] || {});
    headers.forEach((header, index) => {
      const maxLength = Math.max(
        header.length,
        ...excelData.map(row => String(row[header] || '').length)
      );
      colWidths[index] = { width: Math.min(Math.max(maxLength + 2, 10), 50) };
    });
    worksheet['!cols'] = colWidths;
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Database Parts');
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `Database_Parts_Export_${timestamp}.xlsx`;
    
    // Write file
    XLSX.writeFile(workbook, filename);
    
    console.log(`✅ Parts exported to: ${filename}`);
    
    // Show summary statistics
    console.log('\n📈 Database Parts Summary:');
    console.log(`   Total Parts: ${result.rows.length}`);
    
    const stockSummary = result.rows.reduce((acc, part) => {
      acc[part.stock_status] = (acc[part.stock_status] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(stockSummary).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} parts`);
    });
    
    const locationSummary = result.rows.reduce((acc, part) => {
      const location = part.location_name || 'Unknown';
      acc[location] = (acc[location] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\n📍 Parts by Location:');
    Object.entries(locationSummary).forEach(([location, count]) => {
      console.log(`   ${location}: ${count} parts`);
    });
    
    return {
      data: result.rows,
      filename: filename,
      summary: {
        total: result.rows.length,
        stockStatus: stockSummary,
        locations: locationSummary
      }
    };
    
  } catch (error) {
    console.error('❌ Error extracting parts from database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the extraction if this script is called directly
if (require.main === module) {
  extractPartsFromDatabase()
    .then((result) => {
      console.log('\n🎯 Database parts extraction completed successfully!');
      console.log(`📁 Excel file: ${result.filename}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Failed to extract database parts:', error);
      process.exit(1);
    });
}

module.exports = { extractPartsFromDatabase };
