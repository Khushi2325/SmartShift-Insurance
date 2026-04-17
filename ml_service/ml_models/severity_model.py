"""Compatibility wrapper for the severity predictor.

The severity model implementation lives in `fraud_model.py`, but `app.py`
imports it from `ml_models.severity_model`. This module keeps that import path
working without duplicating logic.
"""

from ml_models.fraud_model import SeverityPredictor

__all__ = ["SeverityPredictor"]