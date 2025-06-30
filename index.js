
const express = require('express');
const cors = require('cors');

const patientsRouter = require('./routes/patients');
const temperaturesRouter = require('./routes/temperatures');
const devicePatientRouter = require('./routes/devicepatient');
const esp32Router = require('./routes/esp32');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/patients',patientsRouter);
app.use('/temperatures',temperaturesRouter);
app.use('/devicepatient', devicePatientRouter);
app.use('/esp32', esp32Router); // change verifyApiKey to esp32Router


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