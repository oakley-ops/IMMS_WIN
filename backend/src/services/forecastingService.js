// Simple forecasting service that predicts when parts might run low on stock
function predictLowStock(part, transactions) {
  // Calculate average daily usage
  const usageRates = calculateUsageRates(transactions);
  const daysUntilLow = predictDaysUntilLow(part, usageRates);
  const restockRecommendation = calculateRestockRecommendation(part, usageRates);

  return {
    partId: part.part_id,
    currentStock: part.quantity,
    minimumStock: part.minimum_quantity,
    averageDailyUsage: usageRates.daily,
    daysUntilLow,
    restockRecommendation,
  };
}

function calculateUsageRates(transactions) {
  if (!transactions || transactions.length < 2) {
    return { daily: 0, weekly: 0, monthly: 0 };
  }

  // Sort transactions by date
  const sortedTransactions = transactions.sort((a, b) => 
    new Date(a.created_at) - new Date(b.created_at)
  );

  // Calculate total usage and time period
  const firstDate = new Date(sortedTransactions[0].created_at);
  const lastDate = new Date(sortedTransactions[sortedTransactions.length - 1].created_at);
  const daysDiff = (lastDate - firstDate) / (1000 * 60 * 60 * 24);

  const totalUsage = sortedTransactions.reduce((sum, t) => 
    sum + (t.type === 'removal' ? t.quantity : 0), 0
  );

  const daily = daysDiff > 0 ? totalUsage / daysDiff : 0;
  
  return {
    daily,
    weekly: daily * 7,
    monthly: daily * 30,
  };
}

function predictDaysUntilLow(part, usageRates) {
  if (usageRates.daily === 0) return null;

  const stockAboveMinimum = part.quantity - part.minimum_quantity;
  return Math.ceil(stockAboveMinimum / usageRates.daily);
}

function calculateRestockRecommendation(part, usageRates) {
  // Recommend enough stock for 30 days plus minimum quantity
  const recommendedStock = Math.ceil(usageRates.daily * 30) + part.minimum_quantity;
  const orderQuantity = Math.max(0, recommendedStock - part.quantity);

  return {
    recommendedStock,
    orderQuantity,
  };
}

module.exports = {
  predictLowStock,
};
