const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/add-patient', async (req, res) => {
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
    console.error('Error adding patient:', err.message);
    res.status(500).json({ error: 'Failed to add patient' });
  }
});

router.post('/add-temperature', async (req, res) => {
  const { patientId, temperature } = req.body;
  if (!patientId || temperature === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const result = await db.query(
      'INSERT INTO DeviceTemp (PatientID, Temperature) VALUES ($1, $2) RETURNING *',
      [patientId, temperature]
    );
    res.status(201).json({ message: 'Temperature recorded', tempRecord: result.rows[0] });
  } catch (err) {
    console.error('Error adding temperature:', err.message);
    res.status(500).json({ error: 'Failed to add temperature' });
  }
});

module.exports = router;