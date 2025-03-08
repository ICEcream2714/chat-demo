import { useState, useEffect } from "react";
import io from "socket.io-client";
import { Button } from "@mui/material";
import "./App.css";

function App() {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState({});
  const [input, setInput] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [currentChannel, setCurrentChannel] = useState("public");

  // Initialize socket connection
  useEffect(() => {
    const socketInstance = io(import.meta.env.VITE_SERVER_URL);
    setSocket(socketInstance);

    socketInstance.on("init", ({ users, channels }) => {
      setUsers(users);
      setCurrentUser(users[0]);
      // Initialize messages object with all possible channels
      const initialMessages = { public: [] };
      channels.forEach((channel) => {
        if (channel !== "public") {
          initialMessages[channel] = [];
        }
      });
      setMessages(initialMessages);
    });

    socketInstance.on("new_message", ({ channel, message }) => {
      setMessages((prev) => ({
        ...prev,
        [channel]: [...(prev[channel] || []), message],
      }));
    });

    socketInstance.on("error", (error) => {
      console.error("Server error:", error);
    });

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const sendMessage = () => {
    if (input.trim() && socket && currentUser) {
      const recipient =
        currentChannel === "public"
          ? "public"
          : currentChannel.split(":").find((u) => u !== currentUser);

      socket.emit("send_message", {
        sender: currentUser,
        recipient,
        message: input,
      });
      setInput("");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  };

  const handleChannelChange = (channel) => {
    setCurrentChannel(channel);
  };

  if (!currentUser) return <div className="loading">Loading...</div>;

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>Chat App</h2>
        </div>

        <div className="channel-list">
          <button
            className={`channel-btn ${
              currentChannel === "public" ? "active" : ""
            }`}
            onClick={() => handleChannelChange("public")}
          >
            Public Channel
          </button>
          {users
            .filter((u) => u !== currentUser)
            .map((user) => {
              const channel = [currentUser, user]
                .sort()
                .join(":")
                .toLowerCase();
              return (
                <button
                  key={user}
                  className={`channel-btn ${
                    currentChannel === channel ? "active" : ""
                  }`}
                  onClick={() => handleChannelChange(channel)}
                >
                  {user}
                </button>
              );
            })}
        </div>
        <div className="user-select">
          <label>Current User:</label>
          <select
            value={currentUser}
            onChange={(e) => setCurrentUser(e.target.value)}
          >
            {users.map((user) => (
              <option key={user} value={user}>
                {user}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="chat-area">
        <div className="chat-header">
          <h3>
            {currentChannel === "public"
              ? "Welcome to Public Channel"
              : `Chatting with ${currentChannel
                  .split(":")
                  .find((u) => u !== currentUser)}`}
          </h3>
        </div>
        <div className="messages-container">
          {messages[currentChannel]?.map((msg, index) => (
            <div
              key={index}
              className={`message ${
                msg.startsWith(currentUser) ? "sent" : "received"
              }`}
            >
              {msg}
            </div>
          ))}
        </div>
        <div className="input-container">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
          />
          <Button onClick={sendMessage} variant="contained">
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}

export default App;
