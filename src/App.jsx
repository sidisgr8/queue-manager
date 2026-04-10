import { useState, useEffect } from "react";

const API_URL = "http://localhost:5000/api";

function App() {
  const [queues, setQueues] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState("login"); 
  const [notification, setNotification] = useState("");
  
  // Forms
  const [authForm, setAuthForm] = useState({ username: "", password: "", role: "customer" });
  const [newQueue, setNewQueue] = useState({ name: "", avgTime: 5, image: "" });
  const [searchQuery, setSearchQuery] = useState("");

  // Edit State Tracking
  const [editingQueue, setEditingQueue] = useState(null);

  // Tracking notifications
  const [notifiedQueues, setNotifiedQueues] = useState([]);

  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(""), 3000);
  };

  // --- IMAGE UPLOAD HANDLERS ---
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

  // --- FETCHING & POLLING ---
  const fetchQueues = async () => {
    try {
      const res = await fetch(`${API_URL}/queues`);
      const data = await res.json();
      setQueues(data);
    } catch (err) {
      console.error("Failed to fetch queues");
    }
  };

  useEffect(() => {
    fetchQueues();
    // Only poll if we aren't currently editing a queue (prevents form jumping)
    if (!editingQueue) {
      const interval = setInterval(fetchQueues, 5000); 
      return () => clearInterval(interval);
    }
  }, [editingQueue]);

  useEffect(() => {
    if (currentUser?.role === 'customer') {
      let newNotified = [...notifiedQueues];
      let changed = false;

      queues.forEach(q => {
        const myPos = q.customers.indexOf(currentUser.username);
        if (myPos === 0 && !notifiedQueues.includes(q._id)) {
          showNotification(`🎉 It's your turn in ${q.name}! Please proceed.`);
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


  // --- AUTHENTICATION ---
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    const { username, password, role } = authForm;

    if (!username || !password) {
      showNotification("Please fill in all fields.");
      return;
    }

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
        return;
      }

      if (authMode === "register") {
        showNotification("Account created. Please log in.");
        setAuthMode("login");
        setAuthForm({ ...authForm, password: "" });
      } else {
        setCurrentUser(data);
        showNotification(`Welcome, ${data.username}!`);
      }
    } catch (err) {
      showNotification("Server connection failed.");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setAuthForm({ username: "", password: "", role: "customer" });
    setSearchQuery("");
  };

  // --- QUEUE MANAGEMENT ---
  const createQueue = async (e) => {
    e.preventDefault();
    if (!newQueue.name.trim()) return;
    
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
      // Reset the file input visually
      document.getElementById("createQueueFileInput").value = "";
      showNotification("Queue created successfully.");
      fetchQueues();
    } catch (err) {
      showNotification("Failed to create queue.");
    }
  };

  const updateQueueDetails = async (e) => {
    e.preventDefault();
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
      fetchQueues();
    } catch (err) {
      showNotification("Failed to update queue.");
    }
  };

  const deleteQueue = async (id) => {
    await fetch(`${API_URL}/queues/${id}`, { method: "DELETE" });
    fetchQueues();
  };

  const toggleQueueStatus = async (id) => {
    await fetch(`${API_URL}/queues/${id}/status`, { method: "PUT" });
    fetchQueues();
  };

  const performQueueAction = async (id, action, targetUsername = null) => {
    await fetch(`${API_URL}/queues/${id}/action`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, username: targetUsername || currentUser.username }),
    });
    fetchQueues();
  };

  const filteredQueues = queues.filter(q => 
    q.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    q.manager.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container py-5 min-vh-100 d-flex flex-column">
      
      {notification && (
        <div className="position-fixed top-0 start-50 translate-middle-x mt-4 animate-fade-in" style={{ zIndex: 1050 }}>
          <div className="bg-dark text-white px-4 py-2 rounded shadow-sm text-sm">
            {notification}
          </div>
        </div>
      )}

      {!currentUser ? (
        // --- LOGIN / REGISTER UI ---
        <div className="row justify-content-center align-items-center flex-grow-1 animate-fade-in">
          <div className="col-11 col-md-5 col-lg-4">
            <div className="minimal-card p-4 p-md-5">
              <div className="mb-4">
                <h3 className="fw-bold text-dark mb-1">QueueSys.</h3>
                <p className="text-muted small">
                  {authMode === 'login' ? 'Sign in to your account' : 'Register a new account'}
                </p>
              </div>

              <form onSubmit={handleAuthSubmit}>
                <div className="mb-3">
                  <label className="form-label text-muted small fw-medium">Username</label>
                  <input
                    type="text"
                    className="form-control minimal-input w-100"
                    value={authForm.username}
                    onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                    required
                  />
                </div>
                
                <div className="mb-4">
                  <label className="form-label text-muted small fw-medium">Password</label>
                  <input
                    type="password"
                    className="form-control minimal-input w-100"
                    value={authForm.password}
                    onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                    required
                  />
                </div>

                {authMode === 'register' && (
                  <div className="mb-4 animate-fade-in">
                    <label className="form-label text-muted small fw-medium">Account Type</label>
                    <select
                      className="form-select minimal-input w-100"
                      value={authForm.role}
                      onChange={(e) => setAuthForm({ ...authForm, role: e.target.value })}
                    >
                      <option value="customer">Customer</option>
                      <option value="manager">Manager</option>
                    </select>
                  </div>
                )}

                <button className="btn-minimal-dark w-100 mb-3">
                  {authMode === 'login' ? 'Sign In' : 'Register'}
                </button>
              </form>

              <div className="text-center mt-2 pt-3 border-top border-light">
                <button 
                  type="button"
                  className="btn btn-link p-0 text-decoration-none text-muted small" 
                  onClick={() => {
                    setAuthMode(authMode === 'login' ? 'register' : 'login');
                    setNotification("");
                  }}
                >
                  {authMode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign in'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // --- MAIN DASHBOARD UI ---
        <div className="animate-fade-in">
          <div className="d-flex justify-content-between align-items-center mb-5 pb-3 border-bottom">
            <h4 className="m-0 fw-bold">QueueSys.</h4>
            <div className="d-flex align-items-center gap-3">
              <div className="text-end d-none d-sm-block">
                <div className="fw-medium small text-dark">{currentUser.username}</div>
                <div className="text-muted" style={{fontSize: '0.7rem', textTransform: 'uppercase'}}>{currentUser.role}</div>
              </div>
              <button onClick={handleLogout} className="btn-minimal-outline py-1 px-3 text-sm">
                Log out
              </button>
            </div>
          </div>

          {/* MANAGER VIEW */}
          {currentUser.role === 'manager' && (
            <div className="row g-4">
              <div className="col-12 mb-2">
                <h6 className="text-muted text-uppercase mb-3" style={{letterSpacing: '0.05em'}}>Create Queue</h6>
                <div className="minimal-card p-4">
                  <form onSubmit={createQueue} className="row g-3 align-items-end">
                    <div className="col-md-4">
                      <label className="form-label text-muted small mb-1">Queue Name</label>
                      <input 
                        className="form-control minimal-input"
                        placeholder="e.g. Help Desk"
                        value={newQueue.name}
                        onChange={(e) => setNewQueue({ ...newQueue, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label text-muted small mb-1">Cover Image (Optional)</label>
                      <input 
                        id="createQueueFileInput"
                        type="file"
                        accept="image/*"
                        className="form-control minimal-input"
                        onChange={handleImageUpload}
                      />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label text-muted small mb-1">Time (mins)</label>
                      <input 
                        type="number"
                        min="1"
                        className="form-control minimal-input"
                        value={newQueue.avgTime}
                        onChange={(e) => setNewQueue({ ...newQueue, avgTime: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-md-2">
                      <button className="btn-minimal-dark w-100">Create</button>
                    </div>
                  </form>
                </div>
              </div>

              <div className="col-12">
                <h6 className="text-muted text-uppercase mb-3 mt-4" style={{letterSpacing: '0.05em'}}>Active Queues</h6>
                <div className="row g-4">
                  {queues.filter(q => q.manager === currentUser.username).map(queue => (
                    <div key={queue._id} className="col-md-6 col-xl-4 animate-fade-in">
                      
                      {/* CARD TOGGLES BETWEEN EDIT AND VIEW MODE */}
                      {editingQueue && editingQueue._id === queue._id ? (
                        
                        // --- EDIT MODE VIEW ---
                        <div className="minimal-card h-100 d-flex flex-column p-4">
                          <h6 className="fw-bold mb-4">Edit Queue Details</h6>
                          <form onSubmit={updateQueueDetails} className="d-flex flex-column flex-grow-1">
                            <div className="mb-3">
                              <label className="form-label text-muted small mb-1">Queue Name</label>
                              <input 
                                className="form-control minimal-input" 
                                value={editingQueue.name} 
                                onChange={(e) => setEditingQueue({...editingQueue, name: e.target.value})} 
                                required
                              />
                            </div>
                            <div className="mb-3">
                              <label className="form-label text-muted small mb-1">Est. Wait Time (mins)</label>
                              <input 
                                type="number" 
                                min="1"
                                className="form-control minimal-input" 
                                value={editingQueue.avgTime} 
                                onChange={(e) => setEditingQueue({...editingQueue, avgTime: e.target.value})} 
                                required
                              />
                            </div>
                            <div className="mb-4">
                              <label className="form-label text-muted small mb-1">Cover Image</label>
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="form-control minimal-input" 
                                onChange={handleEditImageUpload} 
                              />
                              {editingQueue.image && (
                                <button 
                                  type="button" 
                                  className="btn btn-link text-danger p-0 mt-2 text-decoration-none small"
                                  onClick={() => setEditingQueue({...editingQueue, image: ""})}
                                >
                                  Remove Image
                                </button>
                              )}
                            </div>
                            <div className="mt-auto d-flex gap-2">
                              <button type="submit" className="btn-minimal-dark flex-grow-1 py-1">Save Changes</button>
                              <button type="button" className="btn-minimal-outline py-1 px-3" onClick={() => setEditingQueue(null)}>Cancel</button>
                            </div>
                          </form>
                        </div>

                      ) : (

                        // --- NORMAL MANAGER CARD VIEW ---
                        <div className="minimal-card h-100 d-flex flex-column overflow-hidden">
                          {queue.image && (
                            <div style={{ height: '140px', width: '100%', overflow: 'hidden', borderBottom: '1px solid #eaeaea' }}>
                              <img src={queue.image} alt={queue.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          )}

                          <div className="p-4 border-bottom">
                            <div className="d-flex justify-content-between align-items-start mb-1">
                              <h5 className="fw-bold mb-0 text-truncate pe-2">{queue.name}</h5>
                              <button 
                                className="btn btn-link p-0 text-decoration-none text-muted small"
                                onClick={() => toggleQueueStatus(queue._id)}
                              >
                                {queue.status === 'active' ? 'Pause' : 'Resume'}
                              </button>
                            </div>
                            <div className="d-flex align-items-center gap-2 mt-2">
                              <span className={`status-dot ${queue.status === 'active' ? 'status-active' : 'status-paused'}`}></span>
                              <span className="text-muted small text-capitalize">{queue.status}</span>
                              <span className="text-muted small ms-auto">{queue.avgTime}m / person</span>
                            </div>
                          </div>
                          
                          <div className="card-body p-0 flex-grow-1">
                            {queue.customers.length === 0 ? (
                              <div className="text-center text-muted py-5 small">Queue is empty.</div>
                            ) : (
                              <ul className="list-group list-group-flush">
                                {queue.customers.map((c, i) => (
                                  <li key={i} className="list-group-item bg-transparent p-3 d-flex justify-content-between align-items-center border-0 border-bottom">
                                    <div className="d-flex align-items-center gap-3">
                                      <span className="text-muted small" style={{width: '20px'}}>{i + 1}.</span>
                                      <span className={`small ${i === 0 ? 'fw-bold' : ''}`}>{c}</span>
                                    </div>
                                    <button 
                                      className="btn btn-link text-muted p-0 text-decoration-none small"
                                      onClick={() => performQueueAction(queue._id, 'remove', c)}
                                    >
                                      Remove
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          {/* ACTION BUTTONS WITH "EDIT" ADDED */}
                          <div className="p-3 bg-light border-top d-flex gap-2 rounded-bottom flex-wrap">
                            <button 
                              className="btn-minimal-dark flex-grow-1 text-sm py-1"
                              disabled={queue.customers.length === 0}
                              onClick={() => performQueueAction(queue._id, 'next')}
                            >
                              Call Next
                            </button>
                            <button 
                              className="btn-minimal-outline text-primary py-1 px-3 border-primary"
                              onClick={() => setEditingQueue(queue)}
                            >
                              Edit
                            </button>
                            <button 
                              className="btn-minimal-outline text-danger py-1 px-3 border-danger"
                              onClick={() => deleteQueue(queue._id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* CUSTOMER VIEW */}
          {currentUser.role === 'customer' && (
            <div>
              <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4">
                <h6 className="text-muted text-uppercase m-0" style={{letterSpacing: '0.05em'}}>Available Queues</h6>
                <input 
                  type="text" 
                  className="form-control minimal-input mt-3 mt-md-0" 
                  placeholder="Search queues..." 
                  style={{maxWidth: '250px'}}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="row g-4">
                {filteredQueues.length === 0 && (
                  <div className="col-12 text-center py-5 text-muted small">No queues found.</div>
                )}
                
                {filteredQueues.map(queue => {
                  const myPos = queue.customers.indexOf(currentUser.username);
                  const inQueue = myPos !== -1;
                  const estimatedWait = myPos > 0 ? myPos * queue.avgTime : 0;
                  
                  return (
                    <div key={queue._id} className="col-md-6 col-xl-4 animate-fade-in">
                      <div 
                        className={`minimal-card h-100 overflow-hidden ${myPos === 0 ? 'my-turn-card' : ''}`} 
                        style={inQueue && myPos !== 0 ? {borderColor: 'var(--text-primary)'} : {}}
                      >
                        {myPos === 0 && (
                          <div className="bg-success text-white text-center py-2 fw-bold shadow-sm animate-fade-in" style={{ letterSpacing: '2px' }}>
                            🚨 IT IS YOUR TURN! 🚨
                          </div>
                        )}

                        {queue.image && (
                          <div style={{ height: '140px', width: '100%', overflow: 'hidden', borderBottom: '1px solid #eaeaea' }}>
                            <img src={queue.image} alt={queue.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        )}

                        <div className="p-4">
                          <div className="d-flex justify-content-between align-items-start mb-2">
                            <h5 className="fw-bold mb-0 text-dark">{queue.name}</h5>
                            {inQueue && <span className="minimal-badge active">Joined</span>}
                          </div>
                          
                          <div className="text-muted small mb-4">
                            Manager: {queue.manager}
                          </div>
                          
                          <div className="d-flex justify-content-between align-items-center mb-4 pb-4 border-bottom">
                            <div className="d-flex align-items-center gap-2">
                              <span className={`status-dot ${queue.status === 'active' ? 'status-active' : 'status-paused'}`}></span>
                              <span className="small text-muted text-capitalize">{queue.status}</span>
                            </div>
                            <div className="text-end">
                              <span className="fw-bold">{queue.customers.length}</span>
                              <span className="text-muted small ms-1">waiting</span>
                            </div>
                          </div>

                          {inQueue ? (
                            <div className="text-center animate-fade-in">
                              <div className="text-muted small mb-1">Your Position</div>
                              <div className="fs-2 fw-bold mb-2">#{myPos + 1}</div>
                              
                              {myPos === 0 ? (
                                <div className="text-success small fw-medium mb-3">Please proceed to the desk.</div>
                              ) : (
                                <div className="text-muted small mb-3">
                                  Est. wait: {estimatedWait} mins
                                </div>
                              )}
                              
                              <button 
                                className="btn-minimal-outline w-100 text-danger"
                                onClick={() => performQueueAction(queue._id, 'leave')}
                              >
                                Leave Queue
                              </button>
                            </div>
                          ) : (
                            <button 
                              className="btn-minimal-dark w-100"
                              onClick={() => performQueueAction(queue._id, 'join')}
                              disabled={queue.status === 'paused'}
                            >
                              {queue.status === 'active' ? 'Join Queue' : 'Paused'}
                            </button>
                          )}
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