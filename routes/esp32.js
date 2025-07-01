const express = require("express");
const router = express.Router();
const db = require("../db");

let interval = 300;

router.post("/add-patient", async (req, res) => {
  const { userId, name, age } = req.body;
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

router.post("/add-temperature", async (req, res) => {
  const { macAddress, temperature } = req.body;
  if (macAddress === undefined || temperature === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const result = await db.query(
      "SELECT * FROM log_device_temperature($1, $2);",
      [macAddress, temperature]
    );

    // Fetch interval from DevicePatient table
    const intervalResult = await db.query(
      "SELECT IntervalSeconds FROM DevicePatient WHERE MacAddress = $1",
      [macAddress]
    );

    let deviceInterval = 300; // default interval
    if (intervalResult.rows.length > 0 && intervalResult.rows[0].intervalseconds) {
      deviceInterval = intervalResult.rows[0].intervalseconds;
    }

    res.status(201).json({
      message: "Temperature recorded",
      tempRecord: result.rows[0],
      reset: false,
      interval: deviceInterval,
    });
  } catch (err) {
    console.error("Error adding temperature:", err);

    // Try to still fetch interval if possible
    try {
      const intervalResult = await db.query(
        "SELECT IntervalSeconds FROM DevicePatient WHERE MacAddress = $1",
        [macAddress]
      );

      let deviceInterval = 300; // default interval
      if (intervalResult.rows.length > 0 && intervalResult.rows[0].intervalseconds) {
        deviceInterval = intervalResult.rows[0].intervalseconds;
      }

      return res.status(500).json({
        error: "Failed to add temperature",
        reset: false,
        interval: deviceInterval,
      });
    } catch {
      // fallback if even interval fetch fails
      return res.status(500).json({
        error: "Failed to add temperature",
        reset: false,
        interval: 300,
      });
    }
  }
});

router.post("/register-device", async (req, res) => {
  const { uid, macAddress } = req.body;

  if (!uid || !macAddress)
    return res.status(400).json({ error: "Missing required fields" });

  try {
    const result = await db.query(
      "SELECT * FROM assign_device_to_user($1, $2);",
      [macAddress, uid]
    );
    let msg = "Device Registered";
    if (result.rows[0].assign_device_to_user === 1) {
      msg = "Device already registered";
    } else if (result.rows[0].assign_device_to_user === -1) {
      msg = "Device belong to another user";
    }
    res.status(201).json({
      message: msg,
      DeviceRegister: result.rows[0],
      reset: false,
      interval: interval,
    });
  } catch (err) {
    console.error("Error registering device:", err);
    res.status(500).json({
      error: "Failed to register device",
      reset: false,
      interval: interval,
    });
  }
});

router.post("/set-interval", async (req, res) => {
  const { macAddress, interval } = req.body;

  if (!macAddress || !interval || isNaN(interval)) {
    return res.status(400).json({ error: "Missing or invalid fields" });
  }

  try {
    const result = await db.query(
      "UPDATE DevicePatient SET IntervalSeconds = $1 WHERE MacAddress = $2 RETURNING *",
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

router.post("/assign-device-to-patient", async (req, res) => {
  const { patientId, macAddress } = req.body;

  if (!patientId || !macAddress) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Check if patient exists
    const patientCheck = await db.query(
      "SELECT 1 FROM Patient WHERE PatientID = $1",
      [patientId]
    );
    if (patientCheck.rows.length === 0) {
      return res.status(404).json({ error: "Patient not found" });
    }

    // Check if device is registered in DevicePatient (as unassigned)
    const deviceCheck = await db.query(
      "SELECT 1 FROM DevicePatient WHERE MacAddress = $1",
      [macAddress]
    );
    if (deviceCheck.rows.length === 0) {
      return res.status(404).json({ error: "Device not registered" });
    }

    // Check if device is already assigned to any patient
    const assignedCheck = await db.query(
      "SELECT 1 FROM DevicePatient WHERE MacAddress = $1 AND PatientID IS NOT NULL",
      [macAddress]
    );
    if (assignedCheck.rows.length > 0) {
      return res
        .status(400)
        .json({ error: "Device already assigned to a patient" });
    }

    // Assign device to patient (update the existing row)
    await db.query(
      `UPDATE DevicePatient
       SET PatientID = $1
       WHERE MacAddress = $2`,
      [patientId, macAddress]
    );

    // Return assigned mac address
    res.status(201).json({
      message: "Device assigned to patient successfully",
      assigned: { macAddress },
    });
  } catch (err) {
    console.error("Error assigning device to patient:", err);
    res.status(500).json({ error: "Failed to assign device to patient" });
  }
});

module.exports = router;
