/**
 * ML Service Client
 * Bridge between Node.js backend and Python Flask ML microservice
 */

class MLServiceClient {
  constructor(baseUrl = 'http://localhost:5001') {
    this.baseUrl = baseUrl;
  }

  async predict(payload) {
    try {
      const response = await fetch(`${this.baseUrl}/api/ml/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`ML service error: ${response.status}`);
      }

      return {
        success: true,
        data: await response.json(),
        latency_ms: Date.now(),
      };
    } catch (error) {
      console.error('ML predict error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async assessRisk(payload) {
    try {
      const response = await fetch(`${this.baseUrl}/api/risk/assess`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`ML service error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('ML service error:', error.message);
      return {
        risk_score: 0.5,
        risk_level: 'MEDIUM',
        confidence: 'low',
        error: error.message,
      };
    }
  }

  async predictFraud(payload) {
    try {
      const response = await fetch(`${this.baseUrl}/api/fraud/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`ML service error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('ML fraud prediction error:', error.message);
      return {
        is_fraudulent: false,
        confidence: 0,
        error: error.message,
      };
    }
  }

  async checkFraud(payload) {
    try {
      const response = await fetch(`${this.baseUrl}/api/ml/check-fraud`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`ML service error: ${response.status}`);
      }

      return {
        success: true,
        data: await response.json(),
      };
    } catch (error) {
      console.error('ML fraud check error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getModelStats() {
    try {
      const response = await fetch(`${this.baseUrl}/api/ml/model-stats`);
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('Model stats error:', error.message);
      return null;
    }
  }

  async checkDrift() {
    try {
      const response = await fetch(`${this.baseUrl}/api/ml/drift-check`);
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('Drift check error:', error.message);
      return null;
    }
  }

  async getFairnessReport() {
    try {
      const response = await fetch(`${this.baseUrl}/api/ml/fairness-report`);
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('Fairness report error:', error.message);
      return null;
    }
  }

  async triggerRetrain(modelType) {
    try {
      const response = await fetch(`${this.baseUrl}/api/ml/retrain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model_type: modelType }),
      });

      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('Retrain error:', error.message);
      return null;
    }
  }

  fallbackRiskCalculation(payload) {
    // Rules-based fallback when ML service is unavailable
    const rainFactor = Math.min(payload.weather?.rain_probability || 0, 100) / 100;
    const aqiFactor = Math.min(payload.weather?.aqi || 100, 500) / 500;
    const tempFactor = Math.min(payload.weather?.temperature || 25, 50) / 50;

    const riskScore = Math.min((rainFactor * 0.5 + aqiFactor * 0.3 + tempFactor * 0.2), 1);
    const riskLevel = riskScore > 0.7 ? 'HIGH' : riskScore > 0.4 ? 'MEDIUM' : 'LOW';

    return {
      risk_score: Number(riskScore.toFixed(2)),
      risk_level: riskLevel,
      confidence: 'low',
      source: 'fallback-rules',
    };
  }

  async healthCheck() {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export default MLServiceClient;
