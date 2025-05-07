from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from datetime import datetime

# Load environment variables
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
PRODUCTION_URL = os.getenv("PRODUCTION_URL")

app = FastAPI(title="Inventory Analytics API")

# Configure CORS
allowed_origins = [FRONTEND_URL]
if PRODUCTION_URL:
    allowed_origins.append(PRODUCTION_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for now
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Inventory Analytics API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.get("/test")
async def test_endpoint():
    """Simple test endpoint to verify the service is running."""
    return {"status": "ok", "message": "Analytics service is running"}

@app.get("/api/analytics/inventory-health")
async def get_inventory_health():
    """Endpoint for inventory health metrics."""
    # Sample data for now
    return {
        "average_turnover_rate": 3.2,
        "total_parts_count": 120,
        "low_stock_count": 15,
        "reorder_recommendations": [
            {
                "part_id": "P001",
                "name": "Sensor A",
                "current_quantity": 5,
                "minimum_quantity": 10,
                "days_until_stockout": 14,
                "recommended_order": 15
            }
        ],
        "high_risk_parts": [
            {
                "part_id": "P002",
                "name": "Connector B",
                "risk_score": 0.85,
                "days_until_stockout": 7
            }
        ]
    }

@app.get("/api/analytics/usage-patterns")
async def get_usage_patterns():
    """Endpoint for usage pattern analytics."""
    # Sample data for now
    return {
        "monthly_usage": [
            {
                "date": "2023-05-01",
                "part_id": "P001",
                "name": "Sensor A",
                "quantity_used": 23
            }
        ],
        "trends": [
            {
                "part_id": "P001",
                "name": "Sensor A",
                "trend": 0.15,
                "trend_direction": "increasing"
            }
        ]
    }

@app.get("/api/analytics/cost-analysis")
async def get_cost_analysis():
    """Endpoint for cost analysis data."""
    # Sample data for now
    return {
        "total_inventory_value": 57250.00,
        "annual_holding_cost": 5725.00,
        "potential_savings": 1275.00,
        "high_value_items": [
            {
                "part_id": "P003",
                "name": "Controller C",
                "quantity": 5,
                "unit_cost": 1200.00,
                "total_value": 6000.00
            }
        ],
        "excess_inventory_items": [
            {
                "part_id": "P004",
                "name": "Cable D",
                "excess_quantity": 25,
                "potential_savings": 250.00
            }
        ]
    } 