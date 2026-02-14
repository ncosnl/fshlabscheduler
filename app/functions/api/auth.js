// ============================================================================
// FUNCTIONS/API/AUTH.JS - Authentication Endpoints
// ============================================================================

import { 
  hashPassword, 
  verifyPassword, 
  generateToken, 
  validateEmailDomain,
  verifyGoogleToken,
  jsonResponse, 
  errorResponse,
  handleCORS 
} from '../utils.js';

// Handle OPTIONS requests for CORS
export async function onRequestOptions() {
  return handleCORS();
}

// POST /api/auth - Handle login, signup, and Google Sign-In
export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const body = await request.json();
    const { action } = body;
    
    switch (action) {
      case 'login':
        return await handleLogin(body, env);
      case 'signup':
        return await handleSignup(body, env);
      case 'google-signin':
        return await handleGoogleSignIn(body, env);
      case 'logout':
        return await handleLogout(body, env);
      default:
        return errorResponse('Invalid action');
    }
  } catch (error) {
    console.error('Auth error:', error);
    return errorResponse('Authentication failed', 500);
  }
}

// Login with email/password
async function handleLogin(body, env) {
  const { email, password } = body;
  
  if (!email || !password) {
    return errorResponse('Email and password required');
  }
  
  const emailLower = email.toLowerCase();
  
  if (!validateEmailDomain(emailLower)) {
    return errorResponse('Please use your school email (@firstasia.edu.ph)');
  }
  
  // Get user from database
  const user = await env.DB.prepare(
    'SELECT * FROM users WHERE email = ?'
  ).bind(emailLower).first();
  
  if (!user) {
    return errorResponse('Account not found', 404);
  }
  
  if (!user.password) {
    return errorResponse('This account uses Google Sign-In', 400);
  }
  
  // Verify password
  const isValid = await verifyPassword(password, user.password);
  if (!isValid) {
    return errorResponse('Incorrect password', 401);
  }
  
  // Generate token
  const token = await generateToken({
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
  }, env.JWT_SECRET);
  
  // Save session to database
  await env.DB.prepare(
    'INSERT INTO sessions (user_email, token, expires_at) VALUES (?, ?, datetime("now", "+7 days"))'
  ).bind(user.email, token).run();
  
  return jsonResponse({
    success: true,
    token,
    user: {
      email: user.email,
      name: user.name,
      role: user.role
    }
  }, 200, {
    'Set-Cookie': `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}`
  });
}

// Signup with email/password
async function handleSignup(body, env) {
  const { email, password, role } = body;
  
  if (!email || !password || !role) {
    return errorResponse('Email, password, and role required');
  }
  
  if (password.length < 6) {
    return errorResponse('Password must be at least 6 characters');
  }
  
  const emailLower = email.toLowerCase();
  
  if (!validateEmailDomain(emailLower)) {
    return errorResponse('Please use your school email (@firstasia.edu.ph)');
  }
  
  if (!['Teacher', 'Admin'].includes(role)) {
    return errorResponse('Invalid role');
  }
  
  // Check if user already exists
  const existingUser = await env.DB.prepare(
    'SELECT email FROM users WHERE email = ?'
  ).bind(emailLower).first();
  
  if (existingUser) {
    return errorResponse('Account already exists', 409);
  }
  
  // Hash password
  const hashedPassword = await hashPassword(password);
  
  // Extract name from email
  const name = emailLower.split('@')[0]
    .split('.')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  // Create user
  await env.DB.prepare(
    'INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)'
  ).bind(emailLower, hashedPassword, name, role).run();
  
  // Generate token
  const token = await generateToken({
    email: emailLower,
    role: role,
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
  }, env.JWT_SECRET);
  
  // Save session
  await env.DB.prepare(
    'INSERT INTO sessions (user_email, token, expires_at) VALUES (?, ?, datetime("now", "+7 days"))'
  ).bind(emailLower, token).run();
  
  return jsonResponse({
    success: true,
    token,
    user: {
      email: emailLower,
      name: name,
      role: role
    }
  }, 201, {
    'Set-Cookie': `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}`
  });
}

// Google Sign-In
async function handleGoogleSignIn(body, env) {
  const { credential, role } = body;
  
  if (!credential) {
    return errorResponse('Google credential required');
  }
  
  // Verify Google token
  const googleUser = await verifyGoogleToken(credential, env.GOOGLE_CLIENT_ID);
  
  if (!googleUser) {
    return errorResponse('Invalid Google credential', 401);
  }
  
  const emailLower = googleUser.email.toLowerCase();
  
  // Check if user exists
  let user = await env.DB.prepare(
    'SELECT * FROM users WHERE email = ? OR google_id = ?'
  ).bind(emailLower, googleUser.googleId).first();
  
  if (!user) {
    // Create new user
    const userRole = role || 'Teacher';
    
    await env.DB.prepare(
      'INSERT INTO users (email, name, role, google_id) VALUES (?, ?, ?, ?)'
    ).bind(emailLower, googleUser.name, userRole, googleUser.googleId).run();
    
    user = {
      email: emailLower,
      name: googleUser.name,
      role: userRole
    };
  }
  
  // Generate token
  const token = await generateToken({
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
  }, env.JWT_SECRET);
  
  // Save session
  await env.DB.prepare(
    'INSERT INTO sessions (user_email, token, expires_at) VALUES (?, ?, datetime("now", "+7 days"))'
  ).bind(user.email, token).run();
  
  return jsonResponse({
    success: true,
    token,
    user: {
      email: user.email,
      name: user.name,
      role: user.role
    }
  }, 200, {
    'Set-Cookie': `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}`
  });
}

// Logout
async function handleLogout(body, env) {
  const { token } = body;
  
  if (token) {
    // Delete session from database
    await env.DB.prepare(
      'DELETE FROM sessions WHERE token = ?'
    ).bind(token).run();
  }
  
  return jsonResponse({
    success: true
  }, 200, {
    'Set-Cookie': 'session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'
  });
}
