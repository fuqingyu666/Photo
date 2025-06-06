<<<<<<< HEAD
# Photo App

A Vue 3 + TypeScript application for managing and sharing photos with text.

## Features

- **User Authentication**: Login and registration functionality
- **Personal Homepage**: Manage your own photos and text
- **Upload System**: Support for large file uploads with chunking and resumable uploads
- **Shared Gallery**: View photos from all users with virtual list for efficient rendering
- **Real-time Comments**: WebSocket integration for live commenting on photos
- **AI Chat**: Integration with DeepSeek AI for conversations
- **Responsive Design**: Works on desktop and mobile devices

## Technical Stack

- **Vue 3**: Frontend framework
- **TypeScript**: Type safety
- **Vue Router**: Client-side routing with lazy loading
- **Pinia**: State management
- **Element Plus**: UI component library
- **SCSS**: Styling
- **Socket.io**: WebSocket client for real-time features
- **Vite**: Build tool

## Project Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
photo-app/
├── public/             # Static assets
├── src/
│   ├── api/            # API services
│   ├── assets/         # Assets used by the application
│   ├── components/     # Reusable Vue components
│   ├── hooks/          # Custom Vue composition hooks
│   ├── mock/           # Mock data for development
│   ├── router/         # Vue Router configuration
│   ├── store/          # Pinia stores
│   ├── styles/         # Global SCSS styles
│   ├── utils/          # Utility functions
│   ├── views/          # Page components
│   ├── App.vue         # Root component
│   └── main.ts         # Application entry point
├── index.html          # HTML template
├── package.json        # Project dependencies
├── tsconfig.json       # TypeScript configuration
└── vite.config.ts      # Vite configuration
```

## Features Implementation

### Large File Upload

The application implements a chunked file upload system with the following features:
- File splitting into smaller chunks
- Parallel chunk uploading
- Progress tracking
- Pause and resume functionality
- Chunk verification with MD5 hashing

### Virtual List

The shared photo gallery uses a virtual list implementation to efficiently render large lists:
- Only renders visible items
- Recycles DOM elements for better performance
- Buffer rendering for smooth scrolling
- Supports dynamic item heights

### Real-time Comments

Comments system uses WebSockets to provide real-time functionality:
- Instant comment updates
- Visual indicators for new comments
- Efficient connection management

### Responsive Design

The application is fully responsive with:
- Fluid layouts
- Mobile-friendly UI components
- Adaptive design patterns
- SCSS mixins for breakpoints

## Note

This is a demo application with mock data and simulated backend functionality. In a production environment, you would need to implement proper backend services. 
=======
# Photo
>>>>>>> 33e91be9e14ecf49c3538697f23e571f35bdf16e
