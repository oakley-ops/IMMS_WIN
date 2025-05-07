// Test script to debug email processing
require('dotenv').config();
const emailTrackingService = require('./services/emailTrackingService');

async function testEmailProcessing() {
  console.log('Testing email processing for "on hold" status');
  
  // Simulating an email with "On hold" content exactly as seen in the real email
  const testEmail = {
    subject: 'RE: Purchase Order #202503-0001 - [PO-APPROVAL-010618188acf4850aef9e0c65f4bfb36]',
    body: 'On hold\n\nIsaac Rodriguez\nSr. Technical Engineer\nCard Production Services\nFiserv',
    from: 'isaac.rodriguez@fiserv.com'
  };
  
  // Simulate email processing logic from monitorEmails.js
  console.log('Processing simulated email:', testEmail);
  
  // Extract tracking code
  const cleanSubject = testEmail.subject.replace(/^RE:\s*/i, '');
  const trackingCodeMatch = cleanSubject.match(/\[PO-APPROVAL-([^\]]+)\]/);
  
  if (!trackingCodeMatch) {
    console.log('No tracking code found in subject');
    return;
  }
  
  const trackingCode = trackingCodeMatch[1];
  console.log('Extracted tracking code:', trackingCode);
  
  // Check for hold keywords
  const bodyLower = testEmail.body.toLowerCase();
  
  // CRITICAL: Add specific check for the exact "On hold" text at start of email
  const bodyTextLines = testEmail.body.split('\n');
  const firstLine = bodyTextLines[0]?.trim().toLowerCase() || '';
  const startsWithOnHold = firstLine === 'on hold';
  
  console.log('CRITICAL DEBUG - First line of email:', firstLine);
  console.log('CRITICAL DEBUG - Starts with "on hold":', startsWithOnHold);
  
  // Define hold keywords
  const holdKeywords = ['hold', 'on hold', 'need changes', 'changes needed', 'need more info',
                       'more information', 'revise', 'revision needed', 'update needed', 'clarify',
                       'clarification needed', 'modify', 'modification needed', 'incomplete',
                       'not ready', 'wait', 'pending changes', 'fix', 'needs fixing', 'issue',
                       'problem', 'concern', 'redo', 'adjust', 'edit', 'correction'];
  
  // Check for hold status in body
  const hasHoldInBody = holdKeywords.some(keyword => bodyLower.includes(keyword));
  
  // Special check for explicit hold
  const hasExplicitHold = /\bneed\b.*\b(change|update|revision|clarif|info)\b/i.test(bodyLower) || 
                        /\bplease\b.*\b(change|update|revise|clarify)\b/i.test(bodyLower) ||
                        /\bnot\b.*\b(ready|complete|sufficient)\b/i.test(bodyLower) ||
                        /\bon\s+hold\b/i.test(bodyLower) || /\bhold\b/i.test(bodyLower) ||
                        startsWithOnHold;
  
  console.log('Body contains hold keywords:', hasHoldInBody);
  console.log('Hold keywords found:', holdKeywords.filter(keyword => bodyLower.includes(keyword)));
  console.log('Body contains explicit hold indications:', hasExplicitHold);
  console.log('Body contains "on hold" at start:', startsWithOnHold);
  
  // Determine status
  let emailStatus = 'pending';
  
  if (hasHoldInBody || hasExplicitHold || startsWithOnHold) {
    console.log('Hold status detected - Setting status to "on_hold"');
    emailStatus = 'on_hold';
  } else {
    // For demo purposes only - normally we'd check for approval here
    console.log('No hold status detected');
  }
  
  console.log('Final decision:', emailStatus.toUpperCase());
  
  // Simulate call to processEmailApproval
  const isApproved = emailStatus === 'approved';
  const comments = emailStatus === 'on_hold' ? 
    'Changes or more information needed: ' + 
    holdKeywords.filter(keyword => bodyLower.includes(keyword)).join(', ') : 
    '';
  
  console.log('Would call emailTrackingService.processEmailApproval with:');
  console.log('- trackingCode:', trackingCode);
  console.log('- approvalEmail:', testEmail.from);
  console.log('- isApproved:', isApproved);
  console.log('- comments:', comments);
  
  // If we have a tracking code for a real PO in the system, test with it
  try {
    console.log('Attempting to process email approval with real service call...');
    const result = await emailTrackingService.processEmailApproval(
      trackingCode, 
      testEmail.from, 
      isApproved, 
      comments
    );
    console.log('Email approval processed successfully:', result);
  } catch (error) {
    console.error('Error processing email approval:', error.message);
  }
}

testEmailProcessing().catch(console.error); 