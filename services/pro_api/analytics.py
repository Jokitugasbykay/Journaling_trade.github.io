"""Deterministic calculations; decimal money, UTC storage and IANA display zones."""
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from math import sqrt
from statistics import pstdev
from zoneinfo import ZoneInfo


def number(value, default=None):
    if value is None or value == "":
        return default
    try:
        result = Decimal(str(value))
        if not result.is_finite():
            raise ValueError("Non-finite financial value")
        return result
    except InvalidOperation as exc:
        raise ValueError("Invalid financial value") from exc


def timestamp(value):
    if not value:
        return None
    result = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if result.tzinfo is None:
        raise ValueError("A timestamp must include its timezone")
    return result.astimezone(timezone.utc)


def wire(value):
    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: wire(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [wire(item) for item in value]
    return value


def fees(trade):
    return sum((number(trade.get(key), Decimal(0)) for key in
                ("fees", "commission", "spread_cost", "slippage_cost", "swap", "financing_fee")), Decimal(0))


def realized(trade, executions):
    """Broker net PnL wins; otherwise require explicit contract/FX specifications."""
    reported = number(trade.get("pnl"))
    if reported is not None:
        return reported if trade.get("pnl_is_net", True) else reported - fees(trade)
    contract = number(trade.get("contract_size"))
    fx = number(trade.get("fx_rate"))
    if not contract or not fx or contract <= 0 or fx <= 0:
        return None
    direction = Decimal(-1 if trade.get("side") == "short" else 1)
    if executions:
        lots, profit = [], Decimal(0)
        for execution in sorted(executions, key=lambda item: timestamp(item["executed_at"])):
            quantity, price = number(execution["quantity"]), number(execution["price"])
            commission = number(execution.get("commission"), Decimal(0))
            if quantity <= 0 or price <= 0 or commission < 0:
                raise ValueError("Invalid execution")
            if execution["side"] == "open":
                lots.append([quantity, price, commission / quantity])
                continue
            remaining = quantity
            close_fx = number(execution.get("fx_rate"), fx)
            if close_fx <= 0:
                raise ValueError("Invalid execution FX rate")
            while remaining > 0 and lots:
                size = min(remaining, lots[0][0])
                profit += direction * (price - lots[0][1]) * size * contract * close_fx
                profit -= lots[0][2] * size + commission * size / quantity
                remaining -= size
                lots[0][0] -= size
                if lots[0][0] == 0:
                    lots.pop(0)
            if remaining:
                raise ValueError("Exit quantity exceeds recorded entries")
        return profit - fees(trade)
    entry, exit_price, quantity = (number(trade.get(key)) for key in
                                   ("entry_price", "exit_price", "quantity"))
    if entry is None or exit_price is None or quantity is None:
        return None
    if min(entry, exit_price, quantity) <= 0:
        raise ValueError("Invalid prices or quantity")
    return direction * (exit_price - entry) * quantity * contract * fx - fees(trade)


def trading_session(moment):
    for label, zone, start, end in (
        ("New York", "America/New_York", 9.5, 16),
        ("London", "Europe/London", 8, 16.5),
        ("Asia", "Asia/Tokyo", 9, 15),
    ):
        local = moment.astimezone(ZoneInfo(zone))
        if local.weekday() < 5 and start <= local.hour + local.minute / 60 < end:
            return label
    return "Outside sessions"


def records(trades, accounts, executions=(), start=None, end=None, tz="UTC", account_id=None, strategy_id=None):
    zone = ZoneInfo(tz)
    account_map = {str(account["id"]): account for account in accounts}
    execution_map = defaultdict(list)
    for item in executions:
        execution_map[str(item["trade_id"])].append(item)
    result, warnings = [], []
    for trade in trades:
        if account_id and str(trade.get("account_id")) != str(account_id):
            continue
        if strategy_id and str(trade.get("strategy_id")) != str(strategy_id):
            continue
        if trade.get("status") != "closed":
            continue
        moment = timestamp(trade.get("closed_at") or trade.get("opened_at"))
        if moment is None:
            warnings.append(f"Trade {trade['id']} has no timestamp and was excluded.")
            continue
        local = moment.astimezone(zone)
        if start and local.date() < start or end and local.date() > end:
            continue
        pnl = realized(trade, execution_map[str(trade["id"])])
        if pnl is None:
            warnings.append(f"Trade {trade['id']} lacks net PnL or contract/FX data and was excluded.")
            continue
        account = account_map.get(str(trade.get("account_id")), {})
        currency = trade.get("account_currency") or account.get("currency") or "UNKNOWN"
        entry, stop, target = (number(trade.get(key)) for key in ("entry_price", "stop_loss", "take_profit"))
        rr = abs((target - entry) / (entry - stop)) if None not in (entry, stop, target) and entry != stop else None
        result.append({**trade, "net_pnl": pnl, "moment": moment, "date": local.date(),
                       "hour": local.hour, "weekday": local.strftime("%A"),
                       "session": trading_session(moment), "rr": rr, "currency": currency})
        if not trade.get("closed_at"):
            warnings.append("Some trades have no close timestamp; their recorded opening timestamp is used.")
    result.sort(key=lambda row: (row["moment"], str(row["id"])))
    currencies = {row["currency"] for row in result}
    if len(currencies) > 1:
        raise ValueError("Select one account: mixed account currencies cannot be combined without timestamped conversions")
    return result, sorted(set(warnings))


def overview(rows, initial_balance=Decimal(0), strategies=(), warnings=()):
    pnls = [row["net_pnl"] for row in rows]
    wins, losses = [p for p in pnls if p > 0], [p for p in pnls if p < 0]
    total = sum(pnls, Decimal(0))
    balance, peak, maximum, curve = initial_balance, initial_balance, Decimal(0), []
    max_percent = Decimal(0) if initial_balance > 0 else None
    for row in rows:
        balance += row["net_pnl"]
        peak = max(peak, balance)
        drawdown = peak - balance
        maximum = max(maximum, drawdown)
        if peak > 0:
            pct = drawdown / peak * 100
            max_percent = max(max_percent or Decimal(0), pct)
        curve.append({"date": row["moment"], "trade_id": row["id"], "pnl": row["net_pnl"],
                      "equity": balance, "drawdown": drawdown})
    rr = [row["rr"] for row in rows if row["rr"] is not None]
    metrics = {"expectancy": total / len(rows) if rows else None,
               "profit_factor": sum(wins, Decimal(0)) / abs(sum(losses)) if losses else None,
               "maximum_drawdown": maximum, "maximum_drawdown_percent": max_percent,
               "average_risk_reward": sum(rr) / len(rr) if rr else None,
               "win_rate": Decimal(len(wins)) / len(rows) * 100 if rows else None,
               "trade_count": len(rows), "net_pnl": total,
               "average_win": sum(wins) / len(wins) if wins else None,
               "average_loss": sum(losses) / len(losses) if losses else None,
               "consistency": str(pstdev([float(p) for p in pnls])) if len(rows) > 1 else None}
    strategy_names = {str(item["id"]): item["name"] for item in strategies}
    groups = {}
    for group, field in (("instrument", "symbol"), ("strategy", "strategy_id"),
                         ("weekday", "weekday"), ("hour", "hour"), ("session", "session")):
        collected = defaultdict(list)
        for row in rows:
            label = strategy_names.get(str(row.get(field)), "Unassigned") if group == "strategy" else str(row.get(field, "Unknown"))
            collected[label].append(row)
        groups[group] = [group_summary(label, entries) for label, entries in collected.items()]
    return wire({"metrics": metrics, "equity": curve, "groups": groups,
                 "distribution": {"wins": len(wins), "losses": len(losses), "breakeven": pnls.count(Decimal(0))},
                 "warnings": list(warnings) + (["Profit factor is undefined without losing trades."] if rows and not losses else []),
                 "currency": rows[0]["currency"] if rows else None})


def group_summary(label, rows):
    return {"label": label, "trade_count": len(rows), "trade_ids": [str(row["id"]) for row in rows],
            "net_pnl": sum((row["net_pnl"] for row in rows), Decimal(0)),
            "win_rate": Decimal(sum(row["net_pnl"] > 0 for row in rows)) / len(rows) * 100 if rows else None}


def heatmap(rows, year):
    collected = defaultdict(list)
    for row in rows:
        if row["date"].year == year:
            collected[row["date"]].append(row)
    days, day = [], date(year, 1, 1)
    while day.year == year:
        entries = collected[day]
        pnl = sum((row["net_pnl"] for row in entries), Decimal(0))
        state = "no_activity" if not entries else "positive" if pnl > 0 else "negative" if pnl < 0 else "zero"
        days.append({"date": day, "pnl": pnl if entries else None, "trade_count": len(entries), "state": state,
                     "trade_ids": [str(row["id"]) for row in entries]})
        day += timedelta(days=1)
    output = {"year": year, "days": days, "currency": rows[0]["currency"] if rows else None}
    for key, field in (("months", "month"), ("hours", "hour"), ("sessions", "session")):
        grouped = defaultdict(list)
        for row in rows:
            if row["date"].year == year:
                grouped[str(row["date"].month if field == "month" else row[field])].append(row)
        output[key] = [group_summary(label, entries) for label, entries in grouped.items()]
    return wire(output)


def position_size(balance, risk_percent, entry, stop, contract_size, quantity_step, quote_to_account_rate):
    values = [number(value) for value in (balance, risk_percent, entry, stop, contract_size, quantity_step, quote_to_account_rate)]
    if any(value is None or value <= 0 for value in values) or values[1] > 100 or values[2] == values[3]:
        raise ValueError("Positive balance, prices, explicit contract/FX specifications and distinct stop are required")
    balance, risk, entry, stop, contract, step, fx = values
    budget = balance * risk / 100
    per_unit = abs(entry - stop) * contract * fx
    quantity = (budget / per_unit // step) * step
    if quantity <= 0:
        raise ValueError("Risk budget is smaller than the minimum position step")
    return wire({"quantity": quantity, "risk_budget": budget, "estimated_loss": quantity * per_unit,
                 "assumptions": {"contract_size": contract, "quantity_step": step, "quote_to_account_rate": fx,
                                 "fees_included": False, "slippage_included": False}})


def open_exposure(trades, tz="UTC", now=None):
    today = (now or datetime.now(timezone.utc)).astimezone(ZoneInfo(tz)).date()
    monday = today - timedelta(days=today.weekday())
    daily, weekly, total, unknown = Decimal(0), Decimal(0), Decimal(0), 0
    for trade in trades:
        if trade.get("status") != "open":
            continue
        amount = number(trade.get("risk_amount"))
        if amount is None:
            values = [number(trade.get(key)) for key in ("entry_price", "stop_loss", "quantity", "contract_size", "fx_rate")]
            if any(value is None or value <= 0 for value in values):
                unknown += 1
                continue
            entry, stop, quantity, contract, fx = values
            amount = abs(entry - stop) * quantity * contract * fx
        if amount < 0:
            raise ValueError("Invalid open-position risk")
        total += amount
        moment = timestamp(trade.get("opened_at"))
        if moment:
            day = moment.astimezone(ZoneInfo(tz)).date()
            if day == today:
                daily += amount
            if monday <= day <= today:
                weekly += amount
    return wire({"daily_exposure": daily if not unknown else None, "weekly_exposure": weekly if not unknown else None,
                 "open_exposure": total if not unknown else None, "unknown_positions": unknown})


def risk_analysis(rows, rules):
    day_rows, week_rows = defaultdict(list), defaultdict(list)
    for row in rows:
        day_rows[row["date"]].append(row)
        week_rows[row["date"] - timedelta(days=row["date"].weekday())].append(row)
    violations, checks = [], defaultdict(lambda: {"checked": 0, "violations": 0})
    for rule in rules:
        if not rule.get("enabled", True):
            continue
        threshold = number(rule["threshold"])
        kind = rule["kind"]
        for row in rows:
            checks[row["date"]]["checked"] += 1
            if kind == "max_risk_percent":
                observed = number(row.get("risk_percent"))
            elif kind == "max_trades_per_day":
                observed = Decimal(len(day_rows[row["date"]]))
            elif kind == "max_daily_loss":
                observed = max(Decimal(0), -sum(item["net_pnl"] for item in day_rows[row["date"]]))
            elif kind == "max_weekly_loss":
                observed = max(Decimal(0), -sum(item["net_pnl"] for item in week_rows[row["date"] - timedelta(days=row["date"].weekday())]))
            else:
                raise ValueError("Unsupported risk rule")
            if observed is not None and observed > threshold:
                violations.append({"trade_id": row["id"], "rule_id": rule["id"], "date": row["date"],
                                   "observed": observed, "threshold": threshold, "kind": kind})
                checks[row["date"]]["violations"] += 1
    recorded_risks = [number(row.get("risk_percent")) for row in rows if number(row.get("risk_percent")) is not None]
    latest = rows[-1]["date"] if rows else None
    return wire({"overview": {"risk_per_trade": sum(recorded_risks) / len(recorded_risks) if recorded_risks else None,
                               "daily_exposure": None, "weekly_exposure": None},
                 "rules": rules, "violations": violations,
                 "compliance": [{"date": day, **count} for day, count in sorted(checks.items())],
                 "warnings": ["Closed trades do not establish current open exposure. Exposure requires open positions with complete risk specifications."]})


def review(rows, previous_rows, initial_balance, strategies, rules):
    current = overview(rows, initial_balance, strategies)
    previous = overview(previous_rows, initial_balance, strategies)
    risk = risk_analysis(rows, rules)
    priorities = []
    if risk["violations"]:
        priorities.append({"text": "Review trades that exceeded your recorded risk rules.",
                           "evidence_ids": sorted(set(item["trade_id"] for item in risk["violations"]))})
    if len(rows) < 30:
        priorities.append({"text": "This period has fewer than 30 closed trades; avoid drawing strong strategy conclusions.",
                           "evidence_ids": [row["id"] for row in rows]})
    return {"performance": current, "previous_period": previous, "risk": risk,
            "improvement_priorities": priorities, "evidence_ids": [row["id"] for row in rows]}
