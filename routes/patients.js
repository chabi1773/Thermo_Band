const express = require("express");
const router = express.Router();
const db = require("../db");
const { validate: isUuid } = require("uuid");

// Get all patients for authenticated user
router.get("/", async (req, res) => {
  const userId = req.user?.sub || req.user?.user_id || req.user?.id;
  if (!userId) return res.status(401).json({ error: "User not authenticated" });

  try {
    const result = await db.query(
      "SELECT PatientID, Name, Age FROM Patient WHERE UserID = $1",
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching patients:", err);
    res.status(500).json({ error: "Failed to fetch patients" });
  }
});

// Get individual patient details
router.get("/:id", async (req, res) => {
  const userId = req.user?.sub || req.user?.user_id || req.user?.id;
  const { id: patientId } = req.params;
  if (!userId) return res.status(401).json({ error: "User not authenticated" });
  if (!isUuid(patientId)) return res.status(400).json({ error: "Invalid patient ID format" });

  try {
    const result = await db.query(
      "SELECT * FROM Patient WHERE PatientID = $1 AND UserID = $2",
      [patientId, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Patient not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching patient:", err.message);
    res.status(500).json({ error: "Failed to fetch patient" });
  }
});

// Add a new patient
router.post("/add", async (req, res) => {
  const userId = req.user?.sub || req.user?.user_id || req.user?.id;
  const { name, age } = req.body;
  if (!userId || !name || !age) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const result = await db.query(
      "INSERT INTO Patient (UserID, Name, Age) VALUES ($1, $2, $3) RETURNING *",
      [userId, name, age]
    );
    res.status(201).json({ message: "Patient added", patient: result.rows[0] });
  } catch (err) {
    console.error("Error adding patient:", err);
    res.status(500).json({ error: "Failed to add patient" });
  }
});

// Assign a device to a patient
router.post("/assign-device", async (req, res) => {
  const userId = req.user?.sub || req.user?.user_id || req.user?.id;
  const { patientId, macAddress } = req.body;

  if (!userId || !patientId || !macAddress) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const patientCheck = await db.query(
      "SELECT 1 FROM Patient WHERE PatientID = $1 AND UserID = $2",
      [patientId, userId]
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

// Reset device (unassign patient)
router.post("/reset-device", async (req, res) => {
  const { macAddress } = req.body;

  if (!macAddress) {
    return res.status(400).json({ error: "Missing macAddress" });
  }

  try {
    await db.query(
      "UPDATE DevicePatient SET Reset = true WHERE MacAddress = $1",
      [macAddress]
    );

    res.status(200).json({ message: "Device reset flag set to true", macAddress });
  } catch (err) {
    console.error("Error resetting device:", err);
    res.status(500).json({ error: "Failed to reset device" });
  }
});


// Delete patient: unlink device, delete temps & patient
router.delete("/:id", async (req, res) => {
  const userId = req.user?.sub || req.user?.user_id || req.user?.id;
  const patientId = req.params.id;

  if (!userId) return res.status(401).json({ error: "User not authenticated" });
  if (!isUuid(patientId)) return res.status(400).json({ error: "Invalid patient ID format" });

  try {
    const patientCheck = await db.query(
      "SELECT 1 FROM Patient WHERE PatientID = $1 AND UserID = $2",
      [patientId, userId]
    );

    if (patientCheck.rows.length === 0) {
      return res.status(404).json({ error: "Patient not found or unauthorized" });
    }

    // Unlink device: set PatientID = NULL
    await db.query(
      "UPDATE DevicePatient SET PatientID = NULL WHERE PatientID = $1",
      [patientId]
    );

    // Delete related temperature records
    await db.query("DELETE FROM DeviceTemp WHERE PatientID = $1", [patientId]);

    // Delete patient
    await db.query(
      "DELETE FROM Patient WHERE PatientID = $1 AND UserID = $2",
      [patientId, userId]
    );

    res.status(200).json({ message: "Patient deleted and device unlinked successfully" });
  } catch (err) {
    console.error("Error deleting patient:", err);
    res.status(500).json({ error: "Failed to delete patient" });
  }
});

module.exports = router;
