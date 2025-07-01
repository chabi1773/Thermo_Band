const express = require('express');
const router = express.Router();
const db = require('../db');

// Middleware must be applied at app level (already done), so req.user is set here

router.get('/:patientId', async (req, res) => {
  const { patientId } = req.params;
  const userId = req.user.sub || req.user.user_id || req.user.id; // depends on your token payload

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    // Check if the patient belongs to this user
    const patientCheck = await db.query(
      'SELECT 1 FROM Patient WHERE PatientID = $1 AND UserID = $2',
      [patientId, userId]
    );

    if (patientCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized access to patient device info' });
    }

    // Fetch the device info for this patient
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
