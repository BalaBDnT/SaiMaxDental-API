import Razorpay from "razorpay";

export const instance = new Razorpay({
  key_id: process.env.RAZORPAY_API_KEY,
  key_secret: process.env.RAZORPAY_APT_SECRET,
});

// initilize razorpay
export const createOrder = async (amount) => {
  return await instance.orders.create({
    amount: amount * 100,
    currency: "INR",
    receipt: "order_rcptid_11",
  });
};