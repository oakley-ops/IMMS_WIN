import React, { useState, useEffect } from 'react';
import axiosInstance from '../utils/axios';

interface Contact {
  contact_id: number;
  name: string;
  company: string;
  type: 'vendor' | 'contractor' | 'supplier';
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  notes?: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

interface ContactFormData {
  name: string;
  company: string;
  type: 'vendor' | 'contractor' | 'supplier';
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  notes: string;
  status: 'active' | 'inactive';
}

const Contacts: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    company: '',
    type: 'vendor',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    notes: '',
    status: 'active'
  });

  // Fetch contacts
  const fetchContacts = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/api/v1/contacts');
      setContacts(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch contacts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      if (editingContact) {
        // Update existing contact
        await axiosInstance.put(`/api/v1/contacts/${editingContact.contact_id}`, formData);
      } else {
        // Create new contact
        await axiosInstance.post('/api/v1/contacts', formData);
      }
      
      await fetchContacts();
      handleCloseModal();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save contact');
    } finally {
      setLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async (contactId: number) => {
    try {
      setLoading(true);
      await axiosInstance.delete(`/api/v1/contacts/${contactId}`);
      await fetchContacts();
      setDeleteConfirmId(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete contact');
    } finally {
      setLoading(false);
    }
  };

  // Modal handlers
  const handleOpenModal = (contact?: Contact) => {
    if (contact) {
      setEditingContact(contact);
      setFormData({
        name: contact.name,
        company: contact.company,
        type: contact.type,
        email: contact.email,
        phone: contact.phone,
        address: contact.address,
        city: contact.city,
        state: contact.state,
        zip_code: contact.zip_code,
        notes: contact.notes || '',
        status: contact.status
      });
    } else {
      setEditingContact(null);
      setFormData({
        name: '',
        company: '',
        type: 'vendor',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zip_code: '',
        notes: '',
        status: 'active'
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingContact(null);
    setError(null);
  };

  // Filter contacts
  const filteredContacts = contacts.filter(contact => {
    const matchesType = filterType === 'all' || contact.type === filterType;
    const matchesSearch = searchTerm === '' || 
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  // Get contact type badge class
  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'vendor': return 'bg-primary';
      case 'contractor': return 'bg-success';
      case 'supplier': return 'bg-info';
      default: return 'bg-secondary';
    }
  };

  // Get status badge class
  const getStatusBadgeClass = (status: string) => {
    return status === 'active' ? 'bg-success' : 'bg-danger';
  };

  return (
    <div className="container-fluid py-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="h3 mb-0" style={{ color: '#FF6200' }}>Contacts Management</h2>
          <p className="text-muted mb-0">Manage vendors, contractors, and suppliers</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => handleOpenModal()}
        >
          <i className="bi bi-plus-circle me-2"></i>
          Add Contact
        </button>
      </div>

      {/* Stats Cards */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex align-items-center">
                <div className="flex-grow-1">
                  <h6 className="text-muted mb-1">Total Contacts</h6>
                  <h4 className="mb-0">{contacts.length}</h4>
                </div>
                <div className="text-primary">
                  <i className="bi bi-people fs-1"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex align-items-center">
                <div className="flex-grow-1">
                  <h6 className="text-muted mb-1">Vendors</h6>
                  <h4 className="mb-0">{contacts.filter(c => c.type === 'vendor').length}</h4>
                </div>
                <div className="text-info">
                  <i className="bi bi-shop fs-1"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex align-items-center">
                <div className="flex-grow-1">
                  <h6 className="text-muted mb-1">Contractors</h6>
                  <h4 className="mb-0">{contacts.filter(c => c.type === 'contractor').length}</h4>
                </div>
                <div className="text-success">
                  <i className="bi bi-tools fs-1"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex align-items-center">
                <div className="flex-grow-1">
                  <h6 className="text-muted mb-1">Suppliers</h6>
                  <h4 className="mb-0">{contacts.filter(c => c.type === 'supplier').length}</h4>
                </div>
                <div className="text-warning">
                  <i className="bi bi-truck fs-1"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="row">
            <div className="col-md-6">
              <div className="d-flex align-items-center">
                <label className="form-label me-3 mb-0">Filter by Type:</label>
                <select 
                  className="form-select w-auto"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="all">All Types</option>
                  <option value="vendor">Vendors</option>
                  <option value="contractor">Contractors</option>
                  <option value="supplier">Suppliers</option>
                </select>
              </div>
            </div>
            <div className="col-md-6">
              <div className="d-flex align-items-center">
                <label className="form-label me-3 mb-0">Search:</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by name, company, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          {error}
          <button 
            type="button" 
            className="btn-close" 
            onClick={() => setError(null)}
          ></button>
        </div>
      )}

      {/* Contacts Table */}
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          {loading ? (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-2 text-muted">Loading contacts...</p>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-4">
              <i className="bi bi-people text-muted" style={{ fontSize: '3rem' }}></i>
              <h5 className="text-muted mt-3">No contacts found</h5>
              <p className="text-muted">Add your first contact to get started.</p>
              <button 
                className="btn btn-primary"
                onClick={() => handleOpenModal()}
              >
                <i className="bi bi-plus-circle me-2"></i>
                Add Contact
              </button>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead className="table-light">
                  <tr>
                    <th>Name</th>
                    <th>Company</th>
                    <th>Type</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.map((contact) => (
                    <tr key={contact.contact_id}>
                      <td>
                        <div className="fw-bold">{contact.name}</div>
                      </td>
                      <td>{contact.company}</td>
                      <td>
                        <span className={`badge ${getTypeBadgeClass(contact.type)}`}>
                          {contact.type.charAt(0).toUpperCase() + contact.type.slice(1)}
                        </span>
                      </td>
                      <td>
                        <a href={`mailto:${contact.email}`} className="text-decoration-none">
                          {contact.email}
                        </a>
                      </td>
                      <td>
                        <a href={`tel:${contact.phone}`} className="text-decoration-none">
                          {contact.phone}
                        </a>
                      </td>
                      <td>
                        <small className="text-muted">
                          {contact.city}, {contact.state}
                        </small>
                      </td>
                      <td>
                        <span className={`badge ${getStatusBadgeClass(contact.status)}`}>
                          {contact.status.charAt(0).toUpperCase() + contact.status.slice(1)}
                        </span>
                      </td>
                      <td>
                        <div className="btn-group" role="group">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => handleOpenModal(contact)}
                            title="Edit Contact"
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => setDeleteConfirmId(contact.contact_id)}
                            title="Delete Contact"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Contact Modal */}
      {showModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingContact ? 'Edit Contact' : 'Add New Contact'}
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={handleCloseModal}
                ></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        required
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Company *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.company}
                        onChange={(e) => setFormData({...formData, company: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Type *</label>
                      <select
                        className="form-select"
                        value={formData.type}
                        onChange={(e) => setFormData({...formData, type: e.target.value as 'vendor' | 'contractor' | 'supplier'})}
                        required
                      >
                        <option value="vendor">Vendor</option>
                        <option value="contractor">Contractor</option>
                        <option value="supplier">Supplier</option>
                      </select>
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Status *</label>
                      <select
                        className="form-select"
                        value={formData.status}
                        onChange={(e) => setFormData({...formData, status: e.target.value as 'active' | 'inactive'})}
                        required
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Email *</label>
                      <input
                        type="email"
                        className="form-control"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        required
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Phone *</label>
                      <input
                        type="tel"
                        className="form-control"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Address</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                    />
                  </div>

                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">City</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.city}
                        onChange={(e) => setFormData({...formData, city: e.target.value})}
                      />
                    </div>
                    <div className="col-md-3 mb-3">
                      <label className="form-label">State</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.state}
                        onChange={(e) => setFormData({...formData, state: e.target.value})}
                      />
                    </div>
                    <div className="col-md-3 mb-3">
                      <label className="form-label">ZIP Code</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.zip_code}
                        onChange={(e) => setFormData({...formData, zip_code: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Notes</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      placeholder="Additional notes about this contact..."
                    ></textarea>
                  </div>
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={handleCloseModal}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        Saving...
                      </>
                    ) : (
                      editingContact ? 'Update Contact' : 'Add Contact'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Confirm Delete</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setDeleteConfirmId(null)}
                ></button>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to delete this contact? This action cannot be undone.</p>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setDeleteConfirmId(null)}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-danger"
                  onClick={() => handleDelete(deleteConfirmId)}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Deleting...
                    </>
                  ) : (
                    'Delete Contact'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Contacts;
