import React from 'react';
import { Button, ButtonProps } from 'react-bootstrap';

const FISERV_BLUE = '#0066A1';

interface FiservButtonProps extends ButtonProps {
  icon?: React.ReactNode;
}

const FiservButton: React.FC<FiservButtonProps> = ({ 
  children, 
  icon,
  className = '',
  ...props 
}) => {
  return (
    <Button
      variant="outline-primary"
      className={`fiserv-btn ${className}`}
      style={{ 
        borderColor: FISERV_BLUE, 
        color: FISERV_BLUE,
      }}
      {...props}
    >
      {icon && <span className="me-2">{icon}</span>}
      {children}
      <style>
        {`
          .fiserv-btn:hover {
            background-color: ${FISERV_BLUE} !important;
            color: white !important;
            border-color: ${FISERV_BLUE} !important;
          }
        `}
      </style>
    </Button>
  );
};

export default FiservButton; 