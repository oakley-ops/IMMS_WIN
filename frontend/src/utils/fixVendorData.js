import axios from 'axios';

// Utility function to update vendor IDs for parts that need reordering
const updateVendorForParts = async () => {
  try {
    // Get the auth token
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    };

    // 1. Get all vendors
    const vendorsResponse = await axios.get('http://localhost:4000/api/v1/vendors', { headers });
    const vendors = vendorsResponse.data;
    
    if (!vendors || vendors.length === 0) {
      console.error('No vendors found. Please create vendors first.');
      return { success: false, message: 'No vendors found. Please create vendors first.' };
    }
    
    // 2. Get all parts that need reordering
    const partsResponse = await axios.get('http://localhost:4000/api/v1/parts/low-stock', { headers });
    const parts = partsResponse.data;
    
    if (!parts || parts.length === 0) {
      console.error('No parts found that need reordering.');
      return { success: false, message: 'No parts found that need reordering.' };
    }
    
    console.log(`Found ${parts.length} parts that need reordering`);
    
    // 3. Update each part with a vendor if it doesn't have one
    const updatedParts = [];
    for (const part of parts) {
      if (!part.vendor_id) {
        // Assign a random vendor from the list
        const randomVendor = vendors[Math.floor(Math.random() * vendors.length)];
        
        try {
          // When updating a part, we need to preserve all the required fields
          const updateData = {
            vendor_id: randomVendor.vendor_id,
            // Preserve existing values
            name: part.name,
            description: part.description || '',
            quantity: part.quantity,
            minimum_quantity: part.minimum_quantity,
            unit_cost: part.unit_cost || 0,
            fiserv_part_number: part.fiserv_part_number || '',
            manufacturer_part_number: part.manufacturer_part_number || '',
            unit: part.unit || '',
            location: part.location || ''
          };
          
          // Update the part
          const updateResponse = await axios.put(`http://localhost:4000/api/v1/parts/${part.part_id}`, updateData, { headers });
          
          if (updateResponse.status === 200) {
            console.log(`Updated part ${part.name} with vendor ${randomVendor.name}`);
            updatedParts.push(updateResponse.data);
          }
        } catch (error) {
          console.error(`Error updating part ${part.part_id}:`, error);
        }
      }
    }
    
    return { 
      success: true, 
      message: `Updated ${updatedParts.length} parts with vendor information.`,
      updatedParts 
    };
    
  } catch (error) {
    console.error('Error in updateVendorForParts:', error);
    return { 
      success: false, 
      message: error.response?.data?.message || error.message || 'Failed to update vendor information' 
    };
  }
};

export default updateVendorForParts;
