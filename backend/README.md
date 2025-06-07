# Photo App Backend

This is the backend API for the Photo App, built with Node.js, Express, and MySQL.

## Features

- User authentication with JWT
- Photo management
- Large file uploads with chunking
- Real-time updates with WebSockets
- AI integration with DeepSeek for photo analysis
- AI chat capabilities

## Prerequisites

- Node.js 16+
- MySQL 8+

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file in the root directory with the following variables:
   ```
   # Server configuration
   NODE_ENV=development
   PORT=3001
   
   # Database configuration
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=photo_app
   DB_PORT=3306
   
   # JWT configuration
   JWT_SECRET=your-secret-key
   JWT_EXPIRES_IN=1d
   
   # CORS configuration
   CORS_ORIGIN=http://localhost:5173
   
   # DeepSeek AI configuration (optional)
   DEEPSEEK_API_KEY=your-deepseek-api-key
   DEEPSEEK_API_URL=https://api.deepseek.com
   ```
4. Initialize the database:
   ```
   npm run init-db
   ```
5. Start the development server:
   ```
   npm run dev
   ```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `POST /api/auth/change-password` - Change password

### Photos

- `GET /api/photos` - Get user photos
- `GET /api/photos/:id` - Get a photo by ID
- `POST /api/photos` - Create a new photo
- `PUT /api/photos/:id` - Update a photo
- `DELETE /api/photos/:id` - Delete a photo

### Uploads

- `POST /api/upload/init` - Initialize a new upload
- `POST /api/upload/chunk` - Upload a chunk
- `POST /api/upload/complete` - Complete an upload
- `GET /api/upload/:id` - Get upload status
- `PUT /api/upload/:id/status` - Update upload status
- `DELETE /api/upload/:id` - Delete an upload
- `GET /api/upload` - Get user uploads

### Sharing

- `GET /api/share` - Get shared photos
- `POST /api/share/:id` - Share a photo
- `DELETE /api/share/:id` - Unshare a photo

### AI

- `POST /api/ai/analyze/:id` - Analyze a photo
- `GET /api/ai/analysis/:id` - Get photo analysis
- `GET /api/ai/tags/:id` - Generate tags for a photo
- `POST /api/ai/chat` - Chat with AI
- `GET /api/ai/chat/history` - Get chat history

## WebSocket Events

- `upload-progress` - Upload progress updates
- `upload-completed` - Upload completed
- `upload-status-updated` - Upload status updated
- `ai-chat-message` - AI chat message

## Development

- Run tests: `npm test`
- Build for production: `npm run build`
- Start production server: `npm start` 