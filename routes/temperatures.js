const express = require('express');
const router = express.Router();
const db = require('../db');
const { validate: isUuid } = require('uuid');

router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT dt.Temperature, dt.DateTime, dt.PatientID, p.Name
       FROM DeviceTemp dt
       JOIN Patient p ON dt.PatientID = p.PatientID
       WHERE p.UserID = $1
       ORDER BY dt.DateTime ASC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching temperatures:', err.message);
    res.status(500).json({ error: 'Failed to fetch temperatures' });
  }
});

router.get('/:patientId', async (req, res) => {
  const { patientId } = req.params;
  if (!isUuid(patientId)) {
    return res.status(400).json({ error: 'Invalid patient ID format' });
  }
  try {
    const patient = await db.query(
      'SELECT UserID FROM Patient WHERE PatientID = $1',
      [patientId]
    );
    if (patient.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    if (patient.rows[0].userid !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized access to patient data' });
    }

    const result = await db.query(
      'SELECT Temperature, DateTime FROM DeviceTemp WHERE PatientID = $1 ORDER BY DateTime ASC',
      [patientId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching temperature data:', err.message);
    res.status(500).json({ error: 'Failed to fetch temperature data' });
  }
});

module.exports = router;