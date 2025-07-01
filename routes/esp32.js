//mona huttakda bn

const express = require("express");
const router = express.Router();
const db = require("../db");

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
  console.log(macAddress, temperature);
  if (macAddress === undefined || temperature === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    const result = await db.query(
      "SELECT * FROM log_device_temperature($1, $2);",
      [macAddress, temperature]
    );
    res
      .status(201)
      .json({ message: "Temperature recorded", tempRecord: result.rows[0] });
  } catch (err) {
    console.error("Error adding temperature:", err);
    res.status(500).json({ error: "Failed to add temperature" });
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
    res
      .status(201)
      .json({ message: "Device Registered", tempRecord: result.rows[0] });
  } catch (err) {
    console.error("Error registering device:", err);
    res.status(500).json({ error: "Failed to register device" });
  }
});

router.get("/test-users", async (req, res) => {
  try {
    const result = await db.query(
      'SELECT "UserID", "Username" FROM "AppUser" LIMIT 5'
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching AppUser:", err);
    res.status(500).json({ error: "Failed to fetch AppUser" });
  }
});

module.exports = router;
