import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

interface Part {
  part_id: number;
  name: string;
  description: string;
  quantity: number;
  manufacturer_part_number: string;
  fiserv_part_number: string;
  machine_id: number;
  supplier: string;
  image: string;
}

interface ForecastData {
  partId: number;
  predictedStockoutDate: string | null;
  daysToStockout: number | null;
}

interface PartForecastProps {
  id: number;
}

const PartForecast: React.FC<PartForecastProps> = ({ id }) => {
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchForecast = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await axios.get<ForecastData>(`${API_URL}/api/v1/parts/${id}/forecast`);
        
        // Ensure we have valid data before setting the state
        if (response.data && typeof response.data === 'object') {
          const forecastData: ForecastData = {
            partId: Number(response.data.partId),
            predictedStockoutDate: response.data.predictedStockoutDate,
            daysToStockout: response.data.daysToStockout !== null 
              ? Number(response.data.daysToStockout) 
              : null
          };
          setForecast(forecastData);
        } else {
          throw new Error('Invalid forecast data received');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch forecast';
        setError(errorMessage);
        console.error('Error fetching forecast:', err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchForecast();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="forecast-loading">
        <p>Loading forecast...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="forecast-error">
        <p>Error: {error}</p>
      </div>
    );
  }

  if (!forecast) {
    return (
      <div className="forecast-empty">
        <p>No forecast data available</p>
      </div>
    );
  }

  return (
    <div className="forecast-container">
      <h3>Stock Forecast</h3>
      <div className="forecast-details">
        {forecast.predictedStockoutDate && (
          <p>
            <strong>Predicted Stockout:</strong>{' '}
            {new Date(forecast.predictedStockoutDate).toLocaleDateString()}
          </p>
        )}
        {forecast.daysToStockout !== null && (
          <p>
            <strong>Days until stockout:</strong>{' '}
            {forecast.daysToStockout}
          </p>
        )}
        {!forecast.predictedStockoutDate && forecast.daysToStockout === null && (
          <p>Insufficient data for forecast</p>
        )}
      </div>
    </div>
  );
};

export default PartForecast;