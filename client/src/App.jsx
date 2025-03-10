import { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import "./App.css";

function App() {
  const [socket, setSocket] = useState(null);
  const [messagesByTopic, setMessagesByTopic] = useState({});
  const [input, setInput] = useState("");
  const [topicInput, setTopicInput] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [subscribedTopics, setSubscribedTopics] = useState([]);
  const [error, setError] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const socketInstance = io(import.meta.env.VITE_SERVER_URL, {
      reconnection: true,
    });
    setSocket(socketInstance);

    socketInstance.on("connect", () => {
      setIsConnected(true);
      console.log("Connected to server with ID:", socketInstance.id);
    });

    socketInstance.on("new_message", ({ topic, message }) => {
      console.log(`Received message from ${topic}: ${message}`);
      setMessagesByTopic((prev) => ({
        ...prev,
        [topic]: [...(prev[topic] || []), message],
      }));
    });

    socketInstance.on("subscribed", (topic) => {
      console.log(`Successfully subscribed to ${topic}`);
      setError("");
    });

    socketInstance.on("unsubscribed", (topic) => {
      console.log(`Unsubscribed from ${topic}`);
    });

    socketInstance.on("topics", (topics) => {
      console.log("Updated topics from server:", topics);
      setSubscribedTopics(topics);
      setMessagesByTopic((prev) => {
        const updated = {};
        topics.forEach((topic) => {
          if (prev[topic]) updated[topic] = prev[topic];
        });
        return updated;
      });
      if (!topics.includes(selectedTopic)) setSelectedTopic("");
    });

    socketInstance.on("topic_history", ({ topic, messages }) => {
      console.log(`Received history for ${topic}:`, messages);
      setMessagesByTopic((prev) => ({
        ...prev,
        [topic]: messages,
      }));
    });

    socketInstance.on("error", (message) => {
      console.error("Server error:", message);
      setError(message);
    });

    socketInstance.on("connect_error", (error) => {
      console.error("Connection error:", error);
      setIsConnected(false);
      setError("Connection lost");
    });

    return () => socketInstance.disconnect();
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messagesByTopic, selectedTopic]);

  const subscribeToTopic = () => {
    if (topicInput.trim() && socket) {
      socket.emit("subscribe", topicInput.trim());
      setTopicInput("");
    }
  };

  const unsubscribeFromTopic = (topic) => {
    if (socket) {
      socket.emit("unsubscribe", topic);
    }
  };

  const sendMessage = () => {
    if (input.trim() && selectedTopic && socket) {
      socket.emit("send_message", { topic: selectedTopic, message: input });
      setInput("");
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1>Real-time Topic Chat</h1>
        <span
          className={`status ${isConnected ? "connected" : "disconnected"}`}
        >
          {isConnected ? "Connected" : "Disconnected"}
        </span>
      </header>

      {error && <div className="error-message">{error}</div>}

      <section className="topic-section">
        <div className="topic-input">
          <input
            type="text"
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            placeholder="Enter topic name..."
            onKeyPress={(e) => e.key === "Enter" && subscribeToTopic()}
          />
          <button onClick={subscribeToTopic} disabled={!isConnected}>
            Subscribe
          </button>
        </div>

        <div className="topics-list">
          <h3>Subscribed Topics</h3>
          {subscribedTopics.length > 0 ? (
            <ul>
              {subscribedTopics.map((topic) => (
                <li
                  key={topic}
                  className={selectedTopic === topic ? "active" : ""}
                  onClick={() => setSelectedTopic(topic)}
                >
                  <span>
                    {topic} ({messagesByTopic[topic]?.length || 0})
                  </span>
                  <button
                    onClick={() => unsubscribeFromTopic(topic)}
                    className="unsubscribe-btn"
                  >
                    X
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-topics">No subscribed topics yet</p>
          )}
        </div>
      </section>

      <section className="chat-section">
        <div className="chat-header">
          <h2>{selectedTopic || "Select a topic"}</h2>
        </div>
        <div className="messages-container">
          {selectedTopic && messagesByTopic[selectedTopic] ? (
            messagesByTopic[selectedTopic].map((msg, index) => (
              <div key={index} className="message">
                <span>{msg}</span>
              </div>
            ))
          ) : (
            <div className="no-messages">
              {selectedTopic ? "No messages yet" : "Please select a topic"}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="message-input">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type your message..."
            disabled={!selectedTopic || !isConnected}
          />
          <button
            onClick={sendMessage}
            disabled={!selectedTopic || !isConnected}
          >
            Send
          </button>
        </div>
      </section>
    </div>
  );
}

export default App;
