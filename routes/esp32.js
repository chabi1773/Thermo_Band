const express = require("express");
const router = express.Router();
const db = require("../db");

// Store last accepted timestamp for each macAddress
const lastRequestTimestamps = new Map();

router.post("/add-temperature", async (req, res) => {
  const { macAddress, temperature } = req.body;

  if (macAddress === undefined || temperature === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const now = Date.now();
  const lastTime = lastRequestTimestamps.get(macAddress);

  // Throttle requests within 10 seconds
  if (lastTime && (now - lastTime) < 10 * 1000) {
    return res.status(429).json({
      error: "Too many requests. Please wait before sending another temperature."
    });
  }

  try {
    // 1) Check if device exists and get interval/reset status
    const deviceStatusResult = await db.query(
      "SELECT Interval, Reset FROM DevicePatient WHERE MacAddress = $1",
      [macAddress]
    );

    if (deviceStatusResult.rows.length === 0) {
      return res.status(404).json({ error: "DevicePatient row not found — please reassign device." });
    }

    let deviceInterval = 300;
    let resetStatus = false;
    if (deviceStatusResult.rows[0].interval) deviceInterval = deviceStatusResult.rows[0].interval;
    if (deviceStatusResult.rows[0].reset !== undefined) resetStatus = deviceStatusResult.rows[0].reset;

    // 2) Log temperature no matter what
    const result = await db.query(
      "SELECT * FROM log_device_temperature($1, $2);",
      [macAddress, temperature]
    );

    // Update last successful timestamp to throttle future requests
    lastRequestTimestamps.set(macAddress, Date.now());

    // 3) Send acknowledgment with reset status
    res.status(201).json({
      message: "Temperature recorded",
      tempRecord: result.rows[0],
      reset: resetStatus,
      interval: deviceInterval,
    });

    // 4) After sending response, if reset true, delete all related data async
    if (resetStatus === true) {
      try {
        const patientRes = await db.query(
          `SELECT PatientID FROM DevicePatient WHERE MacAddress = $1`,
          [macAddress]
        );

        if (patientRes.rows.length > 0) {
          const patientIds = patientRes.rows.map(row => row.patientid);

          // Delete from DeviceTemp first (FK references Patient)
          //await db.query(
            //`DELETE FROM DeviceTemp WHERE PatientID = ANY($1::uuid[])`,
            //[patientIds]
          //);

          // Delete Patients
          //await db.query(
            //`DELETE FROM Patient WHERE PatientID = ANY($1::uuid[])`,
            //[patientIds]
          //);
        //}

        // Delete DevicePatient entry
        await db.query(
          `DELETE FROM DevicePatient WHERE MacAddress = $1`,
          [macAddress]
        );

        console.log(` Deleted all data related to reset device ${macAddress} ⁠`);
      } catch (deleteErr) {
        console.error("Error deleting reset device data after acknowledgment:", deleteErr);
      }
    }

  } catch (err) {
    console.error("Error adding temperature:", err);

    // On error, try to get reset and interval to respond meaningfully
    try {
      const deviceStatusResult = await db.query(
        "SELECT Interval, Reset FROM DevicePatient WHERE MacAddress = $1",
        [macAddress]
      );

      let deviceInterval = 300;
      let resetStatus = false;

      if (deviceStatusResult.rows.length > 0) {
        if (deviceStatusResult.rows[0].interval) deviceInterval = deviceStatusResult.rows[0].interval;
        if (deviceStatusResult.rows[0].reset !== undefined) resetStatus = deviceStatusResult.rows[0].reset;
      }

      return res.status(500).json({
        error: "Failed to add temperature",
        reset: resetStatus,
        interval: deviceInterval,
      });
    } catch {
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

  if (!uid || !macAddress) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const result = await db.query(
      "SELECT * FROM assign_device_to_user($1, $2);",
      [macAddress, uid]
    );

    let msg = "Device Registered";
    if (result.rows[0].assign_device_to_user === 1) {
      msg = "Device already registered";
    } else if (result.rows[0].assign_device_to_user === -1) {
      msg = "Device belongs to another user";
    }

    res.status(201).json({
      message: msg,
      DeviceRegister: result.rows[0],
      reset: false,
      interval: 300,
    });
  } catch (err) {
    console.error("Error registering device:", err);
    res.status(500).json({
      error: "Failed to register device",
      reset: false,
      interval: 300,
    });
  }
});

router.get("/unassigned-devices", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT MacAddress FROM DevicePatient WHERE PatientID IS NULL"
    );
    res.json(result.rows); // returns array of { macaddress: 'xx:xx:xx...' }
  } catch (err) {
    console.error("Error fetching unassigned devices:", err);
    res.status(500).json({ error: "Failed to fetch unassigned devices" });
  }
});

module.exports = router;
