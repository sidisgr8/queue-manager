const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors()); 
app.use(express.json({ limit: '5mb' })); 

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// --- SCHEMAS & MODELS ---
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, 
  role: { type: String, enum: ['customer', 'manager'], default: 'customer' }
});
const User = mongoose.model('User', userSchema);

const queueSchema = new mongoose.Schema({
  name: { type: String, required: true },
  manager: { type: String, required: true },
  customers: [{ type: String }],
  status: { type: String, enum: ['active', 'paused'], default: 'active' },
  avgTime: { type: Number, default: 5 },
  image: { type: String } 
});
const Queue = mongoose.model('Queue', queueSchema);

// --- AUTH ROUTES ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ error: 'Username taken' });
    
    const user = new User({ username, password, role });
    await user.save();
    res.status(201).json({ message: 'User registered' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ username: user.username, role: user.role });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- QUEUE ROUTES ---
app.get('/api/queues', async (req, res) => {
  try {
    const queues = await Queue.find();
    res.json(queues);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/queues', async (req, res) => {
  try {
    const queue = new Queue(req.body);
    await queue.save();
    res.status(201).json(queue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- NEW ROUTE: UPDATE EXISTING QUEUE DETAILS ---
app.put('/api/queues/:id', async (req, res) => {
  try {
    const { name, avgTime, image } = req.body;
    const updateData = { name, avgTime };
    
    // Only update image if it's explicitly sent (handles both new image and clearing image)
    if (image !== undefined) {
      updateData.image = image;
    }

    const queue = await Queue.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      { new: true }
    );
    res.json(queue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/queues/:id/status', async (req, res) => {
  try {
    const queue = await Queue.findById(req.params.id);
    queue.status = queue.status === 'active' ? 'paused' : 'active';
    await queue.save();
    res.json(queue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/queues/:id', async (req, res) => {
  try {
    await Queue.findByIdAndDelete(req.params.id);
    res.json({ message: 'Queue deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/queues/:id/action', async (req, res) => {
  try {
    const { action, username } = req.body;
    const queue = await Queue.findById(req.params.id);

    if (action === 'next') {
      queue.customers.shift(); 
    } else if (action === 'remove' || action === 'leave') {
      queue.customers = queue.customers.filter(c => c !== username);
    } else if (action === 'join') {
      if (!queue.customers.includes(username) && queue.status === 'active') {
        queue.customers.push(username);
      }
    }

    await queue.save();
    res.json(queue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));