import { useState } from "react";

function App() {

  const [queueName, setQueueName] = useState("");
  const [queues, setQueues] = useState([]);

  const username = "User1"; // simple demo user

  // Create queue
  const createQueue = () => {

    if(queueName === "") return;

    const newQueue = {
      id: Date.now(),
      name: queueName,
      users: []
    };

    setQueues([...queues, newQueue]);
    setQueueName("");
  };

  // Join queue
  const joinQueue = (id) => {

    const updatedQueues = queues.map(q => {

      if(q.id === id && !q.users.includes(username)) {
        return {...q, users: [...q.users, username]};
      }

      return q;
    });

    setQueues(updatedQueues);
  };

  // Leave queue
  const leaveQueue = (id) => {

    const updatedQueues = queues.map(q => {

      if(q.id === id) {
        return {...q, users: q.users.filter(u => u !== username)};
      }

      return q;
    });

    setQueues(updatedQueues);
  };

  return (
    <div className="container mt-5">

      <h1 className="text-center mb-4">Queue Manager System</h1>

      {/* Create Queue */}

      <div className="card p-4 mb-4">

        <h3>Create Queue</h3>

        <input
          className="form-control mb-3"
          placeholder="Enter Queue Name"
          value={queueName}
          onChange={(e)=>setQueueName(e.target.value)}
        />

        <button
          className="btn btn-primary"
          onClick={createQueue}
        >
          Create Queue
        </button>

      </div>

      {/* Queue List */}

      <div className="card p-4">

        <h3>Available Queues</h3>

        {queues.length === 0 && <p>No queues created yet</p>}

        {queues.map(queue => (

          <div
            key={queue.id}
            className="border p-3 mb-3"
          >

            <h5>{queue.name}</h5>

            <p>
              Members: {queue.users.length}
            </p>

            <button
              className="btn btn-success me-2"
              onClick={()=>joinQueue(queue.id)}
            >
              Join
            </button>

            <button
              className="btn btn-danger"
              onClick={()=>leaveQueue(queue.id)}
            >
              Leave
            </button>

            {/* Queue members */}

            {queue.users.length > 0 && (

              <div className="mt-3">

                <strong>Queue Members:</strong>

                <ul>

                  {queue.users.map((user,i)=>(
                    <li key={i}>
                      {user} (Position {i+1})
                    </li>
                  ))}

                </ul>

              </div>

            )}

          </div>

        ))}

      </div>

    </div>
  );
}

export default App;