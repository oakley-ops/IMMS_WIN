import React from 'react';
import { Button, ButtonProps } from 'react-bootstrap';

const IMMS_ORANGE = '#FF6600';

interface ImmsButtonProps extends ButtonProps {
  icon?: React.ReactNode;
}

const ImmsButton: React.FC<ImmsButtonProps> = ({ 
  children, 
  icon,
  className = '',
  ...props 
}) => {
  return (
    <Button
      variant="outline-primary"
      className={`imms-btn ${className}`}
      style={{ 
        borderColor: IMMS_ORANGE, 
        color: IMMS_ORANGE,
      }}
      {...props}
    >
      {icon && <span className="me-2">{icon}</span>}
      {children}
      <style>
        {`
          .imms-btn:hover {
            background-color: ${IMMS_ORANGE} !important;
            color: white !important;
            border-color: ${IMMS_ORANGE} !important;
          }
        `}
      </style>
    </Button>
  );
};

export default ImmsButton;
