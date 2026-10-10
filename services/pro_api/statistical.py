"""A transparent rolling OLS baseline, distinct from LLM explanation and indicators."""
from decimal import Decimal
from math import sqrt


def fitted_next(prices):
    count = len(prices)
    average_x = Decimal(count - 1) / 2
    average_y = sum(prices) / count
    variance_x = sum((Decimal(i) - average_x) ** 2 for i in range(count))
    slope = sum((Decimal(i) - average_x) * (price - average_y) for i, price in enumerate(prices)) / variance_x
    return average_y + slope * (Decimal(count) - average_x)


def forecast(candles):
    prices = [c.close for c in candles]
    if len(prices) < 151:
        return {"status": "insufficient_data", "minimum_bars": 151, "available_bars": len(prices)}
    errors, directional = [], []
    for i in range(50, len(prices)):
        prediction = fitted_next(prices[i - 50:i])
        errors.append(prediction - prices[i])
        directional.append((prediction > prices[i - 1]) == (prices[i] > prices[i - 1]))
    prediction = fitted_next(prices[-50:])
    if prediction <= 0:
        return {"status": "invalid_projection", "model_version": "rolling-ols-price50-v1"}
    return {"status": "baseline_only", "model_version": "rolling-ols-price50-v1", "analysis_horizon": "one bar",
            "projected_close": str(prediction), "walk_forward_samples": len(errors),
            "walk_forward_mae": str(sum(abs(error) for error in errors) / len(errors)),
            "walk_forward_rmse": str(sqrt(float(sum(error ** 2 for error in errors) / len(errors)))),
            "directional_correct_count": sum(directional),
            "warning": "An unvalidated OLS baseline, not a trading recommendation. Backtest error is not confidence and does not guarantee future results."}
