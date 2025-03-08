import { Link } from "react-router-dom";

function UserList({ users, currentUser, setCurrentUser }) {
  return (
    <div className="user-list">
      <h2>Users</h2>
      <div className="user-selection">
        <select
          value={currentUser || ""}
          onChange={(e) => setCurrentUser(e.target.value)}
        >
          {users.map((user) => (
            <option key={user} value={user}>
              {user}
            </option>
          ))}
        </select>
      </div>
      <ul>
        <li>
          <Link to="/chat/public" className="channel-link">
            Public Channel
          </Link>
        </li>
        {users
          .filter((u) => u !== currentUser)
          .map((user) => (
            <li key={user}>
              <Link
                to={`/chat/${[currentUser, user]
                  .sort()
                  .join(":")
                  .toLowerCase()}`}
                className="channel-link"
              >
                {user}
              </Link>
            </li>
          ))}
      </ul>
    </div>
  );
}

export default UserList;
