import { useState } from "react";

function App() {
  // --- MOCK DATABASE (Replace with MongoDB fetch calls later) ---
  const [users, setUsers] = useState([]); 
  const [queues, setQueues] = useState([]);

  // --- SESSION STATE ---
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState("login"); 
  const [toast, setToast] = useState({ message: "", type: "" });

  // --- FORM STATE ---
  const [authForm, setAuthForm] = useState({ username: "", password: "", role: "customer" });
  const [newQueueName, setNewQueueName] = useState("");

  // --- HELPER: SHOW NOTIFICATIONS ---
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: "" }), 3000);
  };

  // --- AUTHENTICATION ---
  const handleAuthSubmit = (e) => {
    e.preventDefault();
    const { username, password, role } = authForm;

    if (!username || !password) {
      showToast("Please fill in all fields", "danger");
      return;
    }

    if (authMode === "register") {
      if (users.some((u) => u.username === username)) {
        showToast("Username already taken", "danger");
        return;
      }
      setUsers([...users, { username, password, role }]);
      showToast("Account created successfully! Please log in.");
      setAuthMode("login");
      setAuthForm({ ...authForm, password: "" });
    } else {
      const foundUser = users.find(u => u.username === username && u.password === password);
      if (foundUser) {
        setCurrentUser(foundUser);
        showToast(`Welcome back, ${foundUser.username}!`);
      } else {
        showToast("Invalid credentials", "danger");
      }
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setAuthForm({ username: "", password: "", role: "customer" });
  };

  // --- QUEUE MANAGEMENT (MANAGER) ---
  const createQueue = (e) => {
    e.preventDefault();
    if (!newQueueName.trim()) return;
    
    setQueues([
      ...queues,
      { id: Date.now(), name: newQueueName, manager: currentUser.username, customers: [] }
    ]);
    setNewQueueName("");
    showToast("Queue created successfully!");
  };

  const deleteQueue = (id) => {
    setQueues(queues.filter(q => q.id !== id));
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
      q.id === id && !q.customers.includes(currentUser.username)
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

  // --- UI RENDERING ---
  return (
    <div className="container py-5 min-vh-100 d-flex flex-column">
      
      {/* Toast Notification */}
      {toast.message && (
        <div className={`alert alert-${toast.type} position-fixed top-0 start-50 translate-middle-x mt-4 shadow animate-fade-in`} style={{ zIndex: 1050, minWidth: '300px', textAlign: 'center', borderRadius: '10px' }}>
          {toast.message}
        </div>
      )}

      {!currentUser ? (
        // --- LOGIN / REGISTER SCREEN ---
        <div className="row justify-content-center align-items-center flex-grow-1 animate-fade-in">
          <div className="col-11 col-md-6 col-lg-5">
            <div className="card hover-card shadow-sm p-4 p-md-5">
              <div className="text-center mb-4">
                <div className="bg-gradient-primary rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{width: '60px', height: '60px'}}>
                  <span className="fs-3 text-white">Q</span>
                </div>
                <h2 className="fw-bold">{authMode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
                <p className="text-muted">Smart Queue Management System</p>
              </div>

              <form onSubmit={handleAuthSubmit}>
                <div className="mb-3">
                  <label className="form-label text-muted fw-bold small text-uppercase">Username</label>
                  <input
                    type="text"
                    className="form-control form-control-lg bg-light"
                    value={authForm.username}
                    onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                    required
                  />
                </div>
                
                <div className="mb-3">
                  <label className="form-label text-muted fw-bold small text-uppercase">Password</label>
                  <input
                    type="password"
                    className="form-control form-control-lg bg-light"
                    value={authForm.password}
                    onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                    required
                  />
                </div>

                {authMode === 'register' && (
                  <div className="mb-4">
                    <label className="form-label text-muted fw-bold small text-uppercase">Select Role</label>
                    <select
                      className="form-select form-select-lg bg-light"
                      value={authForm.role}
                      onChange={(e) => setAuthForm({ ...authForm, role: e.target.value })}
                    >
                      <option value="customer">Customer</option>
                      <option value="manager">Queue Manager</option>
                    </select>
                  </div>
                )}

                <button className="btn btn-gradient btn-lg w-100 mt-2 mb-3 rounded-3 shadow-sm">
                  {authMode === 'login' ? 'Sign In' : 'Register Now'}
                </button>
              </form>

              <div className="text-center mt-3">
                <span className="text-muted">
                  {authMode === 'login' ? "New here? " : "Already have an account? "}
                </span>
                <button 
                  className="btn btn-link p-0 text-decoration-none fw-bold" 
                  onClick={() => {
                    setAuthMode(authMode === 'login' ? 'register' : 'login');
                    setToast({ message: "", type: "" });
                  }}
                >
                  {authMode === 'login' ? 'Create an account' : 'Sign in'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // --- MAIN DASHBOARD ---
        <div className="animate-fade-in">
          {/* Top Navbar */}
          <nav className="card hover-card shadow-sm mb-5 border-0">
            <div className="card-body d-flex justify-content-between align-items-center px-4 py-3">
              <div className="d-flex align-items-center gap-2">
                <div className="bg-gradient-primary rounded px-2 py-1 text-white fw-bold">Q</div>
                <h4 className="mb-0 fw-bold d-none d-sm-block">QueueSystem</h4>
              </div>
              <div className="d-flex align-items-center gap-4">
                <div className="text-end">
                  <div className="fw-bold fs-5">{currentUser.username}</div>
                  <span className={`badge ${currentUser.role === 'manager' ? 'bg-primary' : 'bg-success'} rounded-pill text-uppercase`}>
                    {currentUser.role}
                  </span>
                </div>
                <button onClick={handleLogout} className="btn btn-light border rounded-circle p-2" title="Logout">
                  <span aria-hidden="true">🚪</span>
                </button>
              </div>
            </div>
          </nav>

          {/* MANAGER VIEW */}
          {currentUser.role === 'manager' && (
            <div className="row g-4">
              <div className="col-12">
                <div className="card hover-card shadow-sm border-0 bg-white p-4">
                  <h5 className="fw-bold mb-3">Launch a New Queue</h5>
                  <form onSubmit={createQueue} className="d-flex flex-column flex-md-row gap-3">
                    <input 
                      className="form-control form-control-lg bg-light border-0"
                      placeholder="e.g. Dr. Smith Consultation, Table Checkout..."
                      value={newQueueName}
                      onChange={(e) => setNewQueueName(e.target.value)}
                      required
                    />
                    <button className="btn btn-gradient px-5 btn-lg rounded-3 shadow-sm">Create</button>
                  </form>
                </div>
              </div>

              <div className="col-12 mt-5">
                <h5 className="fw-bold text-muted mb-4 px-2">YOUR ACTIVE QUEUES</h5>
                <div className="row g-4">
                  {queues.filter(q => q.manager === currentUser.username).map(queue => (
                    <div key={queue.id} className="col-md-6 col-xl-4">
                      <div className="card hover-card shadow-sm border-0 h-100 overflow-hidden">
                        <div className="bg-gradient-primary p-3 d-flex justify-content-between align-items-center">
                          <h5 className="mb-0 fw-bold text-white text-truncate pe-2">{queue.name}</h5>
                          <span className="badge bg-white text-primary rounded-pill fs-6 px-3 py-2 shadow-sm">
                            {queue.customers.length} Waiting
                          </span>
                        </div>
                        
                        <div className="card-body p-0">
                          {queue.customers.length === 0 ? (
                            <div className="text-center text-muted py-5">
                              <div className="fs-1 mb-2">🪑</div>
                              <p className="mb-0">No one is waiting yet.</p>
                            </div>
                          ) : (
                            <ul className="list-group list-group-flush">
                              {queue.customers.map((c, i) => (
                                <li key={i} className="list-group-item p-3 d-flex justify-content-between align-items-center">
                                  <div className="d-flex align-items-center gap-3">
                                    <span className={`badge rounded-circle d-flex align-items-center justify-content-center shadow-sm ${i === 0 ? 'bg-success fs-6' : 'bg-light text-dark border'}`} style={{width: i === 0 ? '35px' : '30px', height: i === 0 ? '35px' : '30px'}}>
                                      {i + 1}
                                    </span>
                                    <span className={`fs-5 ${i === 0 ? 'fw-bold text-success' : 'fw-medium'}`}>{c}</span>
                                  </div>
                                  <button 
                                    className="btn btn-sm btn-outline-danger rounded-pill px-3"
                                    onClick={() => processQueue(queue.id, 'remove', c)}
                                  >
                                    Remove
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div className="card-footer bg-white border-top p-3 d-flex gap-2">
                          <button 
                            className="btn btn-success flex-grow-1 fw-bold rounded-3 py-2"
                            disabled={queue.customers.length === 0}
                            onClick={() => processQueue(queue.id, 'next')}
                          >
                            Call Next Person
                          </button>
                          <button 
                            className="btn btn-danger rounded-3 px-3"
                            onClick={() => deleteQueue(queue.id)}
                            title="Delete Queue"
                          >
                            🗑️
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
              <h5 className="fw-bold text-muted mb-4 px-2">JOIN A QUEUE</h5>
              <div className="row g-4">
                {queues.length === 0 && (
                  <div className="col-12 text-center py-5">
                    <div className="fs-1 mb-3">🏢</div>
                    <p className="text-muted fs-5">There are no active queues available right now.</p>
                  </div>
                )}
                
                {queues.map(queue => {
                  const myPos = queue.customers.indexOf(currentUser.username);
                  const inQueue = myPos !== -1;
                  
                  return (
                    <div key={queue.id} className="col-md-6 col-xl-4">
                      <div className={`card hover-card shadow-sm h-100 border-0 ${inQueue ? 'ring ring-primary ring-offset-2' : ''}`} style={inQueue ? {boxShadow: '0 0 0 3px #4f46e5'} : {}}>
                        <div className="card-body p-4">
                          <div className="d-flex justify-content-between align-items-start mb-3">
                            <div>
                              <h4 className="fw-bold mb-1">{queue.name}</h4>
                              <p className="text-muted small mb-0">Manager: {queue.manager}</p>
                            </div>
                            {inQueue && <span className="badge bg-primary px-3 py-2 rounded-pill shadow-sm animate-fade-in">Joined</span>}
                          </div>
                          
                          <div className="bg-light rounded-3 p-3 mb-4 d-flex justify-content-between align-items-center border">
                            <div className="d-flex align-items-center">
                              <div className="status-pulse"></div>
                              <span className="fw-bold text-muted small text-uppercase">Live Status</span>
                            </div>
                            <div className="text-end">
                              <span className="fs-3 fw-bold">{queue.customers.length}</span>
                              <span className="text-muted small ms-1">waiting</span>
                            </div>
                          </div>

                          {inQueue ? (
                            <div className="text-center animate-fade-in bg-white border rounded-3 p-3 mb-3 shadow-sm">
                              <p className="text-muted mb-1 small text-uppercase fw-bold">Your Position</p>
                              <div className="display-4 fw-bold text-primary mb-2">#{myPos + 1}</div>
                              {myPos === 0 ? (
                                <div className="badge bg-success w-100 py-2 fs-6 rounded-pill mb-2">It's your turn! 🎉</div>
                              ) : (
                                <div className="text-muted small mb-2">{myPos} people ahead of you</div>
                              )}
                              <button 
                                className="btn btn-outline-danger w-100 rounded-pill fw-bold mt-2"
                                onClick={() => leaveQueue(queue.id)}
                              >
                                Leave Queue
                              </button>
                            </div>
                          ) : (
                            <button 
                              className="btn btn-dark w-100 rounded-pill py-3 fw-bold fs-5 shadow-sm"
                              onClick={() => joinQueue(queue.id)}
                            >
                              Join Queue
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