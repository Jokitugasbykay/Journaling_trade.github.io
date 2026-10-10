from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Filters(Input):
    account_id: UUID | None = None
    strategy_id: UUID | None = None
    start: date | None = None
    end: date | None = None
    tz: str = "UTC"

    @field_validator("tz")
    @classmethod
    def timezone(cls, value):
        try:
            ZoneInfo(value)
        except (ValueError, ZoneInfoNotFoundError) as exc:
            raise ValueError("Use an IANA timezone") from exc
        return value

    @model_validator(mode="after")
    def dates(self):
        if self.start and self.end and self.start > self.end:
            raise ValueError("Start date must be before end date")
        return self


class Strategy(Input):
    name: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=4000)


class MarketPreference(Input):
    trading_style: Literal["SCALPING", "INTRADAY", "SWING"]


class NotificationPreference(Input):
    browser_notifications: bool


class SignalAction(Input):
    job_id: UUID
    direction: Literal["BUY", "SELL"]
    action: Literal["watch", "take", "dismiss"]
    mode: Literal["actual", "paper"] | None = None


class ExecutionConfirmation(Input):
    price: Decimal = Field(gt=0, lt=1e24, allow_inf_nan=False)
    executed_at: datetime

    @field_validator("executed_at")
    @classmethod
    def aware_time(cls, value):
        if value.tzinfo is None:
            raise ValueError("Execution timestamp requires a timezone")
        return value


class AlertChange(Input):
    enabled: bool
    trigger_price: Decimal | None = Field(default=None, gt=0, lt=1e24, allow_inf_nan=False)


class RiskRule(Input):
    name: str = Field(min_length=1, max_length=160)
    kind: Literal["max_risk_percent", "max_daily_loss", "max_weekly_loss", "max_trades_per_day"]
    threshold: Decimal = Field(gt=0, lt=1_000_000_000_000, allow_inf_nan=False)
    enabled: bool = True

    @model_validator(mode="after")
    def rule_threshold(self):
        if self.kind == "max_risk_percent" and self.threshold > 100:
            raise ValueError("Risk percentage must not exceed 100")
        if self.kind == "max_trades_per_day" and self.threshold != self.threshold.to_integral_value():
            raise ValueError("Trade-count limit must be an integer")
        return self


class Position(Input):
    instrument: str | None = Field(default=None, max_length=30)
    balance: Decimal = Field(gt=0, allow_inf_nan=False)
    risk_percent: Decimal = Field(gt=0, le=100, allow_inf_nan=False)
    entry: Decimal = Field(gt=0, allow_inf_nan=False)
    stop: Decimal = Field(gt=0, allow_inf_nan=False)
    contract_size: Decimal = Field(gt=0, allow_inf_nan=False)
    quantity_step: Decimal = Field(gt=0, allow_inf_nan=False)
    quote_to_account_rate: Decimal = Field(gt=0, allow_inf_nan=False)


