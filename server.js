const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const morgan = require("morgan");
const cors = require("cors");
const { log } = require("console");

require("dotenv").config();

const app = express();
const PORT = process.env.PORT;

const fs = require("fs");
const path = require("path");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// const corsOptions = {
//   origin: "http://localhost:5173",
// };

// const corsOptions = {
//   origin: "https://www.saimaxdentalnfacialaesthetics.com",
//   optionsSuccessStatus: 200, // For legacy browser support
// };

app.use(
  cors({
    origin: "https://www.saimaxdentalnfacialaesthetics.com", // Replace with your domain
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"], // Specify allowed methods
    allowedHeaders: ["Content-Type", "Authorization"], // Specify allowed headers
  })
);
app.use(morgan("dev"));

// Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail", // You can use any email service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify Captcha

const verifyCaptcha = async (token) => {
  try {
    const response = await axios.post(
      "https://www.google.com/recaptcha/api/siteverify",
      null,
      {
        params: {
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: token,
        },
      }
    );

    return response.data.success;
  } catch (error) {
    console.error("Error during reCAPTCHA verification:", error);
    return false;
  }
};

function getparticipantTemplate(name) {
  return `
    <p>Dear ${name},</p>
    <p>Thank you for registering for the Biggest Implant Symposium in Nizamabad. We are delighted to have you join us for this premier event, where leading experts will share their knowledge and insights on the implants & practices.</p>
    <h2>Event Details:</h2>
    <ul>
      <li><b>Date:</b> 1 September 2024</li>
      <li><b>Time:</b> 10:00 AM – 4:00 PM</li>
      <li><b>Venue:</b> Hotel Krishna International, Nizamabad, Telangana 503001</li>
    </ul>
    <h2>Payment Confirmation:</h2>
    <p>We have received your payment of ₹599/- and your registration is confirmed. Please keep this email for your records.</p>
    <h2>Preparation Tips:</h2>
    <ol>
      <li>Arrive at the venue early to complete the registration process.</li>
      <li>Prepare any questions you may have for our expert speakers.</li>
    </ol>
    <h2>Contact Us:</h2>
    <p>If you have any questions or need further assistance, please do not hesitate to contact us at <a href="mailto:maxdentalimplantacademy@gmail.com">maxdentalimplantacademy@gmail.com</a> or call us at <b>+91 89715 69141</b> / <b>+91 79931 51604</b>.</p> <!-- Added mailto link and formatted phone numbers -->
    <p>We look forward to your participation and hope you find the symposium both informative and engaging.</p>
    
    
    <span>Best regards,</span> <br />
    <span>Max Dental Implant Academy</span> <br />
    <span>Nizamabad, Telangana</span>
  `;
}

function getHostTemplate(name, email, phone, amount, paymentId) {
  return `
    <p>Dear team,</p>
    <p>We are excited to inform you that a new participant has registered and completed the payment for the upcoming Biggest Implant Symposium in Nizamabad.</p>
    <h2>Participant Details:</h2>
    <ul>
      <li><b>Name:</b>${name}</li>
      <li><b>Email Id:</b> ${email}</li>
      <li><b>Phone No:</b>${phone}</li>
      <li><b>Payment Amount:</b>₹${amount}</li>
      <li><b>Payment ID:</b>${paymentId}</li>
    </ul>
    <h2>Next Steps:</h2>
    <ol>
      <li>Confirm the participant's registration and add them to the attendee list.</li>
      <li>Ensure they receive the welcome email with event details and preparation tips.</li>
      <li>Prepare any necessary materials or information that may be required by the participant.</li>
    </ol>
    <p>Thank you for your attention to this registration. We look forward to a successful event.</p>
    
    <span>Best regards,</span> <br />
    <span>Dr.Phanindra</span> <br />
    <span>Sai Max Dental</span>
  `;
}

// Create an order with Razorpay
app.post("/api/payment", async (req, res) => {
  try {
    const Amount = Number(process.env.AMOUNT * 100);

    const options = {
      amount: Amount,
      currency: "INR",
      receipt: crypto.randomBytes(10).toString("hex"),
    };

    razorpay.orders.create(options, (error, order) => {
      if (error) {
        console.log(error);
        return res.status(500).json({
          message: "An Error occured while creating Razorpay order Id",
        });
      }
      res.status(200).json({ data: order });
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error!" });
    console.log(error);
  }
});

// Capture payment for the order
app.post("/api/verify", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      name,
      email,
      phone,
      amount,
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !name ||
      !email ||
      !phone ||
      !amount
    ) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    const isAuthentic = expectedSign === razorpay_signature;
    const totalAmount = amount / 100;

    if (isAuthentic) {
      // Email to registered person
      const registeredPersonMailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject:
          "Confirmation of Registration for the Biggest Implant Symposium in Nizamabad",
        html: getparticipantTemplate(name),
      };

      // Email to host
      const hostMailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_SENDER,
        subject:
          "New Registration and Payment Confirmation for the Biggest Implant Symposium in Nizamabad",
        html: getHostTemplate(
          name,
          email,
          phone,
          totalAmount,
          razorpay_payment_id
        ),
      };
      // Send both emails
      try {
        await transporter.sendMail(registeredPersonMailOptions);
        console.log("Payment success email sent to registered person");

        await transporter.sendMail(hostMailOptions);
        console.log("Payment success email sent to host");

        return res.status(200).json({
          message: "Payment verified successfully",
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          name,
          email,
        });
      } catch (error) {
        console.error("Error sending payment success emails:", error);
        return res.status(500).json({ message: "Internal Server Error!" });
      }
    } else {
      return res.status(400).json({ message: "Invalid signature sent!" });
    }
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error!" });
    console.log(error);
  }
});

// Book Appointment Endpoint
app.post("/api/captcha-registration", async (req, res) => {
  const { name, email, phone, captchaToken } = req.body;

  if (!name || !email || !phone || !captchaToken) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const captchaVerified = await verifyCaptcha(captchaToken);

  if (captchaVerified) {
    res.status(200).json({ success: "Captcha verification Successful" });
  } else {
    res
      .status(401)
      .json({ error: "Captcha verification Failed. Please try again." });
  }
});

app.get("/api/getkey", (req, res) =>
  res.status(200).json({ key: process.env.RAZORPAY_KEY_ID })
);

app.get("/", (req, res) => res.send("Server is running"));

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
