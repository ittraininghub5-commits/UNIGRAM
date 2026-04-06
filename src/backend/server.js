const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Email route
app.post("/send-email", async (req, res) => {
  const { to, subject, text } = req.body;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "ittraininghub5@gmail.com",
      pass: "jebaswsilmel"
    }
  });

  try {
    await transporter.sendMail({
      from: "ittraininghub5@gmail.com",
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