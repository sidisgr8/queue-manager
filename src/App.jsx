import { useState } from "react";

function App() {
  // --- STATE ---
  // user: { name: string, role: 'customer' | 'manager' }
  const [user, setUser] = useState(null);
  
  // queues: [{ id: number, name: string, manager: string, customers: string[] }]
  const [queues, setQueues] = useState([]);

  // Login Form State
  const [loginName, setLoginName] = useState("");
  const [loginRole, setLoginRole] = useState("customer");

  // Manager Form State
  const [newQueueName, setNewQueueName] = useState("");

  // --- HANDLERS ---
  const handleLogin = (e) => {
    e.preventDefault();
    if (loginName.trim() === "") return;
    setUser({ name: loginName.trim(), role: loginRole });
  };

  const handleLogout = () => {
    setUser(null);
    setLoginName("");
  };

  // --- MANAGER FUNCTIONS ---
  const createQueue = (e) => {
    e.preventDefault();
    if (newQueueName.trim() === "") return;

    const newQueue = {
      id: Date.now(),
      name: newQueueName.trim(),
      manager: user.name,
      customers: [],
    };
    setQueues([...queues, newQueue]);
    setNewQueueName("");
  };

  const deleteQueue = (id) => {
    setQueues(queues.filter((q) => q.id !== id));
  };

  const callNextPerson = (id) => {
    setQueues(
      queues.map((q) => {
        if (q.id === id && q.customers.length > 0) {
          // Remove the first customer
          return { ...q, customers: q.customers.slice(1) };
        }
        return q;
      })
    );
  };

  const removeSpecificPerson = (queueId, customerName) => {
    setQueues(
      queues.map((q) => {
        if (q.id === queueId) {
          return {
            ...q,
            customers: q.customers.filter((c) => c !== customerName),
          };
        }
        return q;
      })
    );
  };

  // --- CUSTOMER FUNCTIONS ---
  const joinQueue = (id) => {
    setQueues(
      queues.map((q) => {
        if (q.id === id && !q.customers.includes(user.name)) {
          return { ...q, customers: [...q.customers, user.name] };
        }
        return q;
      })
    );
  };

  const leaveQueue = (id) => {
    setQueues(
      queues.map((q) => {
        if (q.id === id) {
          return {
            ...q,
            customers: q.customers.filter((c) => c !== user.name),
          };
        }
        return q;
      })
    );
  };

  // --- VIEWS ---
  if (!user) {
    return (
      <div className="container mt-5" style={{ maxWidth: "500px" }}>
        <div className="card shadow-sm p-4">
          <h2 className="text-center mb-4">Queue Manager Login</h2>
          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <label className="form-label">Username</label>
              <input
                type="text"
                className="form-control"
                placeholder="Enter your name"
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                required
              />
            </div>
            <div className="mb-4">
              <label className="form-label">Role</label>
              <select
                className="form-select"
                value={loginRole}
                onChange={(e) => setLoginRole(e.target.value)}
              >
                <option value="customer">Customer</option>
                <option value="manager">Queue Manager</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary w-100">
              Enter System
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <h2>
          Welcome, {user.name}{" "}
          <span className="badge bg-secondary fs-6">{user.role}</span>
        </h2>
        <button className="btn btn-outline-danger" onClick={handleLogout}>
          Logout
        </button>
      </div>

      {/* MANAGER VIEW */}
      {user.role === "manager" && (
        <div className="row">
          <div className="col-md-4 mb-4">
            <div className="card shadow-sm p-4">
              <h4>Create New Queue</h4>
              <form onSubmit={createQueue} className="mt-3">
                <input
                  type="text"
                  className="form-control mb-3"
                  placeholder="e.g. Dr. Smith's Clinic"
                  value={newQueueName}
                  onChange={(e) => setNewQueueName(e.target.value)}
                  required
                />
                <button type="submit" className="btn btn-success w-100">
                  Create Queue
                </button>
              </form>
            </div>
          </div>

          <div className="col-md-8">
            <h4>Your Active Queues</h4>
            {queues.filter((q) => q.manager === user.name).length === 0 && (
              <p className="text-muted">You haven't created any queues yet.</p>
            )}
            {queues
              .filter((q) => q.manager === user.name)
              .map((queue) => (
                <div key={queue.id} className="card shadow-sm mb-3">
                  <div className="card-header d-flex justify-content-between align-items-center bg-light">
                    <h5 className="mb-0">{queue.name}</h5>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => deleteQueue(queue.id)}
                    >
                      Delete Queue
                    </button>
                  </div>
                  <div className="card-body">
                    <div className="d-flex justify-content-between mb-3">
                      <p className="mb-0">
                        <strong>Total Waiting:</strong> {queue.customers.length}
                      </p>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => callNextPerson(queue.id)}
                        disabled={queue.customers.length === 0}
                      >
                        Call Next Person
                      </button>
                    </div>

                    {queue.customers.length > 0 ? (
                      <ul className="list-group">
                        {queue.customers.map((customer, index) => (
                          <li
                            key={index}
                            className="list-group-item d-flex justify-content-between align-items-center"
                          >
                            <span>
                              <span className="badge bg-dark me-2">
                                #{index + 1}
                              </span>
                              {customer}
                            </span>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => removeSpecificPerson(queue.id, customer)}
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted mb-0">No one is waiting.</p>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* CUSTOMER VIEW */}
      {user.role === "customer" && (
        <div>
          <h4 className="mb-4">Available Queues</h4>
          {queues.length === 0 && (
            <div className="alert alert-info">
              There are currently no active queues to join.
            </div>
          )}

          <div className="row">
            {queues.map((queue) => {
              const inQueue = queue.customers.includes(user.name);
              const position = queue.customers.indexOf(user.name) + 1;

              return (
                <div key={queue.id} className="col-md-6 mb-4">
                  <div className={`card shadow-sm h-100 ${inQueue ? "border-primary" : ""}`}>
                    <div className="card-body">
                      <h5 className="card-title">{queue.name}</h5>
                      <h6 className="card-subtitle mb-3 text-muted">
                        Managed by: {queue.manager}
                      </h6>
                      <p className="card-text">
                        <strong>People waiting:</strong> {queue.customers.length}
                      </p>

                      {inQueue ? (
                        <div className="alert alert-success p-2">
                          <strong>Your Position: #{position}</strong>
                          {position === 1 && " (You are next!)"}
                        </div>
                      ) : null}
                    </div>
                    <div className="card-footer bg-transparent">
                      {inQueue ? (
                        <button
                          className="btn btn-outline-danger w-100"
                          onClick={() => leaveQueue(queue.id)}
                        >
                          Leave Queue
                        </button>
                      ) : (
                        <button
                          className="btn btn-primary w-100"
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
  );
}

export default App;