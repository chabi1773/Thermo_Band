const express = require('express');
const router = express.Router();
const db = require('../db');

// API key for ESP32 devices — set in .env
//const ESP32_API_KEY = process.env.ESP32_API_KEY;

// Middleware to check API key
//const verifyApiKey = (req, res, next) => {
  //const apiKey = req.headers['x-api-key'];
  //if (!apiKey || apiKey !== ESP32_API_KEY) {
    //return res.status(401).json({ error: 'Unauthorized: invalid API key' });
  //}
  //next();
//};

router.post('/send-temperature', verifyApiKey, async (req, res) => {
  const { macAddress, temperature } = req.body;

  if (!macAddress || temperature === undefined) {
    return res.status(400).json({ error: 'Missing macAddress or temperature' });
  }

  try {
    const patientResult = await db.query(
      'SELECT PatientID FROM DevicePatient WHERE MacAddress = $1',
      [macAddress]
    );

    if (patientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Device not registered' });
    }

    const patientId = patientResult.rows[0].patientid;

    await db.query(
      'INSERT INTO DeviceTemp (PatientID, Temperature) VALUES ($1, $2)',
      [patientId, temperature]
    );

    res.json({ message: 'Temperature recorded from ESP32' });
  } catch (err) {
    console.error('ESP32 temperature insert error:', err);
    res.status(500).json({ error: 'Failed to record temperature' });
  }
});

// Add patient without macAddress
router.post('/add-patient', verifyApiKey, async (req, res) => {
  const { userId, name, age } = req.body;

  if (!userId || !name || !age) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await db.query(
      'INSERT INTO Patient (UserID, Name, Age) VALUES ($1, $2, $3) RETURNING *',
      [userId, name, age]
    );

    res.status(201).json({ message: 'Patient added', patient: result.rows[0] });
  } catch (err) {
    console.error('Error adding patient from ESP32:', err);
    res.status(500).json({ error: 'Failed to add patient' });
  }
});

module.exports = router;
