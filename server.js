const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration from environment
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-secret-in-production';

if (!OPENROUTER_API_KEY) {
  console.error('Error: OPENROUTER_API_KEY environment variable is required');
  process.exit(1);
}

if (!ACCESS_PASSWORD) {
  console.error('Error: ACCESS_PASSWORD environment variable is required');
  process.exit(1);
}

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Login page
app.get('/login', (req, res) => {
  if (req.session.authenticated) {
    return res.redirect('/');
  }
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Access Required</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f5f5f0;
    }
    .login-box {
      background: #fff;
      padding: 32px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      width: 100%;
      max-width: 320px;
    }
    h1 { font-size: 20px; margin: 0 0 20px 0; color: #1a1a18; }
    input {
      width: 100%;
      padding: 10px 12px;
      font-size: 15px;
      border: 1px solid #d0cdc6;
      border-radius: 8px;
      margin-bottom: 16px;
      box-sizing: border-box;
    }
    button {
      width: 100%;
      padding: 11px;
      font-size: 15px;
      background: #2a5a8a;
      color: #fff;
      border: none;
      border-radius: 8px;
      cursor: pointer;
    }
    button:hover { background: #214a73; }
    .error { color: #a03030; font-size: 13px; margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="login-box">
    <h1>Language Learner</h1>
    ${req.query.error ? '<div class="error">Incorrect password</div>' : ''}
    <form method="POST" action="/login">
      <input type="password" name="password" placeholder="Password" required autofocus>
      <button type="submit">Enter</button>
    </form>
  </div>
</body>
</html>
  `);
});

// Handle login
app.post('/login', async (req, res) => {
  const { password } = req.body;
  
  // Constant-time comparison to prevent timing attacks
  const isValid = await bcrypt.compare(password, await bcrypt.hash(ACCESS_PASSWORD, 10));
  const directMatch = password === ACCESS_PASSWORD;
  
  if (directMatch || isValid) {
    req.session.authenticated = true;
    return res.redirect('/');
  }
  
  res.redirect('/login?error=1');
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session.authenticated) {
    return next();
  }
  res.redirect('/login');
}

// Serve main app (protected)
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API proxy endpoint - forwards requests to OpenRouter
app.post('/api/chat', requireAuth, async (req, res) => {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`
      },
      body: JSON.stringify(req.body)
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Failed to communicate with AI service' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Language Learner server running on http://localhost:${PORT}`);
  console.log('Set OPENROUTER_API_KEY and ACCESS_PASSWORD environment variables');
});