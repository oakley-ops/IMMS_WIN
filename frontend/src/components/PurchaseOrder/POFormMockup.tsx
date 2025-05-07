import React, { useState } from 'react';
import { generatePurchaseOrderPDF } from '../../utils/pdfTemplates';

interface Supplier {
  name: string;
  contactName: string;
  address: string;
  email: string;
  phone: string;
}

interface LineItem {
  name: string;
  partNumber: string;
  quantity: number;
  price: number;
}

interface PurchaseOrder {
  poNumber: string;
  requestedBy: string;
  approvedBy: string;
  createdAt: string;
  urgent: boolean;
  nextDayShipping: boolean;
  supplier: Supplier;
  items: LineItem[];
  shipping_cost: number;
  tax_amount: number;
}

const POFormMockup: React.FC = () => {
  // State for the purchase order
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder>({
    poNumber: 'TEST-' + Math.floor(1000 + Math.random() * 9000),
    requestedBy: '',
    approvedBy: '',
    createdAt: new Date().toISOString(),
    urgent: false,
    nextDayShipping: false,
    supplier: {
      name: '',
      contactName: '',
      address: '',
      email: '',
      phone: ''
    },
    items: [],
    shipping_cost: 0,
    tax_amount: 0
  });

  // For temporary item being added
  const [currentItem, setCurrentItem] = useState<LineItem>({
    name: '',
    partNumber: '',
    quantity: 1,
    price: 0
  });

  // Load sample data function
  const loadSampleData = () => {
    const samplePurchaseOrder = {
      poNumber: 'PO-2023-' + Math.floor(1000 + Math.random() * 9000),
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
    
    setPurchaseOrder(samplePurchaseOrder);
  };

  // Handle form changes for basic fields
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    if (name.includes('.')) {
      // Handle nested properties (e.g., supplier.name)
      const [parent, child] = name.split('.');
      setPurchaseOrder({
        ...purchaseOrder,
        [parent]: {
          ...purchaseOrder[parent as keyof PurchaseOrder] as Record<string, any>,
          [child]: type === 'checkbox' ? checked : value
        }
      });
    } else {
      // Handle top-level properties
      setPurchaseOrder({
        ...purchaseOrder,
        [name]: type === 'checkbox' ? checked : value
      });
    }
  };

  // Handle changes to the current item form
  const handleItemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numericValue = ['quantity', 'price'].includes(name) 
      ? parseFloat(value) || 0 
      : value;
    
    setCurrentItem({
      ...currentItem,
      [name]: numericValue
    } as LineItem);
  };

  // Add item to PO
  const addItem = () => {
    if (!currentItem.name || !currentItem.partNumber) {
      alert('Part name and part number are required.');
      return;
    }
    
    setPurchaseOrder({
      ...purchaseOrder,
      items: [...purchaseOrder.items, {...currentItem}]
    });
    
    // Reset current item form
    setCurrentItem({
      name: '',
      partNumber: '',
      quantity: 1,
      price: 0
    });
  };

  // Remove item from PO
  const removeItem = (index: number) => {
    const updatedItems = [...purchaseOrder.items];
    updatedItems.splice(index, 1);
    setPurchaseOrder({...purchaseOrder, items: updatedItems});
  };

  // Calculate totals
  const calculateSubtotal = () => {
    return purchaseOrder.items.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const shippingCost = parseFloat(purchaseOrder.shipping_cost.toString()) || 0;
    const taxAmount = parseFloat(purchaseOrder.tax_amount.toString()) || 0;
    return subtotal + shippingCost + taxAmount;
  };

  // Preview PDF function
  const previewPO = async () => {
    try {
      // Add validation here
      if (!purchaseOrder.poNumber || !purchaseOrder.supplier.name) {
        alert('PO Number and Supplier Name are required.');
        return;
      }
      
      if (purchaseOrder.items.length === 0) {
        alert('At least one item is required.');
        return;
      }
      
      console.log('Generating PDF for:', purchaseOrder);
      await generatePurchaseOrderPDF(purchaseOrder);
    } catch (error: any) {
      console.error("Error generating PDF preview:", error);
      alert(`Error generating PDF: ${error.message}`);
    }
  };

  // Mock email function - won't actually send email in this mockup
  const mockEmailPO = () => {
    // Add validation here
    if (!purchaseOrder.poNumber || !purchaseOrder.supplier.name || !purchaseOrder.supplier.email) {
      alert('PO Number, Supplier Name, and Supplier Email are required for email.');
      return;
    }
    
    if (purchaseOrder.items.length === 0) {
      alert('At least one item is required.');
      return;
    }
    
    alert(`In a real implementation, an email would be sent to ${purchaseOrder.supplier.email} with the PO #${purchaseOrder.poNumber} as a PDF attachment.`);
  };

  return (
    <div className="container mt-4">
      <h2>Create Purchase Order (Mockup)</h2>
      <p className="text-muted">This is a test form to verify PDF generation. Data is not saved to the database.</p>
      
      <div className="d-flex justify-content-end mb-3">
        <button 
          className="btn btn-secondary"
          onClick={loadSampleData}
        >
          Load Sample Data
        </button>
      </div>
      
      <div className="card mb-4">
        <div className="card-header bg-primary text-white">
          <h4 className="mb-0">PO Information</h4>
        </div>
        <div className="card-body">
          <div className="row">
            <div className="col-md-4 mb-3">
              <label htmlFor="poNumber">PO Number:</label>
              <input 
                type="text"
                className="form-control" 
                id="poNumber" 
                name="poNumber"
                value={purchaseOrder.poNumber} 
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-md-4 mb-3">
              <label htmlFor="requestedBy">Requested By:</label>
              <input 
                type="text"
                className="form-control" 
                id="requestedBy" 
                name="requestedBy"
                value={purchaseOrder.requestedBy} 
                onChange={handleChange}
              />
            </div>
            <div className="col-md-4 mb-3">
              <label htmlFor="approvedBy">Approved By:</label>
              <input 
                type="text"
                className="form-control" 
                id="approvedBy" 
                name="approvedBy"
                value={purchaseOrder.approvedBy} 
                onChange={handleChange}
              />
            </div>
          </div>
          <div className="row">
            <div className="col-md-6 mb-3">
              <div className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="urgent"
                  name="urgent"
                  checked={purchaseOrder.urgent}
                  onChange={handleChange}
                />
                <label className="form-check-label" htmlFor="urgent">
                  Urgent Order
                </label>
              </div>
            </div>
            <div className="col-md-6 mb-3">
              <div className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="nextDayShipping"
                  name="nextDayShipping"
                  checked={purchaseOrder.nextDayShipping}
                  onChange={handleChange}
                />
                <label className="form-check-label" htmlFor="nextDayShipping">
                  Next Day Shipping
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="card mb-4">
        <div className="card-header bg-primary text-white">
          <h4 className="mb-0">Supplier Information</h4>
        </div>
        <div className="card-body">
          <div className="row">
            <div className="col-md-6 mb-3">
              <label htmlFor="supplier.name">Supplier Name:</label>
              <input 
                type="text"
                className="form-control" 
                id="supplier.name" 
                name="supplier.name"
                value={purchaseOrder.supplier.name} 
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-md-6 mb-3">
              <label htmlFor="supplier.contactName">Contact Person:</label>
              <input 
                type="text"
                className="form-control" 
                id="supplier.contactName" 
                name="supplier.contactName"
                value={purchaseOrder.supplier.contactName} 
                onChange={handleChange}
              />
            </div>
          </div>
          <div className="row">
            <div className="col-md-12 mb-3">
              <label htmlFor="supplier.address">Address:</label>
              <input 
                type="text"
                className="form-control" 
                id="supplier.address" 
                name="supplier.address"
                value={purchaseOrder.supplier.address} 
                onChange={handleChange}
              />
            </div>
          </div>
          <div className="row">
            <div className="col-md-6 mb-3">
              <label htmlFor="supplier.email">Email:</label>
              <input 
                type="email"
                className="form-control" 
                id="supplier.email" 
                name="supplier.email"
                value={purchaseOrder.supplier.email} 
                onChange={handleChange}
              />
            </div>
            <div className="col-md-6 mb-3">
              <label htmlFor="supplier.phone">Phone:</label>
              <input 
                type="text"
                className="form-control" 
                id="supplier.phone" 
                name="supplier.phone"
                value={purchaseOrder.supplier.phone} 
                onChange={handleChange}
              />
            </div>
          </div>
        </div>
      </div>
      
      <div className="card mb-4">
        <div className="card-header bg-primary text-white">
          <h4 className="mb-0">Line Items</h4>
        </div>
        <div className="card-body">
          <table className="table table-bordered">
            <thead className="thead-light">
              <tr>
                <th>Part Name</th>
                <th>Part Number</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrder.items.map((item, index) => (
                <tr key={index}>
                  <td>{item.name}</td>
                  <td>{item.partNumber}</td>
                  <td>{item.quantity}</td>
                  <td>${item.price.toFixed(2)}</td>
                  <td>${(item.price * item.quantity).toFixed(2)}</td>
                  <td>
                    <button 
                      className="btn btn-sm btn-danger"
                      onClick={() => removeItem(index)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {purchaseOrder.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center">No items added</td>
                </tr>
              )}
              <tr>
                <td>
                  <input 
                    type="text"
                    className="form-control"
                    placeholder="Part Name"
                    name="name"
                    value={currentItem.name}
                    onChange={handleItemChange}
                    required
                  />
                </td>
                <td>
                  <input 
                    type="text"
                    className="form-control"
                    placeholder="Part #"
                    name="partNumber"
                    value={currentItem.partNumber}
                    onChange={handleItemChange}
                    required
                  />
                </td>
                <td>
                  <input 
                    type="number"
                    className="form-control"
                    placeholder="Qty"
                    name="quantity"
                    value={currentItem.quantity}
                    onChange={handleItemChange}
                    min="1"
                  />
                </td>
                <td>
                  <input 
                    type="number"
                    className="form-control"
                    placeholder="Price"
                    name="price"
                    value={currentItem.price}
                    onChange={handleItemChange}
                    min="0"
                    step="0.01"
                  />
                </td>
                <td>${(currentItem.price * currentItem.quantity).toFixed(2)}</td>
                <td>
                  <button 
                    className="btn btn-sm btn-success"
                    onClick={addItem}
                  >
                    Add Item
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="card mb-4">
        <div className="card-header bg-primary text-white">
          <h4 className="mb-0">Order Totals</h4>
        </div>
        <div className="card-body">
          <div className="row">
            <div className="col-md-6">
              <p>Items Subtotal: ${calculateSubtotal().toFixed(2)}</p>
            </div>
            <div className="col-md-6">
              <div className="form-group">
                <label htmlFor="shipping_cost">Shipping Cost:</label>
                <input 
                  type="number"
                  className="form-control"
                  id="shipping_cost"
                  name="shipping_cost"
                  value={purchaseOrder.shipping_cost}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-md-6">
              <p>Grand Total: ${calculateTotal().toFixed(2)}</p>
            </div>
            <div className="col-md-6">
              <div className="form-group">
                <label htmlFor="tax_amount">Tax Amount:</label>
                <input 
                  type="number"
                  className="form-control"
                  id="tax_amount"
                  name="tax_amount"
                  value={purchaseOrder.tax_amount}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="d-flex justify-content-end mb-5">
        <button 
          className="btn btn-primary me-2"
          onClick={previewPO}
        >
          Preview PDF
        </button>
        <button 
          className="btn btn-success"
          onClick={mockEmailPO}
        >
          Simulate Email PO
        </button>
      </div>
      
      <div className="alert alert-info">
        <h5>Mockup Testing Notes:</h5>
        <ul>
          <li>This is a mockup for testing PDF generation</li>
          <li>Data is not saved to any database</li>
          <li>Email functionality is simulated</li>
          <li>The PDF preview uses the actual PDF template from pdfTemplates.js</li>
          <li>Click "Load Sample Data" to quickly test with pre-filled information</li>
        </ul>
      </div>
    </div>
  );
};

export default POFormMockup; 