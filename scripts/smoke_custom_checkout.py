"""Opt-in sandbox-only checks using an explicitly provisioned disposable Auth user.

No customer credentials; no production endpoints; no settlement or subscription activation.
"""
import json
import os
from pathlib import Path
from uuid import uuid4

import httpx

PROJECT = "https://nmddjuqkdyhcobddinkc.supabase.co"
PUBLIC_KEY = "sb_publishable_8MdtL4bDt-4dn2gh5-M8hg_TjDEGATj"


def main():
    user = json.loads(Path(os.environ["JT_CHECKOUT_SMOKE_CREDENTIALS"]).read_text(encoding="utf-8"))
    assert user["email"].startswith("checkout-smoke-") and user["email"].endswith("@example.invalid")
    with httpx.Client(timeout=40) as client:
        login = client.post(PROJECT + "/auth/v1/token?grant_type=password", headers={"apikey": PUBLIC_KEY},
                            json={"email": user["email"], "password": user["password"]})
        assert login.status_code == 200, f"Disposable Auth login failed: {login.status_code}"
        token = login.json()["access_token"]
        headers = {"Authorization": "Bearer " + token, "Origin": "https://jokitugasbykay.github.io"}
        config = {"plan": "pro", "interval": "monthly", "billing": {"name": "Checkout sandbox test", "country": "ID"}}

        def send(action, key=None, **extra):
            response = client.post(PROJECT + "/functions/v1/midtrans-custom-checkout",
                                   headers={**headers, "Idempotency-Key": key or str(uuid4())},
                                   json={**config, "action": action, **extra})
            assert response.status_code == 200, f"{action} failed ({response.status_code}): {response.json().get('detail', 'unavailable')}"
            data = response.json()
            assert data["environment"] == "sandbox"
            return data

        try:
            quote = send("quote")
            assert quote["quote"]["amount"] == 355200
            key = str(uuid4())
            bank = send("charge", key, payment_method="bca")
            assert bank["status"] == "pending" and bank["bank"] == "bca" and bank["va_number"].isdigit()
            retry = send("charge", key, payment_method="bca")
            assert retry["order_id"] == bank["order_id"]
            status = send("status", order_id=bank["order_id"])
            assert status["status"] == "pending" and status["amount"] == 355200
            print("Hosted sandbox Auth, quote, BCA VA, idempotent retry and status passed.")
            qr = send("charge", payment_method="qris")
            assert qr["status"] == "pending" and qr["qr_url"].startswith("https://api.")
            image = client.get(qr["qr_url"])
            assert image.status_code == 200 and image.headers.get("content-type", "").startswith("image/")
            print("Hosted sandbox QRIS creation and actual QR image retrieval passed.")
            print("No settlement, refund or live-money transaction was performed.")
        finally:
            client.post(PROJECT + "/auth/v1/logout?scope=global", headers={"apikey": PUBLIC_KEY, "Authorization": "Bearer " + token})


if __name__ == "__main__":
    main()
