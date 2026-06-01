-- Create demo_sent_emails table for storing email records in demo mode
CREATE TABLE IF NOT EXISTS demo_sent_emails (
  id          SERIAL PRIMARY KEY,
  po_number   TEXT NOT NULL,
  recipient   TEXT NOT NULL,
  subject     TEXT NOT NULL,
  html_body   TEXT NOT NULL,
  pdf_base64  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
