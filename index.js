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
//const allowedOrigins = ['https://thermo-band-fe.vercel.app'];

//app.use(cors({
//  origin: function (origin, callback) {
//    if (!origin || allowedOrigins.includes(origin)) {
//      callback(null, true);
//    } else {
 //     callback(new Error('Not allowed by CORS'));
//    }
//  },
//  credentials: true, // allows cookies, auth headers like Authorization
//}));
//added above code

app.use(express.json());

app.get("/", (req, res) => {
  res.send({"message":"Health Monitoring Backend API is running"});
});

// ✅ Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Expected: 'Bearer <token>'

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    // Verify Supabase user token using your Supabase JWT secret
    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("JWT verification failed:", err);
    return res.status(403).json({ error: "Invalid token" });
  }
};

// ✅ Routes using authentication
app.use("/patients", authenticateToken, patientsRouter);
app.use("/temperatures", authenticateToken, temperaturesRouter);
app.use("/devicepatient", authenticateToken, devicePatientRouter);

// ✅ ESP32 router (public or separately authenticated, not using JWT)
app.use("/esp32", esp32Router);

// ✅ 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ✅ General error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
