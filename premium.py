"""Premium plans and Razorpay checkout for Nexora AI.

Configure RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET
in the hosting environment. Never expose the secret key to the browser.
"""
import hashlib
import hmac
import os
from datetime import date, datetime, timedelta

from flask import Blueprint, abort, current_app, jsonify, request
from flask_login import current_user, login_required
import razorpay

premium_bp = Blueprint("premium", __name__)
FREE_DAILY_LIMIT = 10
PREMIUM_PRICE_INR = 199
PREMIUM_DAYS = 30

db = None
Plan = None
Usage = None
Payment = None


def _client():
    key_id = os.getenv("RAZORPAY_KEY_ID")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET")
    if not key_id or not key_secret:
        raise RuntimeError("Razorpay is not configured.")
    return razorpay.Client(auth=(key_id, key_secret))


def init_premium(app, database, User):
    """Register premium database models and create their tables."""
    global db, Plan, Usage, Payment
    db = database

    class PremiumPlan(db.Model):
        __tablename__ = "premium_plan"
        id = db.Column(db.Integer, primary_key=True)
        user_id = db.Column(db.Integer, db.ForeignKey("user.id"), unique=True, nullable=False)
        expires_at = db.Column(db.DateTime, nullable=False)

    class UsageModel(db.Model):
        __tablename__ = "mentor_daily_usage"
        id = db.Column(db.Integer, primary_key=True)
        user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
        day = db.Column(db.Date, nullable=False, default=date.today, index=True)
        count = db.Column(db.Integer, nullable=False, default=0)
        __table_args__ = (db.UniqueConstraint("user_id", "day", name="uq_mentor_usage_user_day"),)

    class PaymentModel(db.Model):
        __tablename__ = "premium_payment"
        id = db.Column(db.Integer, primary_key=True)
        user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
        order_id = db.Column(db.String(100), unique=True, nullable=False)
        payment_id = db.Column(db.String(100), unique=True, nullable=True)
        status = db.Column(db.String(20), nullable=False, default="created")
        created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    Plan, Usage, Payment = PremiumPlan, UsageModel, PaymentModel
    with app.app_context():
        db.create_all()


def is_premium(user):
    if not user or not getattr(user, "is_authenticated", False):
        return False
    plan = Plan.query.filter_by(user_id=user.id).first()
    return bool(plan and plan.expires_at and plan.expires_at > datetime.utcnow())


def check_and_count_usage(user):
    """Atomically reserve one of the user's 10 free AI requests for today."""
    if is_premium(user):
        return True, ""
    today = date.today()
    try:
        row = Usage.query.filter_by(user_id=user.id, day=today).with_for_update().first()
        if row is None:
            row = Usage(user_id=user.id, day=today, count=0)
            db.session.add(row)
            db.session.flush()
        if row.count >= FREE_DAILY_LIMIT:
            db.session.rollback()
            return False, f"Free limit ({FREE_DAILY_LIMIT}/day) reached. Upgrade for unlimited AI Mentor requests."
        row.count += 1
        db.session.commit()
        return True, ""
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Could not record AI mentor usage")
        return False, "Usage tracking is temporarily unavailable. Please try again shortly."


def _activate(user_id):
    plan = Plan.query.filter_by(user_id=user_id).first()
    now = datetime.utcnow()
    start = max(now, plan.expires_at) if plan and plan.expires_at else now
    if plan is None:
        plan = Plan(user_id=user_id, expires_at=start + timedelta(days=PREMIUM_DAYS))
        db.session.add(plan)
    else:
        plan.expires_at = start + timedelta(days=PREMIUM_DAYS)


@premium_bp.get("/premium/status")
@login_required
def status():
    row = Usage.query.filter_by(user_id=current_user.id, day=date.today()).first()
    return jsonify(
        premium=is_premium(current_user),
        used_today=row.count if row else 0,
        daily_limit=FREE_DAILY_LIMIT,
        price_inr=PREMIUM_PRICE_INR,
        premium_days=PREMIUM_DAYS,
    )


