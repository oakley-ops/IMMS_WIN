import React from 'react';
import { createPortal } from 'react-dom';

interface ModalPortalProps {
  open: boolean;
  children: React.ReactNode;
}

const ModalPortal: React.FC<ModalPortalProps> = ({ open, children }) => {
  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(children, document.body);
};

export default ModalPortal;