class Review(Filters):
    period: Literal["weekly", "monthly"] = "weekly"
    start: date

    @model_validator(mode="after")
    def period_dates(self):
        from datetime import timedelta
        if self.period == "weekly":
            self.start -= timedelta(days=self.start.weekday())
            self.end = self.start + timedelta(days=6)
        else:
            self.start = self.start.replace(day=1)
            self.end = (self.start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
        return self


class Report(Filters):
    sections: list[Literal["analytics", "heatmap", "risk", "reviews"]] = Field(default_factory=lambda: ["analytics"], min_length=1, max_length=4)


class Analysis(Filters):
    trading_style: Literal["SCALPING", "INTRADAY", "SWING"] | None = None
    instrument: str | None = Field(default=None, pattern=r"^[A-Z0-9_]{1,30}$")
    timeframe: Literal["1m", "5m", "15m", "30m", "1h", "4h", "1d"] | None = None
    analysis_type: Literal["performance", "strategy", "risk", "consistency", "review"] = "performance"


class ImportTrade(Input):
    id: UUID = Field(default_factory=uuid4)
    account_id: UUID
    strategy_id: UUID | None = None
    symbol: str = Field(min_length=1, max_length=60)
    market: str | None = Field(default=None, max_length=60)
    side: Literal["long", "short"]
    status: Literal["closed"] = "closed"
    opened_at: datetime
    closed_at: datetime | None = None
    entry_price: Decimal | None = Field(default=None, gt=0, allow_inf_nan=False)
    exit_price: Decimal | None = Field(default=None, gt=0, allow_inf_nan=False)
    stop_loss: Decimal | None = Field(default=None, gt=0, allow_inf_nan=False)
    take_profit: Decimal | None = Field(default=None, gt=0, allow_inf_nan=False)
    quantity: Decimal | None = Field(default=None, gt=0, allow_inf_nan=False)
    pnl: Decimal | None = Field(default=None, allow_inf_nan=False)
    risk_percent: Decimal | None = Field(default=None, ge=0, le=100, allow_inf_nan=False)
    notes: str | None = Field(default=None, max_length=10000)
    tags: list[str] = Field(default_factory=list, max_length=30)

    @model_validator(mode="after")
    def times(self):
        if self.opened_at.tzinfo is None or self.closed_at and (self.closed_at.tzinfo is None or self.closed_at < self.opened_at):
            raise ValueError("Trade timestamps must be timezone aware and ordered")
        if any(len(tag) > 60 for tag in self.tags):
            raise ValueError("Tag too long")
        return self


class Import(Input):
    trades: list[ImportTrade] = Field(min_length=1, max_length=500)
    file_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    storage_path: str = Field(min_length=80, max_length=120)
    confirmed: Literal[True]


class Observation(Input):
    text: str = Field(min_length=1, max_length=1200)
    evidence_ids: list[str] = Field(min_length=1, max_length=50)


class Explanation(Input):
    observations: list[Observation] = Field(min_length=1, max_length=20)
    interpretations: list[Observation] = Field(default_factory=list, max_length=20)
    improvement_priorities: list[Observation] = Field(default_factory=list, max_length=20)
    market_outcome: Literal["Bullish", "Bearish", "Neutral", "No Trade", "Insufficient Data"] | None = None
    alternative_scenarios: list[Observation] = Field(default_factory=list, max_length=10)
    invalidation_conditions: list[Observation] = Field(default_factory=list, max_length=10)
    risk_considerations: list[Observation] = Field(default_factory=list, max_length=10)


class MarketSignal(Input):
    direction: Literal["BUY", "SELL", "NEUTRAL", "NO TRADE"]
    bias: Literal["BUY", "SELL", "NEUTRAL"]
    status: Literal["INSUFFICIENT DATA", "WAITING FOR CONFIRMATION", "CONDITIONAL SETUP"]
    entry: Decimal | None = Field(default=None, gt=0, allow_inf_nan=False)
    stop_loss: Decimal | None = Field(default=None, gt=0, allow_inf_nan=False)
    take_profit: Decimal | None = Field(default=None, gt=0, allow_inf_nan=False)
    risk_reward: Decimal | None = Field(default=None, gt=0, allow_inf_nan=False)
    analysis_horizon: str
    confirmations: list[str]
    invalidation_conditions: list[str]
    timestamp: datetime

    @model_validator(mode="after")
    def valid_levels(self):
        values = (self.entry, self.stop_loss, self.take_profit, self.risk_reward)
        if self.timestamp.tzinfo is None:
            raise ValueError("Signal timestamp needs timezone")
        if self.direction in ("BUY", "SELL"):
            if any(value is None for value in values) or len(self.confirmations) < 3 or self.status != "CONDITIONAL SETUP":
                raise ValueError("Trade signal needs levels and three confirmations")
            ordered = self.stop_loss < self.entry < self.take_profit if self.direction == "BUY" else self.take_profit < self.entry < self.stop_loss
            if not ordered or self.risk_reward != abs(self.take_profit - self.entry) / abs(self.entry - self.stop_loss):
                raise ValueError("Invalid trade levels or risk reward")
        elif any(value is not None for value in values):
            raise ValueError("No-trade assessment cannot carry trade levels")
        return self
