from http.server import BaseHTTPRequestHandler
import json
import math
from datetime import datetime

# Lightweight ML Model - No heavy dependencies (Vercel-compatible)
# Risk prediction with SHAP-style explanations

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        """Handle POST requests for ML predictions"""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))

            features = {
                'rain': float(data.get('rain', 0)),
                'rain_prob': float(data.get('rain_prob', 0)),
                'wind': float(data.get('wind', 0)),
                'temperature': float(data.get('temperature', 25)),
                'aqi': float(data.get('aqi', 100)),
                'traffic_delay': float(data.get('traffic_delay', 0)),
                'hour': int(data.get('hour', 12)),
            }

            result = predict_risk(features)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode('utf-8'))

        except Exception as e:
            self.send_response(400)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))

    def do_GET(self):
        """Health check endpoint"""
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        response = {
            'status': 'ok',
            'service': 'SmartShift ML Engine',
            'version': '1.0.0'
        }
        self.wfile.write(json.dumps(response).encode('utf-8'))

    def do_OPTIONS(self):
        """CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()


def sigmoid(x):
    """Sigmoid activation function (no numpy needed)"""
    try:
        return 1 / (1 + math.exp(-x))
    except:
        return 0.5


def predict_risk(features):
    """Predict risk with explanations"""
    try:
        risk_prob = calculate_risk_probability(features)
        
        if risk_prob < 0.3:
            risk_level = 'LOW'
        elif risk_prob < 0.6:
            risk_level = 'MEDIUM'
        else:
            risk_level = 'HIGH'

        explanation = generate_explanations(features, risk_prob)

        return {
            'risk_probability': round(risk_prob, 3),
            'risk_level': risk_level,
            'confidence': 'HIGH' if risk_prob > 0.7 else 'MEDIUM' if risk_prob > 0.3 else 'HIGH',
            'explanation': explanation,
            'model': 'Lightweight ML Engine',
            'timestamp': datetime.utcnow().isoformat() + 'Z',
        }
    except Exception as e:
        return {
            'risk_probability': 0.5,
            'risk_level': 'MEDIUM',
            'confidence': 'LOW',
            'explanation': [{'factor': 'Error', 'status': 'Fallback Mode'}],
            'error': str(e),
        }


def calculate_risk_probability(features):
    """Calculate risk using weighted features"""
    rain = features.get('rain', 0)
    rain_prob = features.get('rain_prob', 0)
    wind = features.get('wind', 0)
    temp = features.get('temperature', 25)
    aqi = features.get('aqi', 100)
    traffic = features.get('traffic_delay', 0)
    hour = features.get('hour', 12)

    # Normalize features (0-1)
    rain_norm = min(rain / 50, 1.0)
    rain_prob_norm = rain_prob / 100
    wind_norm = min(wind / 30, 1.0)
    temp_norm = max(0, min((temp - 25) / 15, 1.0))
    aqi_norm = min(aqi / 500, 1.0)
    traffic_norm = min(traffic / 3, 1.0)

    # Peak hours (9-11 AM, 5-7 PM)
    hour_mult = 1.5 if hour in [9, 10, 17, 18] else 1.0

    # Weighted sum
    score = (
        0.35 * rain_norm +
        0.15 * rain_prob_norm +
        0.10 * wind_norm +
        0.15 * temp_norm +
        0.15 * aqi_norm +
        0.10 * traffic_norm
    ) * hour_mult

    # Sigmoid to probability
    prob = sigmoid((score - 0.5) * 5)
    return max(0, min(prob, 1.0))


def generate_explanations(features, risk_prob):
    """Generate top risk factors"""
    factors = []
    
    rain = features.get('rain', 0)
    if rain > 0:
        impact = 'High' if rain > 20 else 'Medium' if rain > 10 else 'Low'
        factors.append({
            'factor': 'Rainfall',
            'value': f'{rain:.1f}mm',
            'impact': impact,
            'status': 'ALERT' if impact == 'High' else 'WARNING' if impact == 'Medium' else 'OK',
            'contribution': min(rain / 100, 1.0),
        })
    
    aqi = features.get('aqi', 100)
    if aqi > 100:
        impact = 'High' if aqi > 300 else 'Medium' if aqi > 150 else 'Low'
        factors.append({
            'factor': 'Air Quality',
            'value': f'{int(aqi)}',
            'impact': impact,
            'status': 'ALERT' if impact == 'High' else 'WARNING' if impact == 'Medium' else 'OK',
            'contribution': min(aqi / 500, 1.0),
        })
    
    temp = features.get('temperature', 25)
    if temp > 32:
        impact = 'High' if temp > 38 else 'Medium'
        factors.append({
            'factor': 'Temperature',
            'value': f'{temp:.0f}°C',
            'impact': impact,
            'status': 'ALERT' if impact == 'High' else 'WARNING',
            'contribution': max(0, (temp - 25) / 30),
        })
    
    traffic = features.get('traffic_delay', 0)
    if traffic > 1.0:
        impact = 'High' if traffic > 2 else 'Medium'
        factors.append({
            'factor': 'Traffic Delay',
            'value': f'{traffic:.1f}x',
            'impact': impact,
            'status': 'ALERT' if impact == 'High' else 'WARNING',
            'contribution': min(traffic / 3, 1.0),
        })
    
    wind = features.get('wind', 0)
    if wind > 15:
        impact = 'High' if wind > 25 else 'Medium'
        factors.append({
            'factor': 'Wind Speed',
            'value': f'{wind:.0f}km/h',
            'impact': impact,
            'status': 'ALERT' if impact == 'High' else 'WARNING',
            'contribution': min(wind / 30, 1.0),
        })
    
    return factors[:5]  # Top 5
