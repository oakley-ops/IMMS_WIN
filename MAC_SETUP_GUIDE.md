# Fiserv Inventory Management System - macOS Setup Guide

This document provides comprehensive instructions for setting up and running the Fiserv Inventory Management System on macOS.

## System Requirements

- macOS 10.15 (Catalina) or newer
- Node.js 16.x or newer (LTS version recommended)
- npm 8.x or newer (comes with Node.js)
- PostgreSQL 12 or newer
- Git

## Installation Steps

### 1. Install Required Software

#### Install Homebrew (if not already installed)

Homebrew is a package manager for macOS that makes it easy to install software.

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

#### Install Node.js and npm

```bash
brew install node
```

Verify installation:
```bash
node --version
npm --version
```

#### Install PostgreSQL

```bash
brew install postgresql@14
```

Start PostgreSQL service:
```bash
brew services start postgresql@14
```

#### Install Git (if not already installed)

```bash
brew install git
```

### 2. Clone the Repository

```bash
git clone https://github.com/oakley-ops/fiservinventory-app.git
cd fiservinventory-app
```

### 3. Set Up the Database

Log into PostgreSQL:
```bash
psql postgres
```

Create a database and user:
```sql
CREATE DATABASE fiserv_inventory;
CREATE USER fiserv_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE fiserv_inventory TO fiserv_user;
\q
```

### 4. Configure Environment Variables

#### Backend Environment Setup

Create a `.env` file in the backend directory:

```bash
cd backend
touch .env
```

Open the file in your preferred text editor and add the following variables:

```
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fiserv_inventory
DB_USER=fiserv_user
DB_PASSWORD=your_secure_password
JWT_SECRET=your_secure_jwt_secret
```

#### Frontend Environment Setup

Create a `.env` file in the frontend directory:

```bash
cd ../frontend
touch .env
```

Add the following variables:

```
REACT_APP_API_URL=http://localhost:3001/api
```

### 5. Install Dependencies

#### Backend Dependencies

```bash
cd ../backend
npm install
```

#### Frontend Dependencies

```bash
cd ../frontend
npm install
```

### 6. Initialize the Database

Run migrations to set up the database schema:

```bash
cd ../backend
npm run db:init
```

If the `db:init` script is not available, you can check the package.json for the appropriate migration command or run the SQL files manually:

```bash
node run-migration.js
```

### 7. Run the Application

#### Start the Backend Server

In the backend directory:

```bash
npm run dev
```

This will start the backend server, typically on port 3001.

#### Start the Frontend Development Server

Open a new terminal window/tab, navigate to the frontend directory:

```bash
cd path/to/fiservinventory-app/frontend
npm start
```

This will start the React development server, typically on port 3000.

### 8. Access the Application

Open your browser and navigate to:

```
http://localhost:3000
```

## Running in Production Mode

### Backend Production Setup

```bash
cd backend
npm run build
npm start
```

### Frontend Production Build

```bash
cd frontend
npm run build
```

The production build will be in the `frontend/build` directory. You can serve it using a static file server:

```bash
npm install -g serve
serve -s build
```

## macOS-Specific Considerations

### File Permissions

If you encounter permission issues:

```bash
chmod -R 755 fiservinventory-app
```

### Network Access

macOS may prompt you to allow Node.js to accept incoming network connections. Allow this for proper functionality.

### PostgreSQL Path Configuration

If you have issues with PostgreSQL command not found, you may need to add it to your PATH:

```bash
echo 'export PATH="/usr/local/opt/postgresql@14/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

## Creating Test Data

To populate the database with test data:

```bash
cd scripts
node populate_test_data.js
```

## Troubleshooting

### Database Connection Issues

If you encounter database connection errors:
1. Check that PostgreSQL is running: `brew services list`
2. Restart PostgreSQL: `brew services restart postgresql@14`
3. Verify connection details in `.env` file

### Port Conflicts

If ports are already in use:
1. For backend: Edit PORT in the `.env` file
2. For frontend: Run with a different port: `PORT=3006 npm start`

### Node Version Issues

If you encounter compatibility issues:
1. Install nvm: `brew install nvm`
2. Install appropriate Node version: `nvm install 16`
3. Use that version: `nvm use 16`

### Dependency Errors

Clear npm cache and reinstall:
```bash
npm cache clean --force
rm -rf node_modules
npm install
```

## Maintenance

### Updating the Application

```bash
git pull
cd backend && npm install
cd ../frontend && npm install
```

### Database Backup

Backup your PostgreSQL database:
```bash
pg_dump fiserv_inventory > backup.sql
```

Restore from backup:
```bash
psql fiserv_inventory < backup.sql
```

## Support

For questions or support, please contact the development team or submit an issue on the GitHub repository. 