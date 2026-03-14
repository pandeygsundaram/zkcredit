const express = require('express');
const cors = require('cors');
const agentRoutes = require('./routes/agentRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/agents', agentRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
