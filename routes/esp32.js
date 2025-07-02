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

    const intervalResult = await db.query(
      "SELECT Interval FROM DevicePatient WHERE MacAddress = $1",
      [macAddress]
    );

    let deviceInterval = 300;
    if (intervalResult.rows.length > 0 && intervalResult.rows[0].interval) {
      deviceInterval = intervalResult.rows[0].interval;
    }

    res.status(201).json({
      message: "Temperature recorded",
      tempRecord: result.rows[0],
      reset: false,
      interval: deviceInterval,
    });
  } catch (err) {
    console.error("Error adding temperature:", err);
    try {
      const intervalResult = await db.query(
        "SELECT Interval FROM DevicePatient WHERE MacAddress = $1",
        [macAddress]
      );

      let deviceInterval = 300;
      if (intervalResult.rows.length > 0 && intervalResult.rows[0].interval) {
        deviceInterval = intervalResult.rows[0].interval;
      }

      return res.status(500).json({
        error: "Failed to add temperature",
        reset: false,
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

module.exports = router;
