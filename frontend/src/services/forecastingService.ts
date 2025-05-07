// src/services/forecastingService.js

export interface Transaction { 
  transaction_id: number;
  part_id: number;
  type: string;
  quantity: number;
  timestamp: string;
  user_id: number;
}

interface Part { 
  part_id: number;
  name: string;
  quantity: number; // Add the quantity property
  // ... other properties as needed
}

const calculateMovingAverage = (transactions: Transaction[], period: number) => { // Added curly brace here
  if (transactions.length < period) {
    return 0; // Not enough data to calculate the moving average
  }

  const outgoingTransactions = transactions
    .filter(transaction => transaction.type === 'outgoing')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  let totalQuantity = 0;
  for (let i = 0; i < period; i++) {
    totalQuantity += outgoingTransactions[i].quantity;
  }

  const averageUsage = totalQuantity / period;
  return averageUsage;
};

const predictLowStock = (part: Part, transactions: Transaction[]) => { // Added type annotations
  const movingAverage = calculateMovingAverage(transactions, 3);
  const predictedUsage = movingAverage;

  if (predictedUsage === 0) {
    return {
      partId: part.part_id,
      predictedStockoutDate: null,
      daysToStockout: null,
    };
  }

  const daysToStockout = Math.floor(part.quantity / predictedUsage);

  // Ensure daysToStockout is a number
  const predictedStockoutDate = new Date(Date.now() + (daysToStockout as number) * 24 * 60 * 60 * 1000);

  return {
    partId: part.part_id,
    predictedStockoutDate: predictedStockoutDate,
    daysToStockout,
  };
};

module.exports = {
  calculateMovingAverage,
  predictLowStock,
};