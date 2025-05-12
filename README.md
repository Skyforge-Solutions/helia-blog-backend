# Blog Backend API

A high-performance backend API for a blog platform built with Node.js, Express, TypeScript, and PostgreSQL.

## Features

- **Blog Management API**: Create, read, update, and delete blog posts
- **Admin Authentication**: Secure login system with JWT and session-based auth
- **PostgreSQL Database**: Using Drizzle ORM for type-safe database access
- **High Performance**: Optimized for speed with connection pooling and caching
- **Security**: Rate limiting, input validation, and data sanitization

## Tech Stack

- **Node.js** and **Express**: API server
- **TypeScript**: Type-safe code
- **PostgreSQL**: Database
- **Drizzle ORM**: Database ORM
- **JWT & Cookies**: Authentication
- **Bcrypt**: Password hashing
- **Express-validator**: Input validation
- **Sanitize-HTML**: Content sanitization

## Getting Started

### Prerequisites

- Node.js (v14+)
- PostgreSQL database

### Installation

1. Clone the repository
```bash
git clone https://github.com/Skyforge-Solutions/helia-blog-backend.git
cd helia-blog-backend
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env` file with the following variables:
```
DATABASE_URL=postgresql://user:password@localhost:5432/blog_db
PORT=3000
JWT_SECRET=your_jwt_secret_key
FRONTEND_URL=http://localhost:5173
```

4. Run database setup
```bash
npm run db:setup
```

5. Start the development server
```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/logout` - Admin logout
- `GET /api/auth/validate` - Validate authentication

### Blog Management
- `GET /api/blogs` - List all approved blogs
- `GET /api/blogs/:id` - Get a specific blog
- `POST /api/blogs` - Submit a new blog
- `GET /api/admin/blogs` - List all blogs (admin only)
- `PUT /api/admin/blogs/:id` - Update blog status (admin only)
- `DELETE /api/admin/blogs/:id` - Delete a blog (admin only)

## License

MIT 