@premium_bp.post("/premium/create-order")
@login_required
def create_order():
    try:
        client = _client()
        order = client.order.create({
            "amount": PREMIUM_PRICE_INR * 100,
            "currency": "INR",
            "receipt": f"nexora-u{current_user.id}-{int(datetime.utcnow().timestamp())}",
            "notes": {"user_id": str(current_user.id), "plan": "premium-30d"},
        })
    except Exception:
        current_app.logger.exception("Razorpay order creation failed")
        return jsonify(error="Checkout is temporarily unavailable. Please try again later."), 503

    payment = Payment(user_id=current_user.id, order_id=order["id"], status="created")
    try:
        db.session.add(payment)
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Could not store Razorpay order")
        return jsonify(error="Could not start checkout. Please try again."), 500
    return jsonify(order_id=order["id"], amount=order["amount"], currency="INR",
                   key=os.environ["RAZORPAY_KEY_ID"], name="Nexora AI",
                   description="Premium AI Mentor · 30 days")


@premium_bp.post("/premium/verify")
@login_required
def verify():
    data = request.get_json(silent=True) or {}
    order_id = data.get("razorpay_order_id")
    payment_id = data.get("razorpay_payment_id")
    signature = data.get("razorpay_signature")
    if not all(isinstance(value, str) and value for value in (order_id, payment_id, signature)):
        return jsonify(ok=False, error="Missing payment verification details."), 400

    payment = Payment.query.filter_by(order_id=order_id, user_id=current_user.id).first()
    if not payment:
        return jsonify(ok=False, error="Payment order was not found for this account."), 404
    if payment.status == "paid" and payment.payment_id == payment_id:
        return jsonify(ok=True, premium=True)

    try:
        client = _client()
        client.utility.verify_payment_signature({
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": signature,
        })
        payment_details = client.payment.fetch(payment_id)
        if payment_details.get("order_id") != order_id or payment_details.get("status") != "captured":
            return jsonify(ok=False, error="Payment has not been captured yet. Please wait and refresh status."), 409
    except razorpay.errors.SignatureVerificationError:
        return jsonify(ok=False, error="Payment signature verification failed."), 400
    except Exception:
        current_app.logger.exception("Razorpay payment verification failed")
        return jsonify(ok=False, error="Could not verify payment right now. Please try again."), 503

    try:
        payment.status = "paid"
        payment.payment_id = payment_id
        _activate(current_user.id)
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Could not activate premium after payment")
        return jsonify(ok=False, error="Payment was verified but plan activation failed. Contact support with your payment ID."), 500
    return jsonify(ok=True, premium=True)


@premium_bp.post("/razorpay/webhook")
def webhook():
    secret = os.getenv("RAZORPAY_WEBHOOK_SECRET")
    signature = request.headers.get("X-Razorpay-Signature", "")
    body = request.get_data()
    if not secret:
        return jsonify(error="Webhook is not configured."), 503
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        abort(400)

    event = request.get_json(silent=True) or {}
    if event.get("event") == "payment.captured":
        entity = event.get("payload", {}).get("payment", {}).get("entity", {})
        order_id = entity.get("order_id")
        payment_id = entity.get("id")
        if order_id and payment_id:
            payment = Payment.query.filter_by(order_id=order_id).first()
            if payment and payment.status != "paid":
                try:
                    details = _client().payment.fetch(payment_id)
                    if details.get("order_id") == order_id and details.get("status") == "captured":
                        payment.status = "paid"
                        payment.payment_id = payment_id
                        _activate(payment.user_id)
                        db.session.commit()
                except Exception:
                    db.session.rollback()
                    current_app.logger.exception("Razorpay webhook processing failed")
                    return jsonify(error="Webhook processing failed; Razorpay may retry."), 500
    return "", 200
