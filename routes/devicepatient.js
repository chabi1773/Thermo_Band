const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/:patientId', async (req, res) => {
  const { patientId } = req.params;
  try {
    const patientCheck = await db.query(
      'SELECT 1 FROM Patient WHERE PatientID = $1 AND UserID = $2',
      [patientId, req.user.id]
    );
    if (patientCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized access to patient device info' });
    }

    const result = await db.query(
      'SELECT MacAddress FROM DevicePatient WHERE PatientID = $1',
      [patientId]
    );

    res.json(result.rows[0] || { MacAddress: null });
  } catch (err) {
    console.error('Error fetching device info:', err.message);
    res.status(500).json({ error: 'Failed to fetch device info' });
  }
});

module.exports = router;