const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Email route
app.post("/send-email", async (req, res) => {
  const { to, subject, text } = req.body;
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    return res.status(500).send("Email credentials are not configured");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailUser,
      pass: emailPass
    }
  });

  try {
    await transporter.sendMail({
      from: emailUser,
      to,
      subject,
      text
    });

    res.send("Email sent");
  } catch (error) {
    console.log(error);
    res.status(500).send("Error sending email");
  }
});

app.listen(5000, () => console.log("Server running on port 5000"));