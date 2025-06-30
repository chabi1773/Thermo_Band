const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();

const patientsRouter = require("./routes/patients");
const temperaturesRouter = require("./routes/temperatures");
const devicePatientRouter = require("./routes/devicepatient");
const esp32Router = require("./routes/esp32");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Health Monitoring Backend API is running");
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // 'Bearer <token>'

  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET); // This secret is from Supabase settings
    req.user = decoded;
    next();
  } catch (err) {
    console.log(err)
    return res.status(403).json({ error: "Invalid token" });
  }
};
app.use("/patients", authenticateToken, patientsRouter);
app.use("/temperatures", authenticateToken, temperaturesRouter);
app.use("/devicepatient", authenticateToken, devicePatientRouter);
app.use("/esp32", esp32Router); // change verifyApiKey to esp32Router

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
