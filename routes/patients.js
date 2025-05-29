const express = require('express');
const router = express.Router();
const db = require('../db');
const { validate: isUuid } = require('uuid');

router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT PatientID, Name, Age FROM Patient WHERE UserID = $1',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching patients:', err.message);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

router.get('/:id', async (req, res) => {
  const { id: patientId } = req.params;
  if (!isUuid(patientId)) {
    return res.status(400).json({ error: 'Invalid patient ID format' });
  }
  try {
    const result = await db.query(
      'SELECT * FROM Patient WHERE PatientID = $1 AND UserID = $2',
      [patientId, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching patient:', err.message);
    res.status(500).json({ error: 'Failed to fetch patient' });
  }
});

module.exports = router;