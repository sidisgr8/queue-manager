import { useState, useEffect } from "react";
import { 
  BellRing, LogOut, CheckCircle2, Search, Trash2, 
  PencilLine, Play, Pause, Users, Clock, ArrowRight,
  UserCircle, CheckCircle, Loader2, Tag, SlidersHorizontal,
  ChevronUp, ChevronDown, GripVertical, MapPin, User, Lock
} from "lucide-react";

// Vite uses import.meta.env to access environment variables
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const CATEGORIES = ["Restaurant", "Hospital", "Bank", "Retail", "Event", "Other"];

// Helper to calculate distance between two lat/lng pairs in kilometers
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(1);
};

// Helper to extract coordinates from a pasted Google Maps URL
const extractCoordinatesFromUrl = (url) => {
  const regex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
  const match = url.match(regex);
  if(match) {
     return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }
  return null;
};

function App() {
  const [queues, setQueues] = useState([]);
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('queueManagerUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [authMode, setAuthMode] = useState("login"); 
  const [notification, setNotification] = useState("");
  
  const [authForm, setAuthForm] = useState({ username: "", password: "", role: "customer" });
  const [newQueue, setNewQueue] = useState({ name: "", avgTime: 5, image: "", address: "", lat: "", lng: "", category: "Other" });
  const [searchQuery, setSearchQuery] = useState("");
  
  // Filter & Sort States
  const [filterCategory, setFilterCategory] = useState("All");
  const [sortBy, setSortBy] = useState("default"); 

  const [editingQueue, setEditingQueue] = useState(null);
  const [editingCustomerTime, setEditingCustomerTime] = useState(null); 
  const [notifiedQueues, setNotifiedQueues] = useState([]);

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [processingActionId, setProcessingActionId] = useState(null); 
  const [now, setNow] = useState(Date.now());
  
  const [userLocation, setUserLocation] = useState(null);
  const [joinNotes, setJoinNotes] = useState({});

  const [dragState, setDragState] = useState({ queueId: null, index: null });

  const getRemainingTime = (customer) => customer.expectedTime || 0;

  const handleReorder = async (queueId, newCustomersList) => {
    setProcessingActionId(queueId);
    
    setQueues(current => current.map(q => 
      q._id === queueId ? { ...q, customers: newCustomersList } : q
    ));

    try {
      await fetch(`${API_URL}/queues/${queueId}/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customers: newCustomersList })
      });
    } catch (err) {
      showNotification("Failed to save new queue order.");
    } finally {
      await fetchQueues();
      setProcessingActionId(null);
    }
  };

  const onDragStart = (e, queueId, index) => {
    setDragState({ queueId, index });
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e) => {
    e.preventDefault();
  };

  const onDrop = (e, targetQueueId, dropIndex) => {
    e.preventDefault();
    if (dragState.queueId !== targetQueueId || dragState.index === null) return;
    if (dragState.index === dropIndex) return;

    const queue = queues.find(q => q._id === targetQueueId);
    const newCustomers = [...queue.customers];
    const [draggedCustomer] = newCustomers.splice(dragState.index, 1);
    newCustomers.splice(dropIndex, 0, draggedCustomer);
    
    handleReorder(targetQueueId, newCustomers);
    setDragState({ queueId: null, index: null });
  };

  const movePosition = (queueId, currentIndex, direction) => {
    if (processingActionId === queueId) return;
    
    const queue = queues.find(q => q._id === queueId);
    const newIndex = currentIndex + direction;
    if (newIndex < 0 || newIndex >= queue.customers.length) return;

    const newCustomers = [...queue.customers];
    const temp = newCustomers[currentIndex];
    newCustomers[currentIndex] = newCustomers[newIndex];
    newCustomers[newIndex] = temp;

    handleReorder(queueId, newCustomers);
  };

  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(""), 3000);
  };

  const playNotificationSound = () => {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.play().catch(e => console.log("Audio play blocked by browser interaction policies"));
    } catch (err) {}
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setNewQueue({ ...newQueue, image: reader.result });
      reader.readAsDataURL(file);
    }
  };

  const handleEditImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setEditingQueue({ ...editingQueue, image: reader.result });
      reader.readAsDataURL(file);
    }
  };

  // --- LOCATION HELPERS ---
  const handleUrlPaste = async (val, isEdit) => {
    const coords = extractCoordinatesFromUrl(val);
    if (coords) {
      if (isEdit) {
        setEditingQueue(prev => ({ ...prev, location: { ...prev.location, lat: coords.lat, lng: coords.lng, address: 'Extracting proper address...' } }));
      } else {
        setNewQueue(prev => ({ ...prev, lat: coords.lat, lng: coords.lng, address: 'Extracting proper address...' }));
      }
      
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}`);
        const data = await res.json();
        
        const cleanAddress = data.display_name.split(',').slice(0, 3).join(',') || "Pinned Map Location";
        
        if (isEdit) {
          setEditingQueue(prev => ({ ...prev, location: { ...prev.location, address: cleanAddress } }));
        } else {
          setNewQueue(prev => ({ ...prev, address: cleanAddress }));
        }
        showNotification("Location pinned and address named!");
      } catch (e) {
        const fallback = "Pinned Map Location";
        if (isEdit) {
          setEditingQueue(prev => ({ ...prev, location: { ...prev.location, address: fallback } }));
        } else {
          setNewQueue(prev => ({ ...prev, address: fallback }));
        }
      }
    }
  };

  const geocodeAddress = async (isEdit = false) => {
    const targetAddress = isEdit ? editingQueue.location?.address : newQueue.address;
    
    if (!targetAddress || targetAddress.trim() === '') {
      showNotification("Please enter an address to search.");
      return;
    }
    if (targetAddress.includes('http')) {
      showNotification("Address is a link. Paste it directly to auto-extract.");
      return;
    }
    
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(targetAddress)}`);
      const data = await res.json();
      
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        if (isEdit) {
          setEditingQueue(prev => ({ ...prev, location: { ...prev.location, lat: parseFloat(lat), lng: parseFloat(lon) } }));
        } else {
          setNewQueue(prev => ({ ...prev, lat: parseFloat(lat), lng: parseFloat(lon) }));
        }
        showNotification("Coordinates successfully loaded from address!");
      } else {
        showNotification("Location not found. Try a more specific address.");
      }
    } catch (err) {
      showNotification("Failed to search location.");
    }
  };

  const captureManagerLocation = (isEdit = false) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          
          if (isEdit) {
            setEditingQueue(prev => ({ ...prev, location: { ...prev.location, lat, lng, address: 'Finding current address...' } }));
          } else {
            setNewQueue(prev => ({ ...prev, lat, lng, address: 'Finding current address...' }));
          }
          showNotification("GPS Captured! Looking up address name...");

          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const data = await res.json();
            const cleanAddress = data.display_name.split(',').slice(0, 3).join(',') || "Current Location";
            
            if (isEdit) {
              setEditingQueue(prev => ({ ...prev, location: { ...prev.location, address: cleanAddress } }));
            } else {
              setNewQueue(prev => ({ ...prev, address: cleanAddress }));
            }
          } catch (e) {
            if (isEdit) {
              setEditingQueue(prev => ({ ...prev, location: { ...prev.location, address: "Current Location" } }));
            } else {
              setNewQueue(prev => ({ ...prev, address: "Current Location" }));
            }
          }
        },
        () => showNotification("Failed to get location.")
      );
    }
  };

  const fetchQueues = async (isInitial = false) => {
    try {
      const res = await fetch(`${API_URL}/queues`);
      const data = await res.json();
      setQueues(data);
    } catch (err) {
      console.error("Failed to fetch queues");
    } finally {
      if (isInitial) setIsInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchQueues(true);
  }, []);

  useEffect(() => {
    if (currentUser?.role === 'customer') {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => console.log("Location access denied.")
        );
      }
    }
  }, [currentUser]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!editingQueue && !editingCustomerTime && !processingActionId) {
      const interval = setInterval(() => fetchQueues(false), 5000); 
      return () => clearInterval(interval);
    }
  }, [editingQueue, editingCustomerTime, processingActionId]);

  useEffect(() => {
    if (currentUser?.role === 'customer') {
      let newNotified = [...notifiedQueues];
      let changed = false;

      queues.forEach(q => {
        const myPos = q.customers.findIndex(c => c.username === currentUser.username);
        
        if (myPos === 0 && !notifiedQueues.includes(q._id)) {
          showNotification(`It's your turn in ${q.name}! Please proceed.`);
          playNotificationSound();
          newNotified.push(q._id);
          changed = true;
        } else if (myPos !== 0 && notifiedQueues.includes(q._id)) {
          newNotified = newNotified.filter(id => id !== q._id);
          changed = true;
        }
      });

      if (changed) {
        setNotifiedQueues(newNotified);
      }
    }
  }, [queues, currentUser, notifiedQueues]);


  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    const { username, password, role } = authForm;
    if (!username || !password) {
      showNotification("Please fill in all fields.");
      return;
    }

    setProcessingActionId('auth'); 
    const endpoint = authMode === "register" ? "/auth/register" : "/auth/login";
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role }),
      });
      const data = await res.json();

      if (!res.ok) {
        showNotification(data.error || "An error occurred");
        setProcessingActionId(null);
        return;
      }

      if (authMode === "register") {
        showNotification("Account created. Please log in.");
        setAuthMode("login");
        setAuthForm({ ...authForm, password: "" });
      } else {
        setCurrentUser(data);
        localStorage.setItem('queueManagerUser', JSON.stringify(data));
        showNotification(`Welcome, ${data.username}!`);
      }
    } catch (err) {
      showNotification("Server connection failed.");
    } finally {
      setProcessingActionId(null);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('queueManagerUser');
    setAuthForm({ username: "", password: "", role: "customer" });
    setSearchQuery("");
  };

  const createQueue = async (e) => {
    e.preventDefault();
    if (!newQueue.name.trim()) return;
    
    setProcessingActionId('create');
    try {
      await fetch(`${API_URL}/queues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newQueue.name,
          manager: currentUser.username,
          avgTime: parseInt(newQueue.avgTime) || 5,
          image: newQueue.image,
          category: newQueue.category,
          location: { address: newQueue.address, lat: newQueue.lat, lng: newQueue.lng }
        }),
      });
      setNewQueue({ name: "", avgTime: 5, image: "", address: "", lat: "", lng: "", category: "Other" });
      document.getElementById("createQueueFileInput").value = "";
      showNotification("Queue created successfully.");
      await fetchQueues();
    } catch (err) {
      showNotification("Failed to create queue.");
    } finally {
      setProcessingActionId(null);
    }
  };

  const updateQueueDetails = async (e) => {
    e.preventDefault();
    setProcessingActionId(editingQueue._id);
    try {
      await fetch(`${API_URL}/queues/${editingQueue._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingQueue.name,
          avgTime: parseInt(editingQueue.avgTime) || 5,
          image: editingQueue.image,
          category: editingQueue.category,
          location: editingQueue.location
        }),
      });
      setEditingQueue(null);
      showNotification("Queue updated.");
      await fetchQueues();
    } catch (err) {
      showNotification("Failed to update queue.");
    } finally {
      setProcessingActionId(null);
    }
  };

  const updateCustomerTime = async (queueId, username, time) => {
    if (!time || isNaN(time)) return;
    setProcessingActionId(queueId);

    setQueues(current => current.map(q => {
      if (q._id !== queueId) return q;
      return {
        ...q,
        customers: q.customers.map(c => c.username === username ? { ...c, expectedTime: parseInt(time) } : c)
      };
    }));

    try {
      await fetch(`${API_URL}/queues/${queueId}/customer-time`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, expectedTime: parseInt(time) }),
      });
    } catch (err) {
      showNotification("Failed to update time.");
    } finally {
      await fetchQueues();
      setProcessingActionId(null);
    }
  };

  const deleteQueue = async (id) => {
    setProcessingActionId(id);
    try {
      setQueues(current => current.filter(q => q._id !== id));
      await fetch(`${API_URL}/queues/${id}`, { method: "DELETE" });
    } finally {
      await fetchQueues();
      setProcessingActionId(null);
    }
  };

  const toggleQueueStatus = async (id) => {
    setProcessingActionId(id);
    try {
      setQueues(current => current.map(q => 
        q._id === id ? { ...q, status: q.status === 'active' ? 'paused' : 'active' } : q
      ));
      await fetch(`${API_URL}/queues/${id}/status`, { method: "PUT" });
    } finally {
      await fetchQueues();
      setProcessingActionId(null);
    }
  };

  const performQueueAction = async (id, action, targetUsername = null, note = '') => {
    const username = targetUsername || currentUser.username;
    setProcessingActionId(id);

    setQueues(currentQueues => currentQueues.map(q => {
      if (q._id !== id) return q;
      const updatedQ = { ...q, customers: [...q.customers] };
      
      if (action === 'next') {
        updatedQ.customers.shift();
        updatedQ.totalServed = (updatedQ.totalServed || 0) + 1;
      } else if (action === 'remove' || action === 'leave') {
        updatedQ.customers = updatedQ.customers.filter(c => c.username !== username);
      } else if (action === 'join') {
        if (!updatedQ.customers.some(c => c.username === username) && updatedQ.status === 'active') {
          updatedQ.customers.push({ username, expectedTime: updatedQ.avgTime, updatedAt: new Date().toISOString(), note });
        }
      }
      return updatedQ;
    }));

    try {
      await fetch(`${API_URL}/queues/${id}/action`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, username, note }),
      });
      if (action === 'join') setJoinNotes(prev => ({ ...prev, [id]: '' }));
    } catch (err) {
    } finally {
      await fetchQueues(); 
      setProcessingActionId(null); 
    }
  };

  let filteredQueues = queues.filter(q => {
    const searchLower = searchQuery.toLowerCase();
    const nameMatch = q.name ? q.name.toLowerCase().includes(searchLower) : false;
    const managerMatch = q.manager ? q.manager.toLowerCase().includes(searchLower) : false;
    const matchesSearch = nameMatch || managerMatch;
    
    const itemCategory = q.category || "Other";
    const matchesCategory = filterCategory === "All" || itemCategory === filterCategory;
    
    return matchesSearch && matchesCategory;
  });

  if (sortBy === "nearest" && userLocation) {
    filteredQueues.sort((a, b) => {
      const getDist = (q) => {
        if (q.location?.lat && q.location?.lng) {
          return parseFloat(calculateDistance(userLocation.lat, userLocation.lng, q.location.lat, q.location.lng));
        }
        return Infinity;
      };
      return getDist(a) - getDist(b);
    });
  } else if (sortBy === "name") {
    filteredQueues.sort((a, b) => a.name.localeCompare(b.name));
  }


  if (isInitialLoading) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)' }}>
          <Loader2 size={36} className="animate-spin" style={{ color: 'var(--text-main)' }} />
          <div style={{ fontWeight: 500, letterSpacing: '0.5px' }}>Loading QueueSys...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      
      {notification && (
        <div className="toast-notification">
          <BellRing size={18} />
          <span>{notification}</span>
        </div>
      )}

      {!currentUser ? (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flexGrow: 1, padding: '2rem 0' }}>
          
          {/* FANCY DESCRIPTIVE BLOCK */}
          <div className="animate-slide-up" style={{ textAlign: 'center', marginBottom: '3rem', maxWidth: '600px' }}>
            <h1 className="animate-gradient-text animate-float" style={{ fontSize: '4.5rem', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '-0.05em' }}>
              QueueSys.
            </h1>
            <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)', lineHeight: 1.6, fontWeight: 400 }}>
              The smartest way to manage waits. Join lines virtually, save your time, and arrive exactly when it's your turn.
            </p>
          </div>

          <div className="premium-card animate-slide-up" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem', animationDelay: '0.15s' }}>
            <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Welcome Back</h2>
              <p className="text-muted text-sm">
                {authMode === 'login' ? 'Sign in to access your queues' : 'Register a new account'}
              </p>
            </div>

            <form onSubmit={handleAuthSubmit}>
              <div className="input-group">
                <label className="input-label">Username</label>
                <div style={{ position: 'relative' }}>
                  <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                  <input
                    type="text"
                    className="premium-input"
                    style={{ paddingLeft: '2.5rem' }}
                    value={authForm.username}
                    onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                    required
                    disabled={processingActionId === 'auth'}
                  />
                </div>
              </div>
              
              <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                <label className="input-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                  <input
                    type="password"
                    className="premium-input"
                    style={{ paddingLeft: '2.5rem' }}
                    value={authForm.password}
                    onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                    required
                    disabled={processingActionId === 'auth'}
                  />
                </div>
              </div>

              {authMode === 'register' && (
                <div className="input-group animate-fade-in" style={{ marginBottom: '1.5rem' }}>
                  <label className="input-label">Account Type</label>
                  <select
                    className="premium-input"
                    value={authForm.role}
                    onChange={(e) => setAuthForm({ ...authForm, role: e.target.value })}
                    disabled={processingActionId === 'auth'}
                  >
                    <option value="customer">Customer</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.875rem' }} disabled={processingActionId === 'auth'}>
                {processingActionId === 'auth' ? (
                  <><Loader2 size={18} className="animate-spin" /> Processing...</>
                ) : (
                  <>{authMode === 'login' ? 'Sign In' : 'Create Account'} <ArrowRight size={18} /></>
                )}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
              <button 
                type="button"
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.875rem', cursor: 'pointer' }}
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'register' : 'login');
                  setNotification("");
                }}
                disabled={processingActionId === 'auth'}
              >
                {authMode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign in'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-fade-in">
          
          <header className="app-header animate-slide-up" style={{ paddingBottom: '1.5rem' }}>
            <div>
              <h1 className="brand animate-gradient-text" style={{ fontSize: '2.25rem', display: 'inline-block' }}>QueueSys.</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
                Your central hub for seamless queue management.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ textAlign: 'right' }} className="hidden-mobile">
                <div className="font-medium text-sm">{currentUser.username}</div>
                <div className="text-muted text-xs">{currentUser.role}</div>
              </div>
              <button onClick={handleLogout} className="btn btn-outline" style={{ padding: '0.5rem 1rem' }}>
                <LogOut size={16} /> <span className="hidden-mobile">Log out</span>
              </button>
            </div>
          </header>

          {/* MANAGER VIEW */}
          {currentUser.role === 'manager' && (
            <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <div className="dashboard-form-container">
                <h3 style={{ fontSize: '1.125rem', marginBottom: '1.25rem' }}>Create New Queue</h3>
                <form onSubmit={createQueue} className="form-grid">
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Queue Name</label>
                    <input 
                      className="premium-input"
                      placeholder="e.g. Genius Bar"
                      value={newQueue.name}
                      onChange={(e) => setNewQueue({ ...newQueue, name: e.target.value })}
                      required
                      disabled={processingActionId === 'create'}
                    />
                  </div>
                  
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Category</label>
                    <select 
                      className="premium-input"
                      value={newQueue.category}
                      onChange={(e) => setNewQueue({ ...newQueue, category: e.target.value })}
                      disabled={processingActionId === 'create'}
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Base Time (m)</label>
                    <input 
                      type="number"
                      min="1"
                      className="premium-input"
                      value={newQueue.avgTime}
                      onChange={(e) => setNewQueue({ ...newQueue, avgTime: e.target.value })}
                      required
                      disabled={processingActionId === 'create'}
                    />
                  </div>

                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label" style={{ display: 'flex', justify-content: 'space-between' }}>
                      <span>Location (Address & Coordinates)</span>
                      <a href="https://www.google.com/maps" target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--text-main)', textDecoration: 'underline' }}>Open Google Maps</a>
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          className="premium-input"
                          placeholder="Paste Address or Maps Link"
                          value={newQueue.address}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val.includes('http') && val.includes('@')) {
                              handleUrlPaste(val, false);
                            } else {
                              setNewQueue({ ...newQueue, address: val });
                            }
                          }}
                          disabled={processingActionId === 'create'}
                        />
                        <button type="button" className="btn btn-outline" onClick={() => geocodeAddress(false)} disabled={processingActionId === 'create' || !newQueue.address} title="Find Coordinates for Address" style={{ padding: '0 0.75rem' }}>
                          <Search size={18} />
                        </button>
                        <button type="button" className="btn btn-outline" onClick={() => captureManagerLocation(false)} disabled={processingActionId === 'create'} title="Use My Current GPS Location" style={{ padding: '0 0.75rem' }}>
                          <MapPin size={18} />
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="number" step="any"
                          className="premium-input text-sm"
                          placeholder="Latitude"
                          value={newQueue.lat || ''}
                          onChange={(e) => setNewQueue({ ...newQueue, lat: e.target.value ? parseFloat(e.target.value) : '' })}
                          disabled={processingActionId === 'create'}
                        />
                        <input
                          type="number" step="any"
                          className="premium-input text-sm"
                          placeholder="Longitude"
                          value={newQueue.lng || ''}
                          onChange={(e) => setNewQueue({ ...newQueue, lng: e.target.value ? parseFloat(e.target.value) : '' })}
                          disabled={processingActionId === 'create'}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="input-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                    <label className="input-label">Cover Image</label>
                    <input 
                      id="createQueueFileInput"
                      type="file"
                      accept="image/*"
                      className="premium-input"
                      style={{ padding: '0.6rem 1rem' }}
                      onChange={handleImageUpload}
                      disabled={processingActionId === 'create'}
                    />
                  </div>

                  <div className="btn-wrapper" style={{ gridColumn: '1 / -1' }}>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '42px' }} disabled={processingActionId === 'create'}>
                      {processingActionId === 'create' ? <Loader2 size={18} className="animate-spin" /> : 'Create Queue'}
                    </button>
                  </div>
                </form>
              </div>

              <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.125rem' }}>Active Queues</h3>
                <span className="text-muted text-sm">({queues.filter(q => q.manager === currentUser.username).length})</span>
              </div>

              <div className="grid-container">
                {queues.filter(q => q.manager === currentUser.username).map(queue => (
                  <div key={queue._id} className="animate-fade-in" style={{ display: 'flex', height: '100%' }}>
                    
                    {/* EDIT MODE */}
                    {editingQueue && editingQueue._id === queue._id ? (
                      <div className="premium-card" style={{ width: '100%' }}>
                        <div className="card-header">
                          <h4 style={{ fontSize: '1rem' }}>Edit Details</h4>
                        </div>
                        <form onSubmit={updateQueueDetails} className="card-body" style={{ display: 'flex', flexDirection: 'column' }}>
                          <div className="input-group">
                            <label className="input-label">Queue Name</label>
                            <input 
                              className="premium-input" 
                              value={editingQueue.name} 
                              onChange={(e) => setEditingQueue({...editingQueue, name: e.target.value})} 
                              required
                              disabled={processingActionId === queue._id}
                            />
                          </div>

                          <div className="input-group">
                            <label className="input-label">Category</label>
                            <select 
                              className="premium-input"
                              value={editingQueue.category || "Other"}
                              onChange={(e) => setEditingQueue({ ...editingQueue, category: e.target.value })}
                              disabled={processingActionId === queue._id}
                            >
                              {CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </div>

                          <div className="input-group">
                            <label className="input-label">Base Wait Time</label>
                            <input 
                              type="number" min="1"
                              className="premium-input" 
                              value={editingQueue.avgTime} 
                              onChange={(e) => setEditingQueue({...editingQueue, avgTime: e.target.value})} 
                              required
                              disabled={processingActionId === queue._id}
                            />
                          </div>

                          <div className="input-group">
                            <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>Location (Address & Coordinates)</span>
                              <a href="https://www.google.com/maps" target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--text-main)', textDecoration: 'underline' }}>Open Google Maps</a>
                            </label>
                            <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input 
                                  className="premium-input"
                                  placeholder="Address or Google Maps Link"
                                  value={editingQueue.location?.address || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val.includes('http') && val.includes('@')) {
                                      handleUrlPaste(val, true);
                                    } else {
                                      setEditingQueue({ 
                                        ...editingQueue, 
                                        location: { ...editingQueue.location, address: val } 
                                      });
                                    }
                                  }}
                                  disabled={processingActionId === queue._id}
                                />
                                <button type="button" className="btn btn-outline" onClick={() => geocodeAddress(true)} disabled={processingActionId === queue._id} title="Find Coordinates for Address" style={{ padding: '0 0.75rem' }}>
                                  <Search size={18} />
                                </button>
                                <button type="button" className="btn btn-outline" onClick={() => captureManagerLocation(true)} disabled={processingActionId === queue._id} title="Use Current GPS Location" style={{ padding: '0 0.75rem' }}>
                                  <MapPin size={18} />
                                </button>
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                  type="number" step="any"
                                  className="premium-input text-sm"
                                  placeholder="Latitude"
                                  value={editingQueue.location?.lat ?? ''}
                                  onChange={(e) => setEditingQueue({ ...editingQueue, location: { ...editingQueue.location, lat: e.target.value ? parseFloat(e.target.value) : null } })}
                                  disabled={processingActionId === queue._id}
                                />
                                <input
                                  type="number" step="any"
                                  className="premium-input text-sm"
                                  placeholder="Longitude"
                                  value={editingQueue.location?.lng ?? ''}
                                  onChange={(e) => setEditingQueue({ ...editingQueue, location: { ...editingQueue.location, lng: e.target.value ? parseFloat(e.target.value) : null } })}
                                  disabled={processingActionId === queue._id}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="input-group" style={{ marginBottom: 'auto' }}>
                            <label className="input-label">Cover Image</label>
                            <input 
                              type="file" accept="image/*" 
                              className="premium-input" style={{ padding: '0.6rem 1rem' }}
                              onChange={handleEditImageUpload} 
                              disabled={processingActionId === queue._id}
                            />
                            {editingQueue.image && (
                              <button 
                                type="button" 
                                className="btn-icon" style={{ alignSelf: 'flex-start', marginTop: '0.5rem', color: 'var(--accent-danger)' }}
                                onClick={() => setEditingQueue({...editingQueue, image: ""})}
                                disabled={processingActionId === queue._id}
                              >
                                <Trash2 size={14} style={{ marginRight: '0.25rem' }}/> Remove Photo
                              </button>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                            <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setEditingQueue(null)} disabled={processingActionId === queue._id}>Cancel</button>
                            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={processingActionId === queue._id}>
                              {processingActionId === queue._id ? <Loader2 size={18} className="animate-spin" /> : 'Save'}
                            </button>
                          </div>
                        </form>
                      </div>

                    ) : (

                      // NORMAL MANAGER CARD VIEW
                      <div className="premium-card" style={{ width: '100%' }}>
                        {queue.image && (
                          <div style={{ height: '140px', width: '100%', borderBottom: '1px solid var(--border)' }}>
                            <img src={queue.image} alt={queue.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        )}

                        <div className="card-header">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                            <div>
                              <h3 style={{ fontSize: '1.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '1rem', marginBottom: '0.25rem' }}>{queue.name}</h3>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-main)', background: '#f1f3f5', padding: '2px 8px', borderRadius: '12px', fontWeight: '500' }}>
                                <Tag size={10} /> {queue.category || 'Other'}
                              </span>
                            </div>
                            <button 
                              className="btn-icon"
                              onClick={() => toggleQueueStatus(queue._id)}
                              title={queue.status === 'active' ? 'Pause Queue' : 'Resume Queue'}
                              disabled={processingActionId === queue._id}
                            >
                              {queue.status === 'active' ? <Pause size={18} /> : <Play size={18} />}
                            </button>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className={`status-badge ${queue.status === 'active' ? 'status-active' : 'status-paused'}`}>
                              {queue.status === 'active' ? 'Receiving' : 'Paused'}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)' }}>
                              <Clock size={14} />
                              <span className="text-sm">Base: {queue.avgTime}m</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)' }}>
                              <CheckCircle2 size={14} />
                              <span className="text-sm">Served: {queue.totalServed || 0}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="card-body" style={{ padding: 0, overflowY: 'auto', maxHeight: '300px' }}>
                          {queue.customers.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-light)' }}>
                              <Users size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }}/>
                              <p className="text-sm">Queue is empty</p>
                            </div>
                          ) : (
                            <ul className="customer-list">
                              {queue.customers.map((c, i) => (
                                <li 
                                  key={c.username}
                                  className="customer-item"
                                  style={{ 
                                    paddingLeft: '0.75rem', 
                                    paddingRight: '1.5rem',
                                    opacity: processingActionId === queue._id ? 0.6 : 1,
                                    border: dragState.index === i && dragState.queueId === queue._id ? '2px dashed var(--text-muted)' : 'none'
                                  }}
                                  draggable={processingActionId !== queue._id}
                                  onDragStart={(e) => onDragStart(e, queue._id, i)}
                                  onDragOver={onDragOver}
                                  onDrop={(e) => onDrop(e, queue._id, i)}
                                >
                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flexDirection: 'column', width: '100%' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                      
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: '0.25rem' }}>
                                          <button 
                                            className="btn-icon" 
                                            style={{ padding: 0, height: '14px', color: i === 0 ? 'transparent' : 'var(--text-muted)' }}
                                            onClick={() => movePosition(queue._id, i, -1)}
                                            disabled={i === 0 || processingActionId === queue._id}
                                          >
                                            <ChevronUp size={14} />
                                          </button>
                                          <GripVertical size={14} style={{ cursor: 'grab', color: 'var(--text-light)', margin: '2px 0' }} title="Drag to reorder" />
                                          <button 
                                            className="btn-icon" 
                                            style={{ padding: 0, height: '14px', color: i === queue.customers.length - 1 ? 'transparent' : 'var(--text-muted)' }}
                                            onClick={() => movePosition(queue._id, i, 1)}
                                            disabled={i === queue.customers.length - 1 || processingActionId === queue._id}
                                          >
                                            <ChevronDown size={14} />
                                          </button>
                                        </div>

                                        <span className="text-muted text-sm" style={{ width: '20px', textAlign: 'right', marginRight: '4px' }}>{i + 1}.</span>
                                        <span className={`text-sm ${i === 0 ? 'font-medium' : ''}`}>{c.username}</span>
                                      </div>
                                      
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {editingCustomerTime?.queueId === queue._id && editingCustomerTime?.username === c.username ? (
                                          <input 
                                            type="number"
                                            className="time-editor-input text-sm"
                                            value={editingCustomerTime.time}
                                            onChange={(e) => setEditingCustomerTime({ ...editingCustomerTime, time: e.target.value })}
                                            autoFocus
                                            disabled={processingActionId === queue._id}
                                            onBlur={() => {
                                              updateCustomerTime(queue._id, c.username, editingCustomerTime.time);
                                              setEditingCustomerTime(null);
                                            }}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                updateCustomerTime(queue._id, c.username, editingCustomerTime.time);
                                                setEditingCustomerTime(null);
                                              }
                                            }}
                                          />
                                        ) : (
                                          <div 
                                            className="time-editor-trigger" 
                                            onClick={() => {
                                              if(processingActionId !== queue._id) {
                                                setEditingCustomerTime({ queueId: queue._id, username: c.username, time: getRemainingTime(c) })
                                              }
                                            }}
                                          >
                                            <span className="text-sm font-medium">{getRemainingTime(c)}m</span>
                                            <PencilLine size={12} className="text-muted" />
                                          </div>
                                        )}

                                        <button 
                                          className="btn-icon" style={{ padding: '0.25rem' }}
                                          onClick={() => performQueueAction(queue._id, 'remove', c.username)}
                                          title="Remove User"
                                          disabled={processingActionId === queue._id}
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </div>

                                    {c.note && (
                                      <div style={{ paddingLeft: '3.75rem', fontSize: '0.75rem', color: '#6b7280', fontStyle: 'italic', marginTop: '-4px' }}>
                                        "{c.note}"
                                      </div>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="card-footer">
                          <button 
                            className="btn btn-primary" style={{ flexGrow: 1 }}
                            disabled={queue.customers.length === 0 || processingActionId === queue._id}
                            onClick={() => performQueueAction(queue._id, 'next')}
                          >
                            {processingActionId === queue._id ? <><Loader2 size={16} className="animate-spin" /> Calling...</> : 'Call Next'}
                          </button>
                          <button 
                            className="btn btn-outline" style={{ padding: '0.75rem' }}
                            onClick={() => setEditingQueue(queue)} 
                            title="Edit Details"
                            disabled={processingActionId === queue._id}
                          >
                            <PencilLine size={18} />
                          </button>
                          <button 
                            className="btn btn-danger" style={{ padding: '0.75rem' }}
                            onClick={() => deleteQueue(queue._id)} title="Delete Queue"
                            disabled={processingActionId === queue._id}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>

                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CUSTOMER VIEW */}
          {currentUser.role === 'customer' && (
            <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
              {/* FILTER BAR ROW */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.25rem' }}>Find a Queue</h3>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', background: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid #eaeaea', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                  
                  {/* Search Filter */}
                  <div style={{ position: 'relative', flexGrow: 1, minWidth: '200px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                    <input 
                      type="text" 
                      className="premium-input" 
                      style={{ paddingLeft: '2.25rem', margin: 0 }}
                      placeholder="Search by manager or queue name..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  {/* Category Filter */}
                  <div style={{ position: 'relative', minWidth: '150px' }}>
                    <Tag size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                    <select 
                      className="premium-input"
                      style={{ paddingLeft: '2.25rem', margin: 0, cursor: 'pointer' }}
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                    >
                      <option value="All">All Categories</option>
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Sort Controls */}
                  <div style={{ position: 'relative', minWidth: '150px' }}>
                    <SlidersHorizontal size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                    <select 
                      className="premium-input"
                      style={{ paddingLeft: '2.25rem', margin: 0, cursor: 'pointer' }}
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <option value="default">Sort: Default</option>
                      <option value="name">Sort: Name (A-Z)</option>
                      {userLocation && <option value="nearest">Sort: Nearest</option>}
                    </select>
                  </div>

                </div>
              </div>

              <div className="grid-container">
                {filteredQueues.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                    <Search size={32} style={{ opacity: 0.3, marginBottom: '1rem', margin: '0 auto' }} />
                    <p>No queues found matching your filters.</p>
                  </div>
                )}
                
                {filteredQueues.map((queue, idx) => {
                  const myPos = queue.customers.findIndex(c => c.username === currentUser.username);
                  const inQueue = myPos !== -1;
                  
                  const totalQueueWait = queue.customers.reduce((sum, c) => sum + (c.expectedTime || 0), 0);

                  let estimatedWait = 0;
                  if (myPos > 0) {
                    for (let i = 0; i < myPos; i++) {
                      estimatedWait += queue.customers[i].expectedTime || 0;
                    }
                  }

                  const distance = queue.location?.lat && queue.location?.lng && userLocation?.lat && userLocation?.lng 
                    ? calculateDistance(userLocation.lat, userLocation.lng, queue.location.lat, queue.location.lng) 
                    : null;
                  
                  return (
                    <div key={queue._id} className="animate-slide-up" style={{ display: 'flex', height: '100%', flexDirection: 'column', animationDelay: `${(idx % 5) * 0.1}s` }}>
                      <div 
                        className="h-100 overflow-hidden d-flex flex-column premium-card" 
                        style={{
                          transition: 'all 0.3s ease',
                          boxShadow: myPos === 0 ? '0 0 0 4px rgba(16, 185, 129, 0.2)' : '0 4px 20px rgba(0,0,0,0.04)',
                          borderColor: inQueue && myPos !== 0 ? '#18181b' : 'transparent',
                          border: '1px solid #eaeaea',
                          borderRadius: '16px',
                          background: '#fff',
                          display: 'flex',
                          flexDirection: 'column',
                          opacity: processingActionId === queue._id ? 0.7 : 1
                        }}
                      >
                        {/* 1. TURN BANNER */}
                        {myPos === 0 && (
                          <div className="animate-fade-in" style={{ background: '#10b981', color: 'white', padding: '10px', textAlign: 'center', fontWeight: '600', fontSize: '0.8rem', letterSpacing: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <CheckCircle size={16} /> YOUR TURN
                          </div>
                        )}

                        {/* 2. IMAGE HERO WITH GRADIENT */}
                        {queue.image ? (
                          <div style={{ height: '160px', width: '100%', position: 'relative' }}>
                            <img src={queue.image} alt={queue.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '70%', background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)' }}></div>
                            
                            {inQueue && <span style={{ position: 'absolute', top: '12px', right: '12px', background: '#fff', color: '#000', padding: '4px 12px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: '600', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>Joined</span>}
                            <span style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(255,255,255,0.9)', color: '#000', padding: '4px 10px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Tag size={10} /> {queue.category || 'Other'}
                            </span>

                            <h4 style={{ position: 'absolute', bottom: '16px', left: '16px', color: '#fff', margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.3)', fontSize: '1.35rem', fontWeight: 'bold' }}>{queue.name}</h4>
                          </div>
                        ) : (
                          <div style={{ padding: '1.5rem 1.5rem 0 1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                              <h4 style={{ margin: 0, fontWeight: 'bold', color: '#18181b', fontSize: '1.35rem' }}>{queue.name}</h4>
                              {inQueue && <span style={{ background: '#18181b', color: '#fff', padding: '4px 12px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: '600' }}>Joined</span>}
                            </div>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: '#71717a', background: '#f4f4f5', padding: '4px 8px', borderRadius: '6px', fontWeight: '500' }}>
                                <Tag size={10} /> {queue.category || 'Other'}
                            </span>
                          </div>
                        )}

                        {/* 3. CARD BODY & STATS */}
                        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#71717a', fontSize: '0.875rem', fontWeight: '500' }}>
                              <UserCircle size={16} /> {queue.manager}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: queue.status === 'active' ? '#10b981' : '#f59e0b' }}></span>
                              <span style={{ fontSize: '0.875rem', color: '#71717a', fontWeight: '500', letterSpacing: '0.5px' }}>{queue.status === 'active' ? 'Receiving' : 'Paused'}</span>
                            </div>
                          </div>

                          {/* Location Info */}
                          {queue.location && (queue.location.address || (queue.location.lat && queue.location.lng)) && (
                            <div 
                              style={{ 
                                display: 'flex', alignItems: 'flex-start', gap: '0.5rem', 
                                color: '#71717a', fontSize: '0.875rem', marginBottom: '1.5rem',
                                cursor: 'pointer', background: '#f8f9fa', padding: '0.75rem', borderRadius: '8px',
                                border: '1px solid #f1f3f5', transition: 'background 0.2s'
                              }}
                              onMouseOver={(e) => e.currentTarget.style.background = '#f1f3f5'}
                              onMouseOut={(e) => e.currentTarget.style.background = '#f8f9fa'}
                              onClick={() => {
                                const query = queue.location.lat && queue.location.lng 
                                  ? `${queue.location.lat},${queue.location.lng}` 
                                  : encodeURIComponent(queue.location.address);
                                window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
                              }}
                            >
                              <MapPin size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#10b981' }} />
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                {/* CHECK FOR UGLY HTTP LINK FROM OLD DATABASE DATA */}
                                {queue.location.address ? (
                                  <span style={{ fontWeight: '500', color: '#18181b', wordBreak: 'break-word' }}>
                                    {queue.location.address.startsWith('http') ? 'View Pinned Map Location' : queue.location.address}
                                  </span>
                                ) : (
                                  <span style={{ fontWeight: '500', color: '#18181b' }}>View Exact Location</span>
                                )}
                                {distance && <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#10b981' }}>{distance} km away</span>}
                              </div>
                            </div>
                          )}
                          
                          {/* Modern Stat Boxes */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.5rem' }}>
                            <div style={{ padding: '0.75rem', borderRadius: '8px', background: '#f8f9fa', border: '1px solid #f1f3f5' }}>
                              <div style={{ color: '#71717a', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>
                                <Users size={12} /> Waiting
                              </div>
                              <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#18181b', lineHeight: 1 }}>{queue.customers.length}</div>
                            </div>
                            <div style={{ padding: '0.75rem', borderRadius: '8px', background: '#f8f9fa', border: '1px solid #f1f3f5' }}>
                              <div style={{ color: '#71717a', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>
                                <Clock size={12} /> Queue Time
                              </div>
                              <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#18181b', lineHeight: 1 }}>{totalQueueWait}<span style={{ fontSize: '1rem', color: '#71717a', marginLeft: '2px', fontWeight: '500' }}>m</span></div>
                            </div>
                          </div>

                          {/* 4. ACTION AREA */}
                          <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid #eaeaea' }}>
                            {inQueue ? (
                              <div className="animate-fade-in" style={{ textAlign: 'center', paddingTop: '0.5rem' }}>
                                <div style={{ color: '#71717a', fontSize: '0.7rem', marginBottom: '1rem', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>Your Status</div>
                                
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '1.5rem', gap: '1.5rem' }}>
                                  <div>
                                    <div style={{ color: '#71717a', fontSize: '0.75rem', fontWeight: '500', marginBottom: '0.25rem' }}>Position</div>
                                    <div style={{ fontSize: '2rem', fontWeight: 'bold', lineHeight: 1, color: myPos === 0 ? '#10b981' : '#18181b' }}>#{myPos + 1}</div>
                                  </div>
                                  {myPos !== 0 && (
                                    <>
                                      <div style={{ width: '1px', height: '40px', background: '#e4e4e7' }}></div>
                                      <div>
                                        <div style={{ color: '#71717a', fontSize: '0.75rem', fontWeight: '500', marginBottom: '0.25rem' }}>Est. Wait</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#18181b', lineHeight: 1 }}>{estimatedWait}<span style={{ fontSize: '1.25rem', color: '#71717a', fontWeight: 'normal', marginLeft: '2px' }}>m</span></div>
                                      </div>
                                    </>
                                  )}
                                </div>
                                
                                {myPos === 0 && (
                                  <div style={{ color: '#10b981', fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '1rem', letterSpacing: '0.5px' }}>Please approach the desk.</div>
                                )}
                                
                                <button 
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: '#fff', color: '#ef4444', border: '1px solid #fca5a5', padding: '10px', borderRadius: '8px', fontWeight: '600', transition: 'all 0.2s', cursor: processingActionId === queue._id ? 'not-allowed' : 'pointer' }}
                                  onMouseOver={(e) => { if(processingActionId !== queue._id) e.currentTarget.style.background = '#fef2f2'; }}
                                  onMouseOut={(e) => { if(processingActionId !== queue._id) e.currentTarget.style.background = '#fff'; }}
                                  onClick={() => performQueueAction(queue._id, 'leave')}
                                  disabled={processingActionId === queue._id}
                                >
                                  {processingActionId === queue._id ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />} 
                                  {processingActionId === queue._id ? 'Processing...' : 'Leave Queue'}
                                </button>
                              </div>
                            ) : (
                              <div style={{ marginTop: '0.25rem' }}>
                                <input 
                                  type="text" 
                                  className="premium-input text-sm" 
                                  style={{ marginBottom: '0.5rem', padding: '0.5rem 1rem' }}
                                  placeholder="Reason for visit (optional)" 
                                  value={joinNotes[queue._id] || ''}
                                  onChange={(e) => setJoinNotes({...joinNotes, [queue._id]: e.target.value})}
                                  disabled={queue.status === 'paused' || processingActionId === queue._id}
                                />
                                <button 
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: '#18181b', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '500', opacity: queue.status === 'paused' || processingActionId === queue._id ? 0.5 : 1, transition: 'all 0.2s', cursor: queue.status === 'paused' || processingActionId === queue._id ? 'not-allowed' : 'pointer' }}
                                  onMouseOver={(e) => { if(queue.status !== 'paused' && processingActionId !== queue._id) e.currentTarget.style.background = '#000'; }}
                                  onMouseOut={(e) => { if(queue.status !== 'paused' && processingActionId !== queue._id) e.currentTarget.style.background = '#18181b'; }}
                                  onClick={() => performQueueAction(queue._id, 'join', null, joinNotes[queue._id])}
                                  disabled={queue.status === 'paused' || processingActionId === queue._id}
                                >
                                  {processingActionId === queue._id ? (
                                    <><Loader2 size={18} className="animate-spin" /> Processing...</>
                                  ) : queue.status === 'active' ? (
                                    <><ArrowRight size={18} /> Join Queue</>
                                  ) : (
                                    'Queue Paused'
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;