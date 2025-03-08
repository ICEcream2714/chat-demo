import { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import {
  Button,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ListItemIcon,
  Box,
  Typography,
  TextField,
  Paper,
} from "@mui/material";
import "./App.css";
import Divider from "@mui/material/Divider";

function App() {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState({});
  const [input, setInput] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [currentChannel, setCurrentChannel] = useState("public");
  const messagesEndRef = useRef(null);

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

  useEffect(() => {
    if (socket) {
      socket.on("history_response", ({ channel, history }) => {
        setMessages((prev) => ({
          ...prev,
          [channel]: history,
        }));
      });
    }
  }, [socket]);

  useEffect(() => {
    if (socket && currentChannel) {
      socket.emit("request_history", { channel: currentChannel });
    }
  }, [socket, currentChannel]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, currentChannel]);

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
        <Divider />

        <div className="channel-list">
          <List>
            <ListItem
              button
              selected={currentChannel === "public"}
              onClick={() => handleChannelChange("public")}
            >
              <ListItemText primary="Public Channel" />
            </ListItem>
            {users
              .filter((u) => u !== currentUser)
              .map((user) => {
                const channel = [currentUser, user]
                  .sort()
                  .join(":")
                  .toLowerCase();
                return (
                  <ListItem
                    button
                    key={user}
                    selected={currentChannel === channel}
                    onClick={() => handleChannelChange(channel)}
                  >
                    <ListItemAvatar>
                      <Avatar>{user.charAt(0).toUpperCase()}</Avatar>
                    </ListItemAvatar>
                    <ListItemText primary={user} />
                  </ListItem>
                );
              })}
          </List>
        </div>
        <Divider />
        <div className="user-select">
          <FormControl fullWidth>
            <InputLabel>Current User</InputLabel>
            <Select
              value={currentUser}
              onChange={(e) => setCurrentUser(e.target.value)}
              label="Current User"
              renderValue={(selected) => (
                <div style={{ display: "flex", alignItems: "center" }}>
                  <Avatar style={{ marginRight: 8 }}>
                    {selected.charAt(0).toUpperCase()}
                  </Avatar>
                  {selected}
                </div>
              )}
            >
              {users.map((user) => (
                <MenuItem key={user} value={user}>
                  <ListItemIcon>
                    <Avatar sx={{ marginRight: 2 }}>
                      {user.charAt(0).toUpperCase()}
                    </Avatar>
                  </ListItemIcon>
                  {user}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>
      </div>

      <Box className="chat-area" display="flex" flexDirection="column" flex={1}>
        <Paper className="chat-header" elevation={1} square>
          <Typography variant="h6">
            {currentChannel === "public"
              ? "Welcome to Public Channel"
              : `Chatting with ${currentChannel
                  .split(":")
                  .find((u) => u !== currentUser)}`}
          </Typography>
        </Paper>
        <Box className="messages-container" flex={1} p={2} overflow="auto">
          {messages[currentChannel]?.map((msg, index) => {
            const displayedText = msg.includes(": ")
              ? msg.split(": ").slice(1).join(": ")
              : msg;
            const sender = msg.includes(": ")
              ? msg.split(": ")[0]
              : currentUser;
            const isSent = sender === currentUser;

            return (
              <Box
                key={index}
                display="flex"
                flexDirection={isSent ? "row-reverse" : "row"}
                alignItems="center"
                mb={2}
              >
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    mr: isSent ? 0 : 1,
                    ml: isSent ? 1 : 0,
                  }}
                >
                  {sender.charAt(0).toUpperCase()}
                </Avatar>
                <Box
                  className={`message ${isSent ? "sent" : "received"}`}
                  p={1}
                  borderRadius={2}
                  maxWidth="30%"
                  bgcolor={isSent ? "primary.main" : "grey.300"}
                  color={isSent ? "primary.contrastText" : "text.primary"}
                >
                  {displayedText}
                </Box>
              </Box>
            );
          })}
          <div ref={messagesEndRef} />
        </Box>
        <Box
          className="input-container"
          display="flex"
          p={2}
          borderTop={1}
          borderColor="divider"
        >
          <TextField
            fullWidth
            variant="outlined"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
          />
          <Button
            onClick={sendMessage}
            variant="contained"
            color="primary"
            sx={{ ml: 2 }}
          >
            Send
          </Button>
        </Box>
      </Box>
    </div>
  );
}

export default App;
