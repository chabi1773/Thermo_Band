if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const cors = require('cors');
const verifyUser = require('./middleware/verifyUser');
const verifyApiKey = require('./middleware/verifyApiKey');

const patientsRouter = require('./routes/patients');
const temperaturesRouter = require('./routes/temperatures');
const devicePatientRouter = require('./routes/devicepatient');
const esp32Router = require('./routes/esp32');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/patients', verifyUser, patientsRouter);
app.use('/temperatures', verifyUser, temperaturesRouter);
app.use('/devicepatient', verifyUser, devicePatientRouter);
app.use('/esp32', verifyApiKey, esp32Router);

app.get('/', (req, res) => {
  res.send('Health Monitoring Backend API is running');
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));