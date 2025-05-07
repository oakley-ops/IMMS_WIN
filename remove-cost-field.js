const fs = require('fs');
const path = 'frontend/src/components/PartsList.tsx';

try {
  let content = fs.readFileSync(path, 'utf8');
  
  // Look for the "Cost ($)" field
  const costLabelPattern = /<label className="form-label">Cost \(\$\)<\/label>/;
  const match = content.match(costLabelPattern);
  
  if (match) {
    // Find the containing div
    const labelIndex = match.index;
    const divStartIndex = content.lastIndexOf('<div className="form-group">', labelIndex);
    const divEndIndex = content.indexOf('</div>', labelIndex) + 6;
    
    // Remove the entire div containing the Cost ($) field
    const newContent = content.substring(0, divStartIndex) + content.substring(divEndIndex);
    
    // Write the modified content back to the file
    fs.writeFileSync(path, newContent);
    console.log('✅ Successfully removed the Cost ($) field');
  } else {
    console.log('❌ Could not find the Cost ($) field');
  }
} catch (error) {
  console.error('Error processing file:', error);
} 