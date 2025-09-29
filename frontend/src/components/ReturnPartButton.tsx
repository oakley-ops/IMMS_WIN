import React, { useState } from 'react';
import { Button, Tooltip } from '@mui/material';
import { Undo as UndoIcon } from '@mui/icons-material';
import ReturnPartsDialog from './ReturnPartsDialog';
import { Part } from '../types';

// Using shared Part interface from types

interface ReturnPartButtonProps {
  part?: Part;
  onSuccess?: () => void;
  size?: 'small' | 'medium' | 'large';
  variant?: 'contained' | 'outlined' | 'text';
}

const ReturnPartButton: React.FC<ReturnPartButtonProps> = ({
  part,
  onSuccess,
  size = 'small',
  variant = 'outlined'
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleOpenDialog = () => {
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  const handleSuccess = () => {
    onSuccess?.();
    setDialogOpen(false);
  };

  return (
    <>
      <Tooltip title="Return unused parts to inventory">
        <Button
          startIcon={<UndoIcon />}
          onClick={handleOpenDialog}
          size={size}
          variant={variant}
          color="info"
          sx={{ 
            minWidth: 'auto',
            ...(size === 'small' && { px: 1 })
          }}
        >
          Return
        </Button>
      </Tooltip>
      
      <ReturnPartsDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        onSuccess={handleSuccess}
        preSelectedPart={part}
      />
    </>
  );
};

export default ReturnPartButton;
