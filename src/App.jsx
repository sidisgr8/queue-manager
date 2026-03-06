import { useState } from "react";

function App() {
  // --- MOCK DATABASE ---
  const [users, setUsers] = useState([]); 
  const [queues, setQueues] = useState([]);

  // --- SESSION STATE ---
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState("login"); 
  const [notification, setNotification] = useState("");

  // --- FORM STATE ---
  const [authForm, setAuthForm] = useState({ username: "", password: "", role: "customer" });
  const [newQueue, setNewQueue] = useState({ name: "", avgTime: 5 });
  const [searchQuery, setSearchQuery] = useState("");

  // --- HELPER: SHOW NOTIFICATIONS ---
  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(""), 3000);
  };

  // --- AUTHENTICATION ---
  const handleAuthSubmit = (e) => {
    e.preventDefault();
    const { username, password, role } = authForm;

    if (!username || !password) {
      showNotification("Please fill in all fields.");
      return;
    }

    if (authMode === "register") {
      if (users.some((u) => u.username === username)) {
        showNotification("Username is already taken.");
        return;
      }
      setUsers([...users, { username, password, role }]);
      showNotification("Account created. Please log in.");
      setAuthMode("login");
      setAuthForm({ ...authForm, password: "" });
    } else {
      const foundUser = users.find(u => u.username === username && u.password === password);
      if (foundUser) {
        setCurrentUser(foundUser);
      } else {
        showNotification("Invalid credentials.");
      }
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setAuthForm({ username: "", password: "", role: "customer" });
    setSearchQuery("");
  };

  // --- QUEUE MANAGEMENT (MANAGER) ---
  const createQueue = (e) => {
    e.preventDefault();
    if (!newQueue.name.trim()) return;
    
    setQueues([
      ...queues,
      { 
        id: Date.now(), 
        name: newQueue.name, 
        manager: currentUser.username, 
        customers: [],
        status: 'active',
        avgTime: parseInt(newQueue.avgTime) || 5
      }
    ]);
    setNewQueue({ name: "", avgTime: 5 });
    showNotification("Queue created successfully.");
  };

  const deleteQueue = (id) => setQueues(queues.filter(q => q.id !== id));

  const toggleQueueStatus = (id) => {
    setQueues(queues.map(q => 
      q.id === id ? { ...q, status: q.status === 'active' ? 'paused' : 'active' } : q
    ));
  };

  const processQueue = (id, action, customerName = null) => {
    setQueues(queues.map(q => {
      if (q.id !== id) return q;
      if (action === 'next') return { ...q, customers: q.customers.slice(1) };
      if (action === 'remove') return { ...q, customers: q.customers.filter(c => c !== customerName) };
      return q;
    }));
  };

  // --- QUEUE ACTIONS (CUSTOMER) ---
  const joinQueue = (id) => {
    setQueues(queues.map(q => 
      q.id === id && !q.customers.includes(currentUser.username) && q.status === 'active'
        ? { ...q, customers: [...q.customers, currentUser.username] }
        : q
    ));
  };

  const leaveQueue = (id) => {
    setQueues(queues.map(q => 
      q.id === id 
        ? { ...q, customers: q.customers.filter(u => u !== currentUser.username) }
        : q
    ));
  };

  const filteredQueues = queues.filter(q => 
    q.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    q.manager.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- UI RENDERING ---
  return (
    <div className="container py-5 min-vh-100 d-flex flex-column">
      
      {/* Minimal Notification */}
      {notification && (
        <div className="position-fixed top-0 start-50 translate-middle-x mt-4 animate-fade-in" style={{ zIndex: 1050 }}>
          <div className="bg-dark text-white px-4 py-2 rounded shadow-sm text-sm">
            {notification}
          </div>
        </div>
      )}

      {!currentUser ? (
        // --- LOGIN / REGISTER ---
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
        // --- MAIN DASHBOARD ---
        <div className="animate-fade-in">
          {/* Top Navbar */}
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
                    <div className="col-md-7">
                      <label className="form-label text-muted small mb-1">Queue Name</label>
                      <input 
                        className="form-control minimal-input"
                        placeholder="e.g. Help Desk"
                        value={newQueue.name}
                        onChange={(e) => setNewQueue({ ...newQueue, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label text-muted small mb-1">Est. Time (mins)</label>
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
                    <div key={queue.id} className="col-md-6 col-xl-4 animate-fade-in">
                      <div className="minimal-card h-100 d-flex flex-column">
                        <div className="p-4 border-bottom">
                          <div className="d-flex justify-content-between align-items-start mb-1">
                            <h5 className="fw-bold mb-0 text-truncate pe-2">{queue.name}</h5>
                            <button 
                              className="btn btn-link p-0 text-decoration-none text-muted small"
                              onClick={() => toggleQueueStatus(queue.id)}
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
                            <div className="text-center text-muted py-5 small">
                              Queue is empty.
                            </div>
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
                                    onClick={() => processQueue(queue.id, 'remove', c)}
                                  >
                                    Remove
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="p-3 bg-light border-top d-flex gap-2 rounded-bottom">
                          <button 
                            className="btn-minimal-dark flex-grow-1 text-sm py-1"
                            disabled={queue.customers.length === 0}
                            onClick={() => processQueue(queue.id, 'next')}
                          >
                            Call Next
                          </button>
                          <button 
                            className="btn-minimal-outline text-danger py-1 px-3 border-danger"
                            onClick={() => deleteQueue(queue.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
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
                  <div className="col-12 text-center py-5 text-muted small">
                    No queues found.
                  </div>
                )}
                
                {filteredQueues.map(queue => {
                  const myPos = queue.customers.indexOf(currentUser.username);
                  const inQueue = myPos !== -1;
                  const estimatedWait = myPos > 0 ? myPos * queue.avgTime : 0;
                  
                  return (
                    <div key={queue.id} className="col-md-6 col-xl-4 animate-fade-in">
                      <div className="minimal-card h-100 overflow-hidden" style={inQueue ? {borderColor: 'var(--text-primary)'} : {}}>
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
                                <div className="text-success small fw-medium mb-3">It's your turn.</div>
                              ) : (
                                <div className="text-muted small mb-3">
                                  Est. wait: {estimatedWait} mins
                                </div>
                              )}
                              
                              <button 
                                className="btn-minimal-outline w-100 text-danger"
                                onClick={() => leaveQueue(queue.id)}
                              >
                                Leave Queue
                              </button>
                            </div>
                          ) : (
                            <button 
                              className="btn-minimal-dark w-100"
                              onClick={() => joinQueue(queue.id)}
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