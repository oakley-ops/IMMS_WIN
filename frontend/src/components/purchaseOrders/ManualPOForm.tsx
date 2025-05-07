import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { generatePurchaseOrderPDF } from '../../utils/pdfTemplates';
import { suppliersApi, purchaseOrdersApi } from '../../services/api';
import '../../styles/Dialog.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import SaveIcon from '@mui/icons-material/Save';

interface Supplier {
  supplier_id: number;
  name: string;
  contact_name: string;
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
  supplier: { supplier_id: number };
  items: LineItem[];
  shipping_cost: number;
  tax_amount: number;
  notes: string;
  recipientEmail: string;
}

const ManualPOForm: React.FC = () => {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' | 'info' | '' }>({
    text: '',
    type: ''
  });

  // State for searching suppliers
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [supplierResults, setSupplierResults] = useState<Supplier[]>([]);
  const [searchingSuppliers, setSearchingSuppliers] = useState(false);

  // State for the purchase order
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder>({
    poNumber: 'Auto-generated',
    requestedBy: '',
    approvedBy: '',
    createdAt: new Date().toISOString(),
    urgent: false,
    nextDayShipping: false,
    supplier: { supplier_id: 0 },
    items: [],
    shipping_cost: 0,
    tax_amount: 0,
    notes: '',
    recipientEmail: ''
  });

  // For temporary item being added
  const [currentItem, setCurrentItem] = useState<LineItem>({
    name: '',
    partNumber: '',
    quantity: 1,
    price: 0
  });

  // Fetch suppliers on component mount
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        setLoading(true);
        const response = await suppliersApi.getAll();
        setSuppliers(response.data);
      } catch (error) {
        console.error('Error fetching suppliers:', error);
        setMessage({
          text: 'Failed to load suppliers. Please try refreshing the page.',
          type: 'error'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSuppliers();
  }, []);

  // Handle form field changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    // Handle checkbox fields
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setPurchaseOrder({
        ...purchaseOrder,
        [name]: checked
      });
      return;
    }
    
    // Handle nested supplier fields
    if (name.startsWith('supplier.')) {
      const field = name.split('.')[1];
      setPurchaseOrder({
        ...purchaseOrder,
        supplier: {
          ...purchaseOrder.supplier,
          [field]: value
        }
      });
      return;
    }
    
    // Handle numeric fields
    if (name === 'shipping_cost' || name === 'tax_amount') {
      setPurchaseOrder({
        ...purchaseOrder,
        [name]: parseFloat(value) || 0
      });
      return;
    }
    
    // Handle all other fields
    setPurchaseOrder({
      ...purchaseOrder,
      [name]: value
    });
  };

  // Handle supplier selection
  const handleSupplierChange = (supplier: Supplier) => {
    setPurchaseOrder({
      ...purchaseOrder,
      supplier: { supplier_id: supplier.supplier_id }
    });
    
    // If supplier has email, auto-fill the recipient email
    if (supplier.email) {
      setPurchaseOrder(prev => ({
        ...prev,
        recipientEmail: supplier.email
      }));
    }
    
    setSupplierSearchTerm('');
    setSupplierResults([]);
  };

  // Handle item form field changes
  const handleItemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    
    // Handle numeric fields
    if (type === 'number') {
      setCurrentItem({
        ...currentItem,
        [name]: parseFloat(value) || 0
      });
      return;
    }
    
    setCurrentItem({
      ...currentItem,
      [name]: value
    });
  };

  // Search suppliers
  const searchSuppliers = (term: string) => {
    if (!term.trim()) {
      setSupplierResults([]);
      return;
    }
    
    setSearchingSuppliers(true);
    
    const searchTerm = term.toLowerCase();
    const filteredSuppliers = suppliers.filter(supplier => 
      supplier.name.toLowerCase().includes(searchTerm) ||
      supplier.contact_name.toLowerCase().includes(searchTerm) ||
      supplier.email.toLowerCase().includes(searchTerm)
    );
    
    setSupplierResults(filteredSuppliers);
    setSearchingSuppliers(false);
  };

  // Handle supplier search input change
  const handleSupplierSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSupplierSearchTerm(term);
    searchSuppliers(term);
  };

  // Add item to PO
  const addItem = () => {
    // Validate the item has minimum required fields
    if (!currentItem.name) {
      setMessage({
        text: 'Please enter an item name.',
        type: 'warning'
      });
      return;
    }
    
    if (!currentItem.partNumber) {
      setMessage({
        text: 'Please enter a part number.',
        type: 'warning'
      });
      return;
    }
    
    if (!currentItem.quantity || currentItem.quantity <= 0) {
      setMessage({
        text: 'Please enter a valid quantity.',
        type: 'warning'
      });
      return;
    }
    
    if (!currentItem.price || currentItem.price <= 0) {
      setMessage({
        text: 'Please enter a valid price.',
        type: 'warning'
      });
      return;
    }
    
    // Add the item to the PO
    setPurchaseOrder({
      ...purchaseOrder,
      items: [
        ...purchaseOrder.items,
        { ...currentItem }
      ]
    });
    
    // Reset the current item form
    setCurrentItem({
      name: '',
      partNumber: '',
      quantity: 1,
      price: 0
    });
    
    setMessage({
      text: 'Item added successfully.',
      type: 'success'
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

  // Preview PO as PDF
  const previewPO = async () => {
    // Validate required fields
    if (!purchaseOrder.supplier.supplier_id) {
      setMessage({
        text: 'Please select a supplier.',
        type: 'warning'
      });
      return;
    }
    
    if (purchaseOrder.items.length === 0) {
      setMessage({
        text: 'At least one item is required.',
        type: 'warning'
      });
      return;
    }
    
    try {
      // Find the selected supplier's details
      const selectedSupplier = suppliers.find(s => s.supplier_id === purchaseOrder.supplier.supplier_id);
      
      if (!selectedSupplier) {
        setMessage({
          text: 'Invalid supplier selected. Please select a valid supplier.',
          type: 'error'
        });
        return;
      }
      
      // Generate PDF
      const pdfBlob = await generatePurchaseOrderPDF({
        ...purchaseOrder,
        supplier: selectedSupplier
      });
      
      // Check if pdfBlob is a valid blob
      if (pdfBlob && pdfBlob instanceof Blob) {
        // Open PDF in a new window
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
      } else {
        throw new Error('Failed to generate PDF');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      setMessage({
        text: 'Failed to generate PDF preview.',
        type: 'error'
      });
    }
  };

  // Send PO via email
  const sendPOEmail = async (poId: number, poNumber: string) => {
    if (!purchaseOrder.recipientEmail) {
      setMessage({
        text: 'Please enter a recipient email address.',
        type: 'warning'
      });
      return false;
    }
    
    try {
      // Generate PDF
      const selectedSupplier = suppliers.find(s => s.supplier_id === purchaseOrder.supplier.supplier_id);
      const pdfBlob = await generatePurchaseOrderPDF({
        ...purchaseOrder,
        poNumber,
        supplier: selectedSupplier
      });
      
      // Check if pdfBlob is a valid blob
      if (!pdfBlob || !(pdfBlob instanceof Blob)) {
        throw new Error('Failed to generate PDF');
      }
      
      // Convert blob to base64
      const reader = new FileReader();
      return new Promise<boolean>((resolve) => {
        reader.onloadend = async () => {
          const base64data = reader.result?.toString().split(',')[1];
          
          try {
            await purchaseOrdersApi.sendPOEmail({
              recipient: purchaseOrder.recipientEmail,
              poNumber,
              poId,
              pdfBase64: base64data || ''
            });
            
            setMessage({
              text: 'Purchase order email sent successfully!',
              type: 'success'
            });
            resolve(true);
          } catch (error) {
            console.error('Error sending email:', error);
            setMessage({
              text: 'Failed to send email. Please try again.',
              type: 'error'
            });
            resolve(false);
          }
        };
        reader.readAsDataURL(pdfBlob);
      });
    } catch (error) {
      console.error('Error generating PDF for email:', error);
      setMessage({
        text: 'Failed to generate PDF for email.',
        type: 'error'
      });
      return false;
    }
  };

  // Save PO
  const savePO = async () => {
    try {
      // Validate required fields
      if (!purchaseOrder.supplier.supplier_id) {
        setMessage({
          text: 'Please select a supplier.',
          type: 'warning'
        });
        return;
      }
      
      if (purchaseOrder.items.length === 0) {
        setMessage({
          text: 'At least one item is required.',
          type: 'warning'
        });
        return;
      }
      
      setSubmitting(true);
      
      // Make sure supplier_id is a valid number
      const supplier_id = parseInt(String(purchaseOrder.supplier.supplier_id));
      
      if (isNaN(supplier_id) || supplier_id <= 0) {
        setMessage({
          text: 'Invalid supplier selected. Please select a valid supplier.',
          type: 'error'
        });
        return;
      }
      
      // Prepare the data for the backend (note: special fields will be encoded in the notes)
      const poData = {
        supplier_id,
        notes: purchaseOrder.notes || '',
        is_urgent: purchaseOrder.urgent || false,
        next_day_air: purchaseOrder.nextDayShipping || false,
        shipping_cost: parseFloat(purchaseOrder.shipping_cost?.toString() || '0') || 0,
        tax_amount: parseFloat(purchaseOrder.tax_amount?.toString() || '0') || 0,
        requested_by: purchaseOrder.requestedBy || '',
        approved_by: purchaseOrder.approvedBy || '',
        items: [] // Add empty items array to satisfy validation
      };
      
      console.log('Creating blank PO with data:', poData);
      
      // Create a blank PO first
      try {
        const blankPoResponse = await purchaseOrdersApi.createBlankPO(poData);
        console.log('Blank PO Response:', blankPoResponse);
        
        const poId = blankPoResponse.data.po_id;
        const poNumber = blankPoResponse.data.po_number;
        
        // Add each item to the PO
        for (const item of purchaseOrder.items) {
          const itemData = {
            part_id: null, // No part_id for custom items
            custom_part: true,
            part_name: item.name, 
            part_number: item.partNumber,
            quantity: item.quantity,
            unit_price: item.price
          };
          console.log('Adding item to PO:', itemData);
          await purchaseOrdersApi.addItemToPO(poId, itemData);
        }
        
        setMessage({
          text: 'Purchase order created successfully!',
          type: 'success'
        });
        
        // If a recipient email is entered, offer to send email
        if (purchaseOrder.recipientEmail) {
          // Update PO number for PDF generation
          setPurchaseOrder({
            ...purchaseOrder,
            poNumber
          });
          
          // Send email if confirmed
          if (window.confirm(`Would you like to email this PO to ${purchaseOrder.recipientEmail}?`)) {
            await sendPOEmail(poId, poNumber);
          }
        }
        
        // Redirect after delay
        setTimeout(() => {
          navigate(`/purchase-orders/detail/${poId}`);
        }, 2000);
      } catch (error: any) {
        console.error('Error creating PO:', error);
        setMessage({
          text: error.response?.data?.message || 'Failed to create purchase order.',
          type: 'error'
        });
      } finally {
        setSubmitting(false);
      }
    } catch (error: any) {
      console.error('Error in save process:', error);
      setMessage({
        text: 'An unexpected error occurred.',
        type: 'error'
      });
      setSubmitting(false);
    }
  };

  // Find supplier by ID
  const getSelectedSupplier = () => {
    return suppliers.find(s => s.supplier_id === purchaseOrder.supplier.supplier_id);
  };

  return (
    <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '1400px', margin: '2rem auto' }}>
      <div className="modal-content custom-dialog">
        {/* Header */}
        <div className="dialog-header">
          <h5 className="dialog-title" style={{ color: '#FF6200' }}>Create Manual Purchase Order</h5>
          <button
            type="button"
            className="btn-close btn-close-white"
            onClick={() => navigate('/purchase-orders')}
            aria-label="Close"
          ></button>
        </div>
        
        {/* Content */}
        <form onSubmit={(e) => { e.preventDefault(); savePO(); }}>
          <div className="dialog-content">
            {message.text && (
              <div className={`alert alert-${message.type}`} role="alert">
                {message.text}
              </div>
            )}
            
            <div className="mb-4">
              <h6 className="fw-bold mb-3">PO Information</h6>
              
              {/* Supplier Selection */}
              <div className="mb-3">
                <label className="form-label">Supplier</label>
                <div className="search-container">
                  <input
                    type="text"
                    className="form-control"
                    value={supplierSearchTerm}
                    onChange={handleSupplierSearchChange}
                    placeholder="Search for a supplier"
                    disabled={!!getSelectedSupplier()}
                  />
                  {searchingSuppliers && (
                    <div className="spinner-border spinner-border-sm text-primary position-absolute" 
                         style={{ right: '1rem', top: '0.75rem' }} 
                         role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  )}
                </div>
                
                {supplierResults.length > 0 && !getSelectedSupplier() && (
                  <div className="search-results">
                    {supplierResults.map((supplier) => (
                      <div
                        key={`supplier-${supplier.supplier_id}`}
                        className="search-item"
                        onClick={() => handleSupplierChange(supplier)}
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <div className="fw-bold">{supplier.name}</div>
                            <div className="info-text">
                              Contact: {supplier.contact_name} | 
                              Email: {supplier.email || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {getSelectedSupplier() && (
                  <div className="info-panel mt-3">
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <div className="fw-bold">{getSelectedSupplier()?.name}</div>
                        <div className="info-text">
                          Contact: {getSelectedSupplier()?.contact_name}<br />
                          Email: {getSelectedSupplier()?.email || 'N/A'}<br />
                          Phone: {getSelectedSupplier()?.phone || 'N/A'}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => {
                          setPurchaseOrder({
                            ...purchaseOrder,
                            supplier: { supplier_id: 0 },
                            recipientEmail: ''
                          });
                        }}
                      >
                        Change Supplier
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* PO Details */}
              <div className="d-flex gap-3 mb-3">
                <div className="flex-grow-1">
                  <label className="form-label">Requested By</label>
                  <input
                    type="text"
                    className="form-control"
                    name="requestedBy"
                    value={purchaseOrder.requestedBy}
                    onChange={handleChange}
                    placeholder="Enter name"
                  />
                </div>
                <div className="flex-grow-1">
                  <label className="form-label">Approved By</label>
                  <input
                    type="text"
                    className="form-control"
                    name="approvedBy"
                    value={purchaseOrder.approvedBy}
                    onChange={handleChange}
                    placeholder="Enter name"
                  />
                </div>
              </div>
              
              <div className="d-flex gap-3 mb-3">
                <div className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    name="urgent"
                    id="urgent"
                    checked={purchaseOrder.urgent}
                    onChange={(e) => {
                      setPurchaseOrder({
                        ...purchaseOrder,
                        urgent: e.target.checked
                      });
                    }}
                  />
                  <label className="form-check-label" htmlFor="urgent">Mark as Urgent</label>
                </div>
                <div className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    name="nextDayShipping"
                    id="nextDayShipping"
                    checked={purchaseOrder.nextDayShipping}
                    onChange={(e) => {
                      setPurchaseOrder({
                        ...purchaseOrder,
                        nextDayShipping: e.target.checked
                      });
                    }}
                  />
                  <label className="form-check-label" htmlFor="nextDayShipping">Next Day Air</label>
                </div>
              </div>
              
              {/* Email Section */}
              <div className="mb-3">
                <label className="form-label">Recipient Email (optional for sending PO)</label>
                <input
                  type="email"
                  className="form-control"
                  name="recipientEmail"
                  value={purchaseOrder.recipientEmail}
                  onChange={handleChange}
                  placeholder="Enter email address"
                />
              </div>
            </div>
            
            {/* Line Items Section */}
            <div className="mb-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bold mb-0">Line Items</h6>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={addItem}
                  disabled={!currentItem.name || !currentItem.partNumber || currentItem.quantity <= 0 || currentItem.price <= 0}
                >
                  <AddIcon fontSize="small" style={{ marginRight: '4px' }} />
                  Add Item
                </button>
              </div>
              
              {/* Current items table */}
              {purchaseOrder.items.length > 0 && (
                <div className="table-responsive mb-3">
                  <table className="table table-bordered">
                    <thead className="table-light">
                      <tr>
                        <th>Name</th>
                        <th>Part Number</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Total</th>
                        <th className="actions-column" style={{ width: '50px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchaseOrder.items.map((item, index) => (
                        <tr key={`item-${index}`}>
                          <td>{item.name}</td>
                          <td>{item.partNumber}</td>
                          <td>{item.quantity}</td>
                          <td>${item.price.toFixed(2)}</td>
                          <td>${(item.price * item.quantity).toFixed(2)}</td>
                          <td className="actions-column">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => removeItem(index)}
                            >
                              <DeleteIcon fontSize="small" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {/* Add new item form */}
              <div className="card mb-3">
                <div className="card-body">
                  <h6 className="card-title mb-3">Add New Item</h6>
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label">Item Name</label>
                      <input
                        type="text"
                        className="form-control"
                        name="name"
                        value={currentItem.name}
                        onChange={handleItemChange}
                        placeholder="Enter item name"
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Part Number</label>
                      <input
                        type="text"
                        className="form-control"
                        name="partNumber"
                        value={currentItem.partNumber}
                        onChange={handleItemChange}
                        placeholder="Enter part number"
                      />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label">Quantity</label>
                      <input
                        type="number"
                        className="form-control"
                        name="quantity"
                        value={currentItem.quantity}
                        onChange={handleItemChange}
                        min="1"
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Unit Price</label>
                      <input
                        type="number"
                        className="form-control"
                        name="price"
                        value={currentItem.price}
                        onChange={handleItemChange}
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Order Totals Section */}
            <div className="mb-4">
              <div className="row">
                <div className="col-md-6">
                  <h6 className="fw-bold mb-3">Notes</h6>
                  <textarea
                    className="form-control"
                    name="notes"
                    value={purchaseOrder.notes}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Enter any additional notes or special instructions"
                  ></textarea>
                </div>
                <div className="col-md-6">
                  <h6 className="fw-bold mb-3">Order Totals</h6>
                  <div className="card">
                    <div className="card-body">
                      <div className="mb-3">
                        <label className="form-label">Shipping Cost</label>
                        <input
                          type="number"
                          className="form-control"
                          name="shipping_cost"
                          value={purchaseOrder.shipping_cost}
                          onChange={handleChange}
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Tax Amount</label>
                        <input
                          type="number"
                          className="form-control"
                          name="tax_amount"
                          value={purchaseOrder.tax_amount}
                          onChange={handleChange}
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div className="d-flex justify-content-between mb-2">
                        <span>Subtotal:</span>
                        <span>${calculateSubtotal().toFixed(2)}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-2">
                        <span>Shipping:</span>
                        <span>${parseFloat(purchaseOrder.shipping_cost.toString()).toFixed(2)}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-2">
                        <span>Tax:</span>
                        <span>${parseFloat(purchaseOrder.tax_amount.toString()).toFixed(2)}</span>
                      </div>
                      <hr />
                      <div className="d-flex justify-content-between fw-bold">
                        <span>Total:</span>
                        <span>${calculateTotal().toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div className="dialog-footer">
            <div className="d-flex gap-2 justify-content-end">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => navigate('/purchase-orders')}
              >
                <ArrowBackIcon fontSize="small" style={{ marginRight: '4px' }} />
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={previewPO}
                disabled={submitting || purchaseOrder.items.length === 0 || !purchaseOrder.supplier.supplier_id}
              >
                <PictureAsPdfIcon fontSize="small" style={{ marginRight: '4px' }} />
                Preview PDF
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || purchaseOrder.items.length === 0 || !purchaseOrder.supplier.supplier_id}
              >
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Saving...
                  </>
                ) : (
                  <>
                    <SaveIcon fontSize="small" style={{ marginRight: '4px' }} />
                    Save PO
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManualPOForm; 