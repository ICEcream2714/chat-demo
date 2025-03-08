import { useState, useEffect } from "react";
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

  useEffect(() => {
    const socketInstance = io(import.meta.env.VITE_SERVER_URL, {
      reconnection: true,
    });
    setSocket(socketInstance);

    socketInstance.on("connect", () => {
      console.log("Connected to server with ID:", socketInstance.id);
    });

    socketInstance.on("new_message", ({ topic, message }) => {
      console.log(`Received message from ${topic}: ${message}`);
      setMessagesByTopic((prev) => {
        const updated = {
          ...prev,
          [topic]: [...(prev[topic] || []), message],
        };
        console.log(`Updated messages for ${topic}:`, updated[topic]);
        return updated;
      });
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
    
      // Ensure messagesByTopic does not contain unsubscribed topics
      setMessagesByTopic((prevMessages) => {
        const updatedMessages = {};
        topics.forEach((topic) => {
          if (prevMessages[topic]) {
            updatedMessages[topic] = prevMessages[topic];
          }
        });
        return updatedMessages;
      });
    
      // If the selected topic is no longer in subscribedTopics, reset it
      if (!topics.includes(selectedTopic)) {
        setSelectedTopic("");
      }
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
      setError("Failed to connect to server");
    });

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const subscribeToTopic = () => {
    if (topicInput.trim() && socket) {
      console.log(`Attempting to subscribe to: ${topicInput}`);
      socket.emit("subscribe", topicInput.trim());
      setTopicInput("");
    } else {
      console.log("Subscription failed: Invalid input or no socket", { topicInput, socket });
      setError("Please enter a topic and ensure connection");
    }
  };

  const unsubscribeFromTopic = (topic) => {
    if (socket) {
      console.log(`Unsubscribing from: ${topic}`);
      socket.emit("unsubscribe", topic);
  
      // Remove from local state
      setSubscribedTopics((prevTopics) => prevTopics.filter((t) => t !== topic));
      setMessagesByTopic((prevMessages) => {
        const updatedMessages = { ...prevMessages };
        delete updatedMessages[topic]; // Clear messages from unsubscribed topic
        return updatedMessages;
      });
  
      if (selectedTopic === topic) {
        setSelectedTopic(""); // Reset selected topic if it was unsubscribed
      }
    }
  };
  

  const sendMessage = () => {
    if (input.trim() && selectedTopic && socket) {
      console.log(`Sending message to ${selectedTopic}: ${input}`);
      socket.emit("send_message", { topic: selectedTopic, message: input });
      setInput("");
    } else {
      console.log("Cannot send: ", { input, selectedTopic, socket });
      setError("Select a topic and enter a message");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  };

  return (
    <div className="App">
      <h1>Real-time Chat with Topics</h1>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <div className="topic-container">
        <input
          type="text"
          value={topicInput}
          onChange={(e) => setTopicInput(e.target.value)}
          placeholder="Enter topic to subscribe..."
        />
        <button onClick={subscribeToTopic}>Subscribe</button>
      </div>

      <div className="subscribed-topics">
        <h3>Subscribed Topics:</h3>
        {subscribedTopics.length > 0 ? (
          subscribedTopics.map((topic) => (
            <div key={topic} className="topic-item">
              <span
                onClick={() => setSelectedTopic(topic)}
                style={{
                  cursor: "pointer",
                  fontWeight: selectedTopic === topic ? "bold" : "normal",
                }}
              >
                {topic}
              </span>
              <button onClick={() => unsubscribeFromTopic(topic)}>Unsubscribe</button>
            </div>
          ))
        ) : (
          <p>No topics subscribed yet.</p>
        )}
      </div>

      <div className="chat-container">
        {selectedTopic ? (
          (messagesByTopic[selectedTopic] || []).length > 0 ? (
            messagesByTopic[selectedTopic].map((msg, index) => (
              <div key={index} className="message">
                {msg}
              </div>
            ))
          ) : (
            <p>No messages yet for {selectedTopic}.</p>
          )
        ) : (
          <p>Select a topic to view messages.</p>
        )}
      </div>

      <div className="input-container">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={`Message to ${selectedTopic || "select a topic"}...`}
          disabled={!selectedTopic}
        />
        <button onClick={sendMessage} disabled={!selectedTopic}>
          Send
        </button>
      </div>
    </div>
  );
}

export default App;