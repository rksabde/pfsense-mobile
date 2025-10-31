const adminPassword = process.env.ADMIN_PASSWORD;

// Simple password-based authentication middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  if (token !== adminPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  next();
};

// Login endpoint handler
const login = (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }

  if (password !== adminPassword) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  // Return the password as the token (simple auth)
  res.json({ token: password, message: 'Login successful' });
};

module.exports = { authenticate, login };
