import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import io from "socket.io-client";
import UserList from "./UserList";
import MessageArea from "./MessageArea";
import "./Chat.css";

const socket = io("http://localhost:3000");

function Chat() {
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const { channel } = useParams();

  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected to server");
    });

    socket.on("init", ({ users }) => {
      setUsers(users);
      if (!currentUser) {
        setCurrentUser(users[0]); // Default to first user
      }
    });

    socket.on("new_message", ({ channel, message }) => {
      setMessages((prev) => ({
        ...prev,
        [channel]: [...(prev[channel] || []), message],
      }));
    });

    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });

    return () => {
      socket.off("connect");
      socket.off("init");
      socket.off("new_message");
      socket.off("error");
    };
  }, [currentUser]);

  return (
    <div className="chat-container">
      <UserList
        users={users}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
      />
      <MessageArea
        socket={socket}
        currentUser={currentUser}
        messages={messages[channel] || []}
        channel={channel || "public"}
      />
    </div>
  );
}

export default Chat;
