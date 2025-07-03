const express = require("express");
const router = express.Router();
const db = require("../db");

router.post("/add-temperature", async (req, res) => {
  const { macAddress, temperature } = req.body;
  if (macAddress === undefined || temperature === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
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
          await db.query(
            `DELETE FROM DeviceTemp WHERE PatientID = ANY($1::uuid[])`,
            [patientIds]
          );

          // Delete Patients
          await db.query(
            `DELETE FROM Patient WHERE PatientID = ANY($1::uuid[])`,
            [patientIds]
          );
        }

        // Delete DevicePatient entry
        await db.query(
          `DELETE FROM DevicePatient WHERE MacAddress = $1`,
          [macAddress]
        );

        console.log(`Deleted all data related to reset device ${macAddress}`);
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

module.exports = router;
