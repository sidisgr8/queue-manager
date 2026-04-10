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
  category: { type: String, default: 'Other' },
  
  location: {
    address: { type: String, default: '' },
    lat: { type: Number },
    lng: { type: Number }
  },

  customers: [{ 
    username: { type: String },
    expectedTime: { type: Number },
    updatedAt: { type: Date, default: Date.now },
    note: { type: String, default: '' }
  }],
  
  totalServed: { type: Number, default: 0 },
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

app.put('/api/queues/:id', async (req, res) => {
  try {
    const { name, avgTime, image, location, category } = req.body; 
    const updateData = { name, avgTime };
    if (image !== undefined) updateData.image = image;
    if (location !== undefined) updateData.location = location;
    if (category !== undefined) updateData.category = category;

    const queue = await Queue.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      { returnDocument: 'after' } // FIXED MONGOOSE WARNING
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

app.put('/api/queues/:id/customer-time', async (req, res) => {
  try {
    const { username, expectedTime } = req.body;
    const queue = await Queue.findById(req.params.id);
    
    const customer = queue.customers.find(c => c.username === username);
    if (customer) {
      customer.expectedTime = Number(expectedTime);
      await queue.save();
    }
    res.json(queue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/queues/:id/action', async (req, res) => {
  try {
    const { action, username, note } = req.body;
    const queue = await Queue.findById(req.params.id);

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    if (action === 'next') {
      if (queue.customers.length > 0) {
        queue.customers.shift();
        queue.totalServed = (queue.totalServed || 0) + 1;
      }
    } else if (action === 'remove' || action === 'leave') {
      queue.customers = queue.customers.filter(c => c.username !== username);
    } else if (action === 'join') {
      if (!queue.customers.some(c => c.username === username) && queue.status === 'active') {
        queue.customers.push({ 
          username, 
          expectedTime: queue.avgTime, 
          updatedAt: new Date(),
          note: note || '' 
        });
      }
    }

    await queue.save();
    res.json(queue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/queues/:id/reorder', async (req, res) => {
  try {
    const { customers } = req.body;
    const queue = await Queue.findById(req.params.id);
    
    if (!queue) return res.status(404).json({ error: 'Queue not found' });
    
    queue.customers = customers;
    
    await queue.save();
    res.json(queue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));