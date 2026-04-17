/**
 * ML Service Integration Layer
 * Connects Node.js backend to Python ML service
 * Routes: /api/ml/* -> Python service calls
 */

import axios from 'axios';
import type { AxiosInstance } from 'axios';

const logger = {
  info: (...args: unknown[]) => console.info(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
};

export class MLServiceClient {
  private baseUrl: string;
  private timeout: number;
  private client: AxiosInstance;

  constructor(mlBaseUrl = process.env.ML_SERVICE_URL || 'http://localhost:5001') {
    this.baseUrl = mlBaseUrl;
    this.timeout = 10000; // 10 second timeout
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Health check - ensure ML service is ready
   */
  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('ML service health check failed:', message);
      return { status: 'unavailable', error: message };
    }
  }

  /**
   * Main prediction endpoint
   * Calls Python ML service /api/ml/predict
   */
  async predict(payload: Record<string, unknown>) {
    try {
      const workerEmail = String(payload.worker_email ?? 'unknown');
      logger.info(`[ML] Predicting risk for ${workerEmail}`);
      
      const response = await this.client.post('/api/ml/predict', payload);
      
      logger.info(`[ML] ✓ Prediction complete. Risk: ${response.data.predictions.risk.score.toFixed(2)}`);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[ML] Prediction failed: ${message}`);
      
      // Fallback to rules-based if ML service unavailable
      return {
        success: false,
        error: message,
        fallback: this.fallbackRiskCalculation(payload)
      };
    }
  }

  /**
   * Fraud detection endpoint
   */
  async checkFraud(payload: Record<string, unknown>) {
    try {
      const response = await this.client.post('/api/ml/fraud-check', payload);
      return { success: true, data: response.data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[ML] Fraud check failed: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Get model performance stats
   */
  async getModelStats() {
    try {
      const response = await this.client.get('/api/ml/model-stats');
      return response.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[ML] Could not fetch model stats: ${message}`);
      return null;
    }
  }

  /**
   * Check for data drift
   */
  async checkDrift() {
    try {
      const response = await this.client.get('/api/ml/drift-check');
      return response.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[ML] Drift check failed: ${message}`);
      return null;
    }
  }

  /**
   * Get fairness report
   */
  async getFairnessReport() {
    try {
      const response = await this.client.get('/api/ml/fairness-report');
      return response.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[ML] Fairness report failed: ${message}`);
      return null;
    }
  }

  /**
   * Trigger model retraining
   */
  async triggerRetrain(modelType = 'all') {
    try {
      const response = await this.client.post('/api/ml/retrain', { model_type: modelType });
      logger.info(`[ML] Retraining triggered for ${modelType}`);
      return response.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[ML] Retrain trigger failed: ${message}`);
      return null;
    }
  }

  /**
   * Fallback risk calculation (rules-based)
   * When ML service is unavailable
   */
  fallbackRiskCalculation(payload: Record<string, unknown>) {
    const weather = (payload.weather as Record<string, number> | undefined) || {};
    const traffic = (payload.traffic as Record<string, number> | undefined) || {};
    
    let riskScore = 0;
    
    // Rain impact (40%)
    const rainProb = (weather.rain_probability || 0) / 100;
    const rainMm = Math.min(1, (weather.rain_mm || 0) / 100);
    const rainScore = (rainProb * 0.7 + rainMm * 0.3) * 0.4;
    riskScore += rainScore;
    
    // AQI impact (25%)
    const aqi = weather.aqi || 100;
    const aqiScore = (Math.min(aqi, 500) / 500) * 0.25;
    riskScore += aqiScore;
    
    // Traffic impact (20%)
    const trafficDelay = traffic.delay_ratio || 1.0;
    const trafficScore = Math.min(1, (trafficDelay - 1.0) / 2.0) * 0.2;
    riskScore += trafficScore;
    
    // Temperature (10%)
    const temp = weather.temperature || 25;
    let tempScore = 0;
    if (temp < 5 || temp > 38) tempScore = 0.5;
    if (temp < 0 || temp > 45) tempScore = 1.0;
    riskScore += tempScore * 0.1;
    
    // Wind (5%)
    const wind = weather.wind_speed || 0;
    const windScore = Math.min(1, wind / 50) * 0.05;
    riskScore += windScore;
    
    riskScore = Math.min(1, riskScore);
    
    const level = riskScore < 0.33 ? 'LOW' : riskScore < 0.66 ? 'MEDIUM' : 'HIGH';
    
    return {
      risk: {
        score: riskScore,
        level: level,
        probabilities: {
          low: Math.max(0, 1 - riskScore),
          medium: 0.5,
          high: riskScore
        }
      },
      source: 'fallback_rules_based'
    };
  }
}

export default MLServiceClient;
