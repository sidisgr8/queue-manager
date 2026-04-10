import { useState, useEffect } from "react";
import { 
  BellRing, LogOut, CheckCircle2, Search, Trash2, 
  PencilLine, Play, Pause, Users, Clock, ArrowRight,
  Image as ImageIcon, User, Lock, ArrowRightCircle,
  UserCircle, CheckCircle, Loader2
} from "lucide-react";

const API_URL = "http://localhost:5000/api";

function App() {
  const [queues, setQueues] = useState([]);
  
  // Initialize user from LocalStorage to keep them logged in
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('queueManagerUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [authMode, setAuthMode] = useState("login"); 
  const [notification, setNotification] = useState("");
  
  const [authForm, setAuthForm] = useState({ username: "", password: "", role: "customer" });
  const [newQueue, setNewQueue] = useState({ name: "", avgTime: 5, image: "" });
  const [searchQuery, setSearchQuery] = useState("");

  const [editingQueue, setEditingQueue] = useState(null);
  const [editingCustomerTime, setEditingCustomerTime] = useState(null); 
  const [notifiedQueues, setNotifiedQueues] = useState([]);

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [processingActionId, setProcessingActionId] = useState(null); 

  // --- REAL-TIME COUNTDOWN STATE ---
  const [now, setNow] = useState(Date.now());

  // Update the 'now' state every 10 seconds to drive the live countdowns
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10000); 
    return () => clearInterval(interval);
  }, []);

  // Helpers to calculate remaining time dynamically
  const getRawRemainingTime = (customer) => {
    if (!customer.updatedAt) return customer.expectedTime || 0;
    const elapsedMinutes = Math.floor((now - new Date(customer.updatedAt).getTime()) / 60000);
    return (customer.expectedTime || 0) - elapsedMinutes;
  };

  const getRemainingTime = (customer) => {
    return Math.max(0, getRawRemainingTime(customer));
  };

  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(""), 3000);
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
          newNotified.push(q._id);
          changed = true;
        } else if (myPos !== 0 && notifiedQueues.includes(q._id)) {
          newNotified = newNotified.filter(id => id !== q._id);
          changed = true;
        }
      });

      if (changed) setNotifiedQueues(newNotified);
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
        localStorage.setItem('queueManagerUser', JSON.stringify(data)); // Save to local storage
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
    localStorage.removeItem('queueManagerUser'); // Clear local storage
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
          image: newQueue.image
        }),
      });
      setNewQueue({ name: "", avgTime: 5, image: "" });
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
          image: editingQueue.image
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

    // Optimistic Update including the new updatedAt timestamp
    setQueues(current => current.map(q => {
      if (q._id !== queueId) return q;
      return {
        ...q,
        customers: q.customers.map(c => c.username === username ? { ...c, expectedTime: parseInt(time), updatedAt: new Date().toISOString() } : c)
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

  const performQueueAction = async (id, action, targetUsername = null) => {
    const username = targetUsername || currentUser.username;
    setProcessingActionId(id);

    setQueues(currentQueues => currentQueues.map(q => {
      if (q._id !== id) return q;
      const updatedQ = { ...q, customers: [...q.customers] };
      
      if (action === 'next') {
        updatedQ.customers.shift();
      } else if (action === 'remove' || action === 'leave') {
        updatedQ.customers = updatedQ.customers.filter(c => c.username !== username);
      } else if (action === 'join') {
        if (!updatedQ.customers.some(c => c.username === username) && updatedQ.status === 'active') {
          // Include timestamp on optimistic join
          updatedQ.customers.push({ username, expectedTime: updatedQ.avgTime, updatedAt: new Date().toISOString() });
        }
      }
      return updatedQ;
    }));

    try {
      await fetch(`${API_URL}/queues/${id}/action`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, username }),
      });
    } catch (err) {
    } finally {
      await fetchQueues(); 
      setProcessingActionId(null); 
    }
  };

  const filteredQueues = queues.filter(q => 
    q.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    q.manager.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }} className="animate-fade-in">
          <div className="premium-card" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem' }}>
            <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>QueueSys.</h2>
              <p className="text-muted text-sm">
                {authMode === 'login' ? 'Sign in to your account' : 'Register a new account'}
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
          <header className="app-header">
            <h1 className="brand">QueueSys.</h1>
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
            <div>
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
                  <div className="btn-wrapper">
                    <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '42px' }} disabled={processingActionId === 'create'}>
                      {processingActionId === 'create' ? <Loader2 size={18} className="animate-spin" /> : 'Create'}
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

                      <div className="premium-card" style={{ width: '100%' }}>
                        {queue.image && (
                          <div style={{ height: '140px', width: '100%', borderBottom: '1px solid var(--border)' }}>
                            <img src={queue.image} alt={queue.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        )}

                        <div className="card-header">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                            <h3 style={{ fontSize: '1.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '1rem' }}>{queue.name}</h3>
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
                                <li key={i} className="customer-item" style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span className="text-muted text-sm" style={{ width: '20px' }}>{i + 1}.</span>
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
                                            // When manager edits, show the remaining time in the input
                                            setEditingCustomerTime({ queueId: queue._id, username: c.username, time: getRemainingTime(c) })
                                          }
                                        }}
                                        style={{ opacity: processingActionId === queue._id ? 0.5 : 1 }}
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
                            onClick={() => setEditingQueue(queue)} title="Edit Details"
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
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '1rem' }}>
                <h3 style={{ fontSize: '1.25rem' }}>Available Queues</h3>
                <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                  <input 
                    type="text" 
                    className="premium-input" 
                    style={{ paddingLeft: '2.25rem', paddingBottom: '0.6rem', paddingTop: '0.6rem' }}
                    placeholder="Search desks or managers..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid-container">
                {filteredQueues.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                    <Search size={32} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                    <p>No queues found matching your search.</p>
                  </div>
                )}
                
                {filteredQueues.map(queue => {
                  const myPos = queue.customers.findIndex(c => c.username === currentUser.username);
                  const inQueue = myPos !== -1;
                  
                  // Total queue wait dynamically sums remaining positive times
                  const totalQueueWait = queue.customers.reduce((sum, c) => sum + getRemainingTime(c), 0);

                  // Estimated wait sums the exact raw remaining times of everyone ahead
                  let estimatedWait = 0;
                  if (myPos > 0) {
                    for (let i = 0; i < myPos; i++) {
                      estimatedWait += getRawRemainingTime(queue.customers[i]);
                    }
                  }
                  
                  return (
                    <div key={queue._id} className="animate-fade-in" style={{ display: 'flex', height: '100%', flexDirection: 'column' }}>
                      <div 
                        className="h-100 overflow-hidden d-flex flex-column" 
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
                        {myPos === 0 && (
                          <div className="animate-fade-in" style={{ background: '#10b981', color: 'white', padding: '10px', textAlign: 'center', fontWeight: '600', fontSize: '0.8rem', letterSpacing: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <CheckCircle size={16} /> YOUR TURN
                          </div>
                        )}

                        {queue.image ? (
                          <div style={{ height: '160px', width: '100%', position: 'relative' }}>
                            <img src={queue.image} alt={queue.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '70%', background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)' }}></div>
                            
                            {inQueue && <span style={{ position: 'absolute', top: '12px', right: '12px', background: '#fff', color: '#000', padding: '4px 12px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: '600', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>Joined</span>}
                            <h4 style={{ position: 'absolute', bottom: '16px', left: '16px', color: '#fff', margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.3)', fontSize: '1.35rem', fontWeight: 'bold' }}>{queue.name}</h4>
                          </div>
                        ) : (
                          <div style={{ padding: '1.5rem 1.5rem 0 1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <h4 style={{ margin: 0, fontWeight: 'bold', color: '#18181b', fontSize: '1.35rem' }}>{queue.name}</h4>
                              {inQueue && <span style={{ background: '#18181b', color: '#fff', padding: '4px 12px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: '600' }}>Joined</span>}
                            </div>
                          </div>
                        )}

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
                                        {/* SHOW MESSAGE IF TIME RUNS OUT */}
                                        {estimatedWait <= 0 ? (
                                          <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#f59e0b', maxWidth: '120px', lineHeight: 1.2 }}>
                                            Please wait, you will be called soon.
                                          </div>
                                        ) : (
                                          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#18181b', lineHeight: 1 }}>
                                            {estimatedWait}<span style={{ fontSize: '1.25rem', color: '#71717a', fontWeight: 'normal', marginLeft: '2px' }}>m</span>
                                          </div>
                                        )}
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
                              <button 
                                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.25rem', background: '#18181b', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '500', opacity: queue.status === 'paused' || processingActionId === queue._id ? 0.5 : 1, transition: 'all 0.2s', cursor: queue.status === 'paused' || processingActionId === queue._id ? 'not-allowed' : 'pointer' }}
                                onMouseOver={(e) => { if(queue.status !== 'paused' && processingActionId !== queue._id) e.currentTarget.style.background = '#000'; }}
                                onMouseOut={(e) => { if(queue.status !== 'paused' && processingActionId !== queue._id) e.currentTarget.style.background = '#18181b'; }}
                                onClick={() => performQueueAction(queue._id, 'join')}
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