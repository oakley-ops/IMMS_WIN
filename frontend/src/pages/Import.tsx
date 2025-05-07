import React from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import CSVUploadForm from '../components/CSVUploadForm';

const Import: React.FC = () => {
  return (
    <Container fluid>
      <Row>
        <Col>
          <h1 className="my-4">Import Data</h1>
        </Col>
      </Row>
      
      <Row>
        <Col md={8} lg={6}>
          <Card>
            <Card.Body>
              <CSVUploadForm />
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Import;
