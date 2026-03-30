import crypto from "crypto";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import Razorpay from "razorpay";

dotenv.config();

const app = express();
const port = Number(process.env.PAYMENT_API_PORT || 5174);

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required in .env");
}

const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});

app.use(cors({ origin: true }));
app.use(express.json());

app.post("/api/payment/create-order", async (req, res) => {
  try {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const amountInPaise = Math.round(amount * 100);
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `smartshift_${Date.now()}`,
    });

    return res.json(order);
  } catch {
    return res.status(500).json({ error: "Failed to create payment order" });
  }
});

app.post("/api/payment/verify", async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ verified: false, error: "Missing payment verification fields" });
  }

  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  const verified = expectedSignature === razorpay_signature;

  if (!verified) {
    return res.status(400).json({ verified: false, error: "Signature mismatch" });
  }

  return res.json({ verified: true });
});

app.get("/api/payment/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`SmartShift payment API running on http://localhost:${port}`);
});
