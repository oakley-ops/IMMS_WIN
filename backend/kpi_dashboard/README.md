# Inventory Analytics Service

This service provides advanced analytics and KPIs for the inventory management system. It uses Python with pandas and scikit-learn to analyze inventory data and provide insights.

## Features

- Inventory Health Analysis
  - Turnover rate calculation
  - Stock-out risk assessment
  - Reorder recommendations

- Usage Pattern Analysis
  - Monthly usage trends
  - Seasonal patterns
  - Part usage correlation

- Cost Analysis
  - Total inventory value
  - Holding cost calculations
  - Potential savings identification
  - High-value item tracking

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Configure environment variables:
   Create a `.env` file with:
   ```
   DATABASE_URL=postgresql://username:password@host:port/database
   ```

3. Run the service:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8001 --reload
   ```

## Docker Setup

1. Build the image:
   ```bash
   docker build -t inventory-analytics .
   ```

2. Run the container:
   ```bash
   docker run -p 8001:8001 --env-file .env inventory-analytics
   ```

## API Endpoints

### GET /api/analytics/inventory-health
Returns inventory health metrics including:
- Average turnover rate
- Total parts count
- Low stock count
- Reorder recommendations
- High-risk parts list

### GET /api/analytics/usage-patterns
Returns usage pattern analysis including:
- Monthly usage trends
- Part usage trends
- Usage correlations

### GET /api/analytics/cost-analysis
Returns cost-related metrics including:
- Total inventory value
- Annual holding costs
- Potential savings
- High-value items
- Excess inventory items

## Integration with Frontend

The analytics service is integrated with the main dashboard through the following components:
- InventoryHealthCard
- UsagePatternsCard
- CostAnalysisCard

These components provide visualizations and insights based on the analytics data.

## Development

To add new analytics:
1. Add new endpoint in `main.py`
2. Create corresponding service method in `analyticsService.ts`
3. Create new component in `frontend/src/components/analytics/`
4. Update the dashboard to include the new component

## Testing

Run tests with:
```bash
pytest
``` 