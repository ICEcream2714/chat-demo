import { useState } from "react";

function MessageArea({ socket, currentUser, messages, channel }) {
  const [message, setMessage] = useState("");

  const sendMessage = (e) => {
    e.preventDefault();
    if (message.trim() && currentUser) {
      const recipient =
        channel === "public"
          ? "public"
          : channel.split(":").find((u) => u !== currentUser);

      socket.emit("send_message", {
        sender: currentUser,
        recipient,
        message,
      });
      setMessage("");
    }
  };

  return (
    <div className="message-area">
      <h2>{channel === "public" ? "Public Channel" : channel}</h2>
      <div className="messages">
        {messages.map((msg, index) => (
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
      <form onSubmit={sendMessage} className="message-input">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}

export default MessageArea;
