const express = require("express");
const router = express.Router();
const db = require("../db");

router.post("/add-temperature", async (req, res) => {
  const { macAddress, temperature } = req.body;
  if (macAddress === undefined || temperature === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const deviceCheck = await db.query(
      "SELECT 1 FROM DevicePatient WHERE MacAddress = $1",
      [macAddress]
    );

    if (deviceCheck.rows.length === 0) {
      return res.status(404).json({ error: "DevicePatient row not found — please reassign device." });
    }

    const result = await db.query(
      "SELECT * FROM log_device_temperature($1, $2);",
      [macAddress, temperature]
    );

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

    // Send response immediately
    res.status(201).json({
      message: "Temperature recorded",
      tempRecord: result.rows[0],
      reset: resetStatus,
      interval: deviceInterval,
    });

    // Async deletion if reset = true
    if (resetStatus === true) {
      (async () => {
        try {
          const patientRes = await db.query(
            `SELECT PatientID FROM DevicePatient WHERE MacAddress = $1 AND Reset = TRUE`,
            [macAddress]
          );

          if (patientRes.rows.length > 0) {
            const patientIds = patientRes.rows.map(row => row.patientid);

            await db.query(
              `DELETE FROM Patient WHERE PatientID = ANY($1::uuid[])`,
              [patientIds]
            );

            await db.query(
              `DELETE FROM DevicePatient WHERE MacAddress = $1 AND Reset = TRUE`,
              [macAddress]
            );

            console.log(`Deleted reset data for device ${macAddress}`);
          }
        } catch (delErr) {
          console.error(`Failed to delete reset data for device ${macAddress}:`, delErr);
        }
      })();
    }
  } catch (err) {
    console.error("Error adding temperature:", err);

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
