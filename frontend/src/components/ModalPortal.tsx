import React from 'react';
import { createPortal } from 'react-dom';

interface ModalPortalProps {
  children: React.ReactNode;
  open: boolean;
}

const ModalPortal: React.FC<ModalPortalProps> = ({ children, open }) => {
  const modalRoot = document.getElementById('modal-root');

  if (!open || !modalRoot) {
    return null;
  }

  return createPortal(
    <div 
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)'
      }}
    >
      {children}
    </div>,
    modalRoot
  );
};

export default ModalPortal; 