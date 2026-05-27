'use client';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Paper, List, ListItem, ListItemAvatar, ListItemText,
  Avatar, Chip, TextField, InputAdornment, CircularProgress, Alert,
  Checkbox, FormControlLabel, Button, Stack, Divider,
} from '@mui/material';
import { Search, Lock } from '@mui/icons-material';
import permSvc, { UserPermissions, UserWithPermissions } from '../../services/permissionsService';
import { MCS_ORANGE } from '../../theme';

type PermKey = 'badges_add' | 'readers_manage' | 'calls_manage' | 'analytics_view' | 'skilled_operator';

// Which keys each non-admin role gets automatically (cannot be unchecked).
const ROLE_DEFAULTS: Record<string, Set<PermKey>> = {
  tech: new Set(['calls_manage', 'analytics_view'] as PermKey[]),
};

const PRESETS: Record<string, UserPermissions> = {
  Supervisor:    { badges_add: true,  readers_manage: false, calls_manage: true,  analytics_view: true,  skilled_operator: false },
  'Senior Tech': { badges_add: false, readers_manage: true,  calls_manage: true,  analytics_view: true,  skilled_operator: false },
  Analyst:       { badges_add: false, readers_manage: false, calls_manage: false, analytics_view: true,  skilled_operator: false },
  'Clear All':   { badges_add: false, readers_manage: false, calls_manage: false, analytics_view: false, skilled_operator: false },
};

interface PermGroup {
  label: string;
  items: Array<{
    key: PermKey | null;
    label: string;
    description: string;
    locked?: boolean;
  }>;
}

const PERMISSION_GROUPS: PermGroup[] = [
  {
    label: 'BADGE MANAGEMENT',
    items: [
      { key: 'badges_add', label: 'Add new badges', description: 'Register new badge/operator pairs' },
      { key: null, label: 'Edit / deactivate badges', description: 'Modify or suspend existing badges — Admin only', locked: true },
    ],
  },
  {
    label: 'READER MANAGEMENT',
    items: [
      { key: 'readers_manage', label: 'Manage badge readers', description: 'Add, edit, and delete badge readers' },
    ],
  },
  {
    label: 'CALL MANAGEMENT',
    items: [
      { key: 'calls_manage', label: 'Create / resolve / suspend calls', description: 'Full call lifecycle management' },
    ],
  },
  {
    label: 'ANALYTICS',
    items: [
      { key: 'analytics_view', label: 'View analytics page', description: 'Access the analytics dashboard' },
    ],
  },
  {
    label: 'OPERATOR SETTINGS',
    items: [
      { key: 'skilled_operator', label: 'Skilled operator', description: 'Operator badge allows logging calls at the station' },
    ],
  },
  {
    label: 'PERMISSIONS MANAGEMENT',
    items: [
      { key: null, label: 'Manage permissions', description: 'Configure user permissions — Admin only forever', locked: true },
    ],
  },
];

const ROLE_COLORS: Record<string, string> = {
  admin: '#D32F2F',
  tech: '#1565C0',
  purchasing: '#6A1B9A',
};

const initials = (username: string) => username.slice(0, 2).toUpperCase();

