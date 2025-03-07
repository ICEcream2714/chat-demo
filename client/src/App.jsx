import { useState, useEffect } from "react";
import io from "socket.io-client";
import "./App.css";

function App() {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  // Kết nối tới server khi component mount
  useEffect(() => {
    const socketInstance = io(import.meta.env.VITE_SERVER_URL);
    setSocket(socketInstance);

    // Lắng nghe tin nhắn từ server
    socketInstance.on("new_message", (message) => {
      setMessages((prevMessages) => [...prevMessages, message]);
    });

    // Lắng nghe lỗi từ server
    socketInstance.on("error", (error) => {
      console.error("Server error:", error);
    });

    // Cleanup khi component unmount
    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Gửi tin nhắn
  const sendMessage = () => {
    if (input.trim() && socket) {
      socket.emit("send_message", input);
      setInput(""); // Xóa input sau khi gửi
    }
  };

  // Xử lý gửi khi nhấn Enter
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  };

  return (
    <div className="App">
      <h1>Real-time Chat</h1>
      <div className="chat-container">
        {messages.map((msg, index) => (
          <div key={index} className="message">
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
          placeholder="Nhập tin nhắn..."
        />
        <button onClick={sendMessage}>Gửi</button>
      </div>
    </div>
  );
}

export default App;
