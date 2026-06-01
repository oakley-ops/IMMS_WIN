// frontend/src/components/demo/DemoEmailPreviewModal.tsx
import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, Divider, CircularProgress,
} from '@mui/material';
import { Mail } from 'lucide-react';
import axiosInstance from '../../utils/axios';

interface SentEmail {
  id: number;
  po_number: string;
  recipient: string;
  subject: string;
  html_body: string;
  pdf_base64: string | null;
  created_at: string;
}

interface Props {
  emailId: number | null;
  onClose: () => void;
}

const DemoEmailPreviewModal: React.FC<Props> = ({ emailId, onClose }) => {
  const [email, setEmail] = useState<SentEmail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!emailId) return;
    setLoading(true);
    axiosInstance
      .get(`/api/v1/demo/sent-emails/${emailId}`)
      .then((r) => setEmail(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [emailId]);

  const openPdf = () => {
    if (!email?.pdf_base64) return;
    const byteArray = Uint8Array.from(atob(email.pdf_base64), (c) => c.charCodeAt(0));
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    window.open(URL.createObjectURL(blob), '_blank');
  };

  return (
    <Dialog open={!!emailId} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Mail size={18} />
        Sent (demo) — here's the email the vendor would receive
      </DialogTitle>
      <DialogContent dividers>
        {loading && <CircularProgress />}
        {email && (
          <Box>
            <Typography variant="caption" color="text.secondary">To</Typography>
            <Typography variant="body2" gutterBottom>{email.recipient}</Typography>
            <Typography variant="caption" color="text.secondary">Subject</Typography>
            <Typography variant="body2" gutterBottom>{email.subject}</Typography>
            <Divider sx={{ my: 1.5 }} />
            <Box
              dangerouslySetInnerHTML={{ __html: email.html_body }}
              sx={{ fontSize: '13px', lineHeight: 1.6 }}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {email?.pdf_base64 && (
          <Button onClick={openPdf} variant="outlined" size="small">
            View PDF Attachment
          </Button>
        )}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default DemoEmailPreviewModal;