export default function PermissionsPanel() {
  const [users, setUsers] = useState<UserWithPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<UserWithPermissions | null>(null);
  const [localPerms, setLocalPerms] = useState<UserPermissions | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await permSvc.getUsers();
      setUsers(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const selectUser = (u: UserWithPermissions) => {
    setSelected(u);
    setLocalPerms({ ...u.permissions });
    setSaveSuccess(false);
    setSaveError(null);
  };

  const isRoleDefault = (user: UserWithPermissions, key: PermKey): boolean => {
    if (user.role === 'admin') return true;
    return ROLE_DEFAULTS[user.role]?.has(key) ?? false;
  };

  const togglePerm = (key: PermKey) => {
    if (!localPerms || !selected) return;
    if (isRoleDefault(selected, key)) return; // cannot uncheck role defaults
    setLocalPerms({ ...localPerms, [key]: !localPerms[key] });
  };

  const applyPreset = (presetName: string) => {
    if (!selected || !localPerms) return;
    const preset = PRESETS[presetName];
    const merged: UserPermissions = { ...preset };
    (Object.keys(merged) as PermKey[]).forEach((k) => {
      if (isRoleDefault(selected, k)) merged[k] = true;
    });
    setLocalPerms(merged);
  };

  const handleSave = async () => {
    if (!selected || !localPerms) return;
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      const updated = await permSvc.savePermissions(selected.user_id, localPerms);
      setUsers((prev) => prev.map((u) => u.user_id === updated.user_id ? updated : u));
      setSelected(updated);
      setLocalPerms({ ...updated.permissions });
      setSaveSuccess(true);
    } catch {
      setSaveError('Failed to save permissions. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = users.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box display="flex" gap={2} height="calc(100vh - 130px)">
      {/* Left panel: user list */}
      <Paper sx={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box p={2} borderBottom="1px solid #eee">
          <TextField
            size="small"
            fullWidth
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
          />
        </Box>
        {loading ? (
          <Box display="flex" justifyContent="center" p={4}><CircularProgress size={32} sx={{ color: MCS_ORANGE }} /></Box>
        ) : (
          <List dense sx={{ overflowY: 'auto', flex: 1 }}>
            {filtered.map((u) => (
              <ListItem
                key={u.user_id}
                component="div"
                onClick={() => selectUser(u)}
                selected={selected?.user_id === u.user_id}
                sx={{ cursor: 'pointer', '&.Mui-selected': { bgcolor: 'rgba(255,107,53,0.08)' } }}
              >
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: MCS_ORANGE, width: 32, height: 32, fontSize: 13 }}>
                    {initials(u.username)}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={u.username}
                  secondaryTypographyProps={{ component: 'span' as const }}
                  secondary={
                    <Chip
                      label={u.role}
                      size="small"
                      sx={{ bgcolor: ROLE_COLORS[u.role] || '#666', color: 'white', fontSize: 10, height: 18 }}
                    />
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      {/* Right panel: permission grid */}
      <Paper sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
        {!selected ? (
          <Box display="flex" alignItems="center" justifyContent="center" height="100%">
            <Typography color="text.secondary">Select a user to configure permissions</Typography>
          </Box>
        ) : (
          <>
            {/* Header */}
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
              <Box display="flex" alignItems="center" gap={2}>
                <Avatar sx={{ bgcolor: MCS_ORANGE, width: 48, height: 48, fontSize: 18 }}>
                  {initials(selected.username)}
                </Avatar>
                <Box>
                  <Typography variant="h6" fontWeight="bold">{selected.username}</Typography>
                  <Chip label={selected.role} size="small" sx={{ bgcolor: ROLE_COLORS[selected.role] || '#666', color: 'white', fontSize: 11 }} />
                  {selected.updated_by_username && (
                    <Typography variant="caption" display="block" color="text.secondary" mt={0.5}>
                      Last updated by {selected.updated_by_username}
                    </Typography>
                  )}
                </Box>
              </Box>
              {/* Preset buttons */}
              <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="flex-end">
                {Object.keys(PRESETS).map((p) => (
                  <Button
                    key={p}
                    size="small"
                    variant="outlined"
                    onClick={() => applyPreset(p)}
                    sx={{ borderColor: MCS_ORANGE, color: MCS_ORANGE, fontSize: 11 }}
                  >
                    {p}
                  </Button>
                ))}
              </Stack>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Feedback */}
            {saveSuccess && <Alert severity="success" sx={{ mb: 2 }}>Permissions saved successfully.</Alert>}
            {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}

            {/* Permission groups */}
            {PERMISSION_GROUPS.map((group) => (
              <Box key={group.label} mb={2}>
                <Typography variant="overline" fontWeight="bold" color="text.secondary" fontSize={10} letterSpacing={1.5}>
                  {group.label}
                </Typography>
                {group.items.map((item) => {
                  if (item.locked) {
                    return (
                      <Box key={item.label} display="flex" alignItems="center" gap={1} py={0.5} pl={2} sx={{ opacity: 0.5 }}>
                        <Lock fontSize="small" data-testid="lock-icon" />
                        <Box>
                          <Typography variant="body2">{item.label}</Typography>
                          <Typography variant="caption" color="text.secondary">{item.description}</Typography>
                        </Box>
                        <Chip label="Admin only" size="small" color="error" sx={{ ml: 'auto', fontSize: 10, height: 18 }} />
                      </Box>
                    );
                  }
                  const key = item.key as PermKey;
                  const isDefault = isRoleDefault(selected, key);
                  const checked = localPerms ? localPerms[key] : false;
                  return (
                    <Box key={key} pl={2}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={checked}
                            disabled={isDefault}
                            onChange={() => togglePerm(key)}
                            size="small"
                            sx={{ color: MCS_ORANGE, '&.Mui-checked': { color: MCS_ORANGE } }}
                            inputProps={{ 'aria-label': item.label }}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2" component="span">
                              {item.label}
                              {isDefault && <Chip label="Role default" size="small" sx={{ ml: 1, fontSize: 10, height: 16 }} />}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" component="div">{item.description}</Typography>
                          </Box>
                        }
                      />
                    </Box>
                  );
                })}
                <Divider sx={{ mt: 1 }} />
              </Box>
            ))}

            {/* Save */}
            <Box display="flex" justifyContent="flex-end" mt={2}>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saving}
                sx={{ bgcolor: MCS_ORANGE, '&:hover': { bgcolor: '#E55A2B' } }}
              >
                {saving ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Save Changes'}
              </Button>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
}
