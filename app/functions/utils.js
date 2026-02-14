// ============================================================================
// FUNCTIONS/UTILS.JS - Shared Backend Utilities
// ============================================================================

/**
 * Hash password using Web Crypto API
 */
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password, hash) {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

/**
 * Generate JWT token
 */
export async function generateToken(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  
  const signature = await sign(`${encodedHeader}.${encodedPayload}`, secret);
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify JWT token
 */
export async function verifyToken(token, secret) {
  try {
    const [header, payload, signature] = token.split('.');
    
    const expectedSignature = await sign(`${header}.${payload}`, secret);
    
    if (signature !== expectedSignature) {
      return null;
    }
    
    const decodedPayload = JSON.parse(atob(payload));
    
    // Check expiration
    if (decodedPayload.exp && decodedPayload.exp < Date.now() / 1000) {
      return null;
    }
    
    return decodedPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Sign data with secret
 */
async function sign(data, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(data)
  );
  
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Get user from session token
 */
export async function getUserFromToken(request, env) {
  const authHeader = request.headers.get('Authorization');
  const cookieHeader = request.headers.get('Cookie');
  
  let token = null;
  
  // Try Authorization header first
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }
  // Try cookie
  else if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const sessionCookie = cookies.find(c => c.startsWith('session='));
    if (sessionCookie) {
      token = sessionCookie.substring(8);
    }
  }
  
  if (!token) {
    return null;
  }
  
  const payload = await verifyToken(token, env.JWT_SECRET);
  if (!payload) {
    return null;
  }
  
  return payload;
}

/**
 * CORS headers
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Handle CORS preflight
 */
export function handleCORS() {
  return new Response(null, {
    headers: corsHeaders
  });
}

/**
 * JSON response helper
 */
export function jsonResponse(data, status = 200, additionalHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...additionalHeaders
    }
  });
}

/**
 * Error response helper
 */
export function errorResponse(message, status = 400) {
  return jsonResponse({ success: false, error: message }, status);
}

/**
 * Validate email domain
 */
export function validateEmailDomain(email) {
  return email.toLowerCase().endsWith('@firstasia.edu.ph');
}

/**
 * Format date for database
 */
export function formatDate(date) {
  return new Date(date).toISOString().split('T')[0];
}

/**
 * Verify Google Sign-In token
 */
export async function verifyGoogleToken(token, clientId) {
  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
    const data = await response.json();
    
    if (data.aud !== clientId) {
      return null;
    }
    
    if (data.hd !== 'firstasia.edu.ph') {
      return null;
    }
    
    return {
      email: data.email,
      name: data.name,
      googleId: data.sub
    };
  } catch (error) {
    return null;
  }
}