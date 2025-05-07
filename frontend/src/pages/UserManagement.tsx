import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  FormHelperText,
  CircularProgress,
  Alert,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import axios from '../utils/axios';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  last_login: string;
  created_at: string;
  updated_at: string;
}

const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Add user dialog
  const [addUserDialog, setAddUserDialog] = useState<boolean>(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    role: 'tech'
  });
  const [addUserErrors, setAddUserErrors] = useState({
    username: '',
    email: '',
    password: '',
    role: ''
  });
  
  // Edit role dialog
  const [editRoleDialog, setEditRoleDialog] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<string>('');
  
  // Delete user dialog
  const [deleteDialog, setDeleteDialog] = useState<boolean>(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  
  // Fetch users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/api/v1/users');
      setUsers(response.data);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      setError('Failed to load users. ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };
  
  // Initial fetch
  useEffect(() => {
    fetchUsers();
  }, []);
  
  // Add user
  const handleAddUserSubmit = async () => {
    // Validate form
    const errors = {
      username: !newUser.username ? 'Username is required' : '',
      email: !newUser.email ? 'Email is required' : '',
      password: !newUser.password ? 'Password is required' : 
               newUser.password.length < 6 ? 'Password must be at least 6 characters' : '',
      role: !newUser.role ? 'Role is required' : ''
    };
    
    setAddUserErrors(errors);
    
    if (Object.values(errors).some(e => e)) {
      return;
    }
    
    try {
      setLoading(true);
      await axios.post('/api/v1/users', newUser);
      setSuccess('User added successfully');
      setAddUserDialog(false);
      setNewUser({
        username: '',
        email: '',
        password: '',
        role: 'tech'
      });
      fetchUsers();
    } catch (error: any) {
      console.error('Error adding user:', error);
      setError('Failed to add user. ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };
  
  // Edit role
  const handleEditRole = (user: User) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setEditRoleDialog(true);
  };
  
  const handleRoleSubmit = async () => {
    if (!selectedUser) return;
    
    try {
      setLoading(true);
      await axios.put(`/api/v1/users/${selectedUser.id}/role`, { role: newRole });
      setSuccess('User role updated successfully');
      setEditRoleDialog(false);
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating role:', error);
      setError('Failed to update role. ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };
  
  // Delete user
  const handleDeleteUser = (user: User) => {
    setUserToDelete(user);
    setDeleteDialog(true);
  };
  
  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    
    try {
      setLoading(true);
      await axios.delete(`/api/v1/users/${userToDelete.id}`);
      setSuccess('User deleted successfully');
      setDeleteDialog(false);
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      setError('Failed to delete user. ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };
  
  // Reset notifications after 5 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [success, error]);
  
  // Get role color
  const getRoleColor = (role: string): "primary" | "secondary" | "error" | "info" | "success" | "warning" | "default" => {
    switch (role) {
      case 'admin':
        return 'error';
      case 'purchasing':
        return 'info';
      case 'tech':
        return 'success';
      default:
        return 'default';
    }
  };
  
  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">User Management</Typography>
        <Box>
          <Button 
            variant="contained" 
            startIcon={<RefreshIcon />} 
            sx={{ mr: 2 }}
            onClick={fetchUsers}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<AddIcon />}
            onClick={() => setAddUserDialog(true)}
          >
            Add User
          </Button>
        </Box>
      </Box>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 440 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Username</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Last Login</TableCell>
                <TableCell>Created At</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <CircularProgress size={24} sx={{ my: 2 }} />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Chip 
                        label={user.role.toUpperCase()}
                        color={getRoleColor(user.role)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {user.last_login ? format(new Date(user.last_login), 'MM/dd/yyyy HH:mm') : 'Never'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(user.created_at), 'MM/dd/yyyy')}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit Role">
                        <IconButton 
                          color="primary" 
                          onClick={() => handleEditRole(user)}
                          disabled={user.id === currentUser?.id}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete User">
                        <IconButton 
                          color="error" 
                          onClick={() => handleDeleteUser(user)}
                          disabled={user.id === currentUser?.id}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      
      {/* Add User Dialog */}
      <Dialog open={addUserDialog} onClose={() => setAddUserDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New User</DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Username"
              margin="normal"
              value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
              error={!!addUserErrors.username}
              helperText={addUserErrors.username}
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              margin="normal"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              error={!!addUserErrors.email}
              helperText={addUserErrors.email}
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              margin="normal"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              error={!!addUserErrors.password}
              helperText={addUserErrors.password}
            />
            <FormControl fullWidth margin="normal" error={!!addUserErrors.role}>
              <InputLabel>Role</InputLabel>
              <Select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                label="Role"
              >
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="purchasing">Purchasing</MenuItem>
                <MenuItem value="tech">Tech</MenuItem>
              </Select>
              {addUserErrors.role && <FormHelperText>{addUserErrors.role}</FormHelperText>}
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddUserDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleAddUserSubmit} 
            variant="contained" 
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Add User'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Edit Role Dialog */}
      <Dialog open={editRoleDialog} onClose={() => setEditRoleDialog(false)}>
        <DialogTitle>Change User Role</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle1" gutterBottom>
            User: {selectedUser?.username}
          </Typography>
          <FormControl fullWidth margin="normal">
            <InputLabel>Role</InputLabel>
            <Select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              label="Role"
            >
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="purchasing">Purchasing</MenuItem>
              <MenuItem value="tech">Tech</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditRoleDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleRoleSubmit} 
            variant="contained"
            disabled={loading || newRole === selectedUser?.role}
          >
            {loading ? <CircularProgress size={24} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete User Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>Confirm Delete User</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete user "{userToDelete?.username}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
          <Button 
            onClick={confirmDeleteUser} 
            variant="contained" 
            color="error"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserManagement; 