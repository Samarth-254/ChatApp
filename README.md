# Real-Time Chat Application

A complete full-stack real-time chat application built using React, Vite, Express, Socket.io, and PostgreSQL. The application provides an interactive platform for instant messaging, featuring secure token-based user authentication, dynamic chat room generation, and synchronized communication events. Both components are written in Javascript, using Vanilla CSS for a customized dark-themed design system.

The project integrates a PostgreSQL database to persist conversation history, room configurations, and user credentials. On server initialization, automatic schema verification and indexing are executed to ensure high-performance queries on time-sorted message lists. Real-time updates—including typing indicators, user presence, message receipt notifications, and message broadcasts—are handled via WebSockets with JWT authentication verification on connection handshakes.

---

## Key Features

*   **Token-Based Authentication**: Secure registration and login flows using bcryptjs for password hashing and JSON Web Tokens (JWT) for session management. Tokens are validated across HTTP APIs and WebSocket connection handshakes.
*   **Dynamic Room Architecture**: Instantly spin up dedicated chat rooms with automatic short alphanumeric codes. Users can join rooms using unique room codes or direct shareable URLs.
*   **Real-Time Message Broadcasts**: High-speed, bi-directional message synchronization using Socket.io, enabling instant communication between users inside a room.
*   **Optimistic UI Updates**: Sent messages are rendered instantly in the sender's chat viewport with temporary client-side IDs, transition styles, and fallbacks, then reconciled once the server registers the message.
*   **Typing Indicators**: Active broadcast of user typing status, showing real-time feedback to other room members when someone is composing a message.
*   **Active Presence Tracking**: Continuous tracking of online users within a specific room, displaying dynamic participant list changes as users join or leave.
*   **Timezone Preservation**: Database timestamps are stored in UTC with timezone support (TIMESTAMPTZ) and automatically converted to the browser's local timezone (such as India Standard Time) to display precise message times.
*   **Clipboard Integration**: One-click actions to copy room codes and generated room sharing URLs to the user's clipboard.
*   **Integrated Emoji Menu**: Popover dark-themed emoji picker that inserts selected emojis at the cursor position within the chat composer.
*   **Auto-Focus Join Inputs**: Code entries split across 6 character fields with auto-focus forward and backward-delete handlers to simplify joining rooms.

---

## Repository Structure

*   `backend/` - Node.js and Express server with PostgreSQL client configurations and Socket.io socket handlers.
*   `frontend/` - React and Vite client-side bundle utilizing Vanilla CSS, React Router DOM, and Socket.io client hooks.

---

## Prerequisites and Installation

### 1. Install Dependencies
Navigate into both backend and frontend directories to install the required packages:

```bash
# Install backend packages
cd backend
npm install

# Install frontend packages
cd ../frontend
npm install
```

### 2. Configure Database Schema
Execute the SQL instructions below in your PostgreSQL database to construct the schema. The tables include relational foreign keys, indexes on time-sorted columns, and TIMESTAMPTZ datatypes to handle localized timezone conversions:

```sql
-- Enable pgcrypto extension for room UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create Rooms Table
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(8) NOT NULL UNIQUE,
  name VARCHAR(255),
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS rooms_code_idx ON rooms (code);

-- Create Users Table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS messages_room_id_created_at_idx ON messages (room_id, created_at, id);
```

### 3. Setup Environment Variables
Create your local environment configuration files in the root of the respective project folders:

#### Backend Config (`backend/.env`):
```env
PORT=5000
DATABASE_URL=postgresql://username:password@localhost:5432/chatapp_db
FRONTEND_URL=http://localhost:5173
JWT_SECRET=your_secret_key_here
```

#### Frontend Config (`frontend/.env`):
```env
VITE_BACKEND_URL=http://localhost:5000
```

---

## Running the Application

Ensure your PostgreSQL service is running and accessible via the specified `DATABASE_URL`.

### Run Backend (Express server):
```bash
cd backend
npm run dev
```

### Run Frontend (Vite development environment):
```bash
cd frontend
npm run dev
```
Open your browser and navigate to `http://localhost:5173` to test the application.
