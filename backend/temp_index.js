const express = require('express');
const cors = require('cors');
const partsRouter = require('./src/routes/parts');
const machinesRouter = require('./src/routes/machines');
const transactionsRouter = require('./src/routes/transactions');

const app = express();
const port = process.env.PORT || 3001;

// CORS configuration
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/v1/parts', partsRouter);
app.use('/v1/machines', machinesRouter);
app.use('/v1/transactions', transactionsRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
