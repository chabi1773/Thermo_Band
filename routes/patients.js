const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const db = require("../db");
const { validate: isUuid } = require("uuid");

const getUserIdFromToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.sub || decoded.user_id || decoded.id;
  } catch {
    return null;
  }
};

// Middleware to apply auth to all routes below
router.use((req, res, next) => {
  const userId = getUserIdFromToken(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized or invalid token" });
  }
  req.userId = userId;
  next();
});

// GET all patients
router.get("/", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT PatientID, Name, Age FROM Patient WHERE UserID = $1",
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching patients:", err);
    res.status(500).json({ error: "Failed to fetch patients" });
  }
});

// GET patient by ID
router.get("/:id", async (req, res) => {
  const { id: patientId } = req.params;
  if (!isUuid(patientId)) {
    return res.status(400).json({ error: "Invalid patient ID format" });
  }

  try {
    const result = await db.query(
      "SELECT * FROM Patient WHERE PatientID = $1 AND UserID = $2",
      [patientId, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Patient not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching patient:", err.message);
    res.status(500).json({ error: "Failed to fetch patient" });
  }
});

// Add patient
router.post("/add", async (req, res) => {
  const { name, age } = req.body;
  if (!name || !age) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const result = await db.query(
      "INSERT INTO Patient (UserID, Name, Age) VALUES ($1, $2, $3) RETURNING *",
      [req.userId, name, age]
    );
    res.status(201).json({ message: "Patient added", patient: result.rows[0] });
  } catch (err) {
    console.error("Error adding patient:", err);
    res.status(500).json({ error: "Failed to add patient" });
  }
});

// Assign device to patient
router.post("/assign-device", async (req, res) => {
  const { patientId, macAddress } = req.body;

  if (!patientId || !macAddress) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const patientCheck = await db.query(
      "SELECT 1 FROM Patient WHERE PatientID = $1 AND UserID = $2",
      [patientId, req.userId]
    );
    if (patientCheck.rows.length === 0) {
      return res.status(404).json({ error: "Patient not found or unauthorized" });
    }

    const deviceCheck = await db.query(
      "SELECT 1 FROM DevicePatient WHERE MacAddress = $1",
      [macAddress]
    );
    if (deviceCheck.rows.length === 0) {
      return res.status(404).json({ error: "Device not registered" });
    }

    const assignedCheck = await db.query(
      "SELECT 1 FROM DevicePatient WHERE MacAddress = $1 AND PatientID IS NOT NULL",
      [macAddress]
    );
    if (assignedCheck.rows.length > 0) {
      return res.status(400).json({ error: "Device already assigned to a patient" });
    }

    await db.query(
      `UPDATE DevicePatient SET PatientID = $1 WHERE MacAddress = $2`,
      [patientId, macAddress]
    );

    res.status(201).json({
      message: "Device assigned to patient successfully",
      assigned: { macAddress },
    });
  } catch (err) {
    console.error("Error assigning device:", err);
    res.status(500).json({ error: "Failed to assign device to patient" });
  }
});

// Set interval
router.post("/set-interval", async (req, res) => {
  const { macAddress, interval } = req.body;

  if (!macAddress || !interval || isNaN(interval)) {
    return res.status(400).json({ error: "Missing or invalid fields" });
  }

  try {
    const result = await db.query(
      "UPDATE DevicePatient SET Interval = $1 WHERE MacAddress = $2 RETURNING *",
      [interval, macAddress]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Device not assigned to any patient" });
    }

    res.status(200).json({
      message: "Interval updated successfully",
      macAddress,
      interval,
    });
  } catch (err) {
    console.error("Error updating interval:", err);
    res.status(500).json({ error: "Failed to update interval" });
  }
});

// Reset device
router.post("/reset-device", async (req, res) => {
  const { macAddress, reset } = req.body;

  if (!macAddress || reset !== true) {
    return res.status(400).json({ error: "Missing macAddress or reset flag not true" });
  }

  try {
    const checkResult = await db.query(
      "SELECT 1 FROM DevicePatient WHERE MacAddress = $1",
      [macAddress]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Device not found in DevicePatient" });
    }

    await db.query(
      "UPDATE DevicePatient SET PatientID = NULL, Reset = false WHERE MacAddress = $1",
      [macAddress]
    );

    res.status(200).json({ message: "Device reset completed", macAddress });
  } catch (err) {
    console.error("Error resetting device:", err);
    res.status(500).json({ error: "Failed to reset device" });
  }
});

module.exports = router;
