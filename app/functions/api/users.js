// ============================================================================
// FUNCTIONS/API/USERS.JS - User Profile Endpoints
// ============================================================================

import { 
  getUserFromToken,
  hashPassword,
  verifyPassword,
  jsonResponse, 
  errorResponse,
  handleCORS
} from '../utils.js';

// Handle OPTIONS requests for CORS
export async function onRequestOptions() {
  return handleCORS();
}

// GET /api/users/me - Get current user profile
export async function onRequestGet(context) {
  const { request, env } = context;
  
  try {
    const user = await getUserFromToken(request, env);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }
    
    // Get full user details from database
    const userDetails = await env.DB.prepare(
      'SELECT email, name, role, created_at FROM users WHERE email = ?'
    ).bind(user.email).first();
    
    if (!userDetails) {
      return errorResponse('User not found', 404);
    }
    
    return jsonResponse({
      success: true,
      user: userDetails
    });
    
  } catch (error) {
    console.error('Get user error:', error);
    return errorResponse('Failed to fetch user', 500);
  }
}

// PUT /api/users/me - Update user profile
export async function onRequestPut(context) {
  const { request, env } = context;
  
  try {
    const user = await getUserFromToken(request, env);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }
    
    const body = await request.json();
    const { action } = body;
    
    if (action === 'change-password') {
      return await handleChangePassword(user, body, env);
    }
    
    return errorResponse('Invalid action');
    
  } catch (error) {
    console.error('Update user error:', error);
    return errorResponse('Failed to update user', 500);
  }
}

// Change password
async function handleChangePassword(user, body, env) {
  const { currentPassword, newPassword } = body;
  
  if (!currentPassword || !newPassword) {
    return errorResponse('Current and new password required');
  }
  
  if (newPassword.length < 6) {
    return errorResponse('New password must be at least 6 characters');
  }
  
  // Get user's current password
  const userRecord = await env.DB.prepare(
    'SELECT password FROM users WHERE email = ?'
  ).bind(user.email).first();
  
  if (!userRecord || !userRecord.password) {
    return errorResponse('This account uses Google Sign-In and cannot change password', 400);
  }
  
  // Verify current password
  const isValid = await verifyPassword(currentPassword, userRecord.password);
  if (!isValid) {
    return errorResponse('Current password is incorrect', 401);
  }
  
  // Check if new password is same as current
  const isSame = await verifyPassword(newPassword, userRecord.password);
  if (isSame) {
    return errorResponse('New password must be different from current password');
  }
  
  // Hash new password
  const hashedPassword = await hashPassword(newPassword);
  
  // Update password
  await env.DB.prepare(
    'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?'
  ).bind(hashedPassword, user.email).run();
  
  return jsonResponse({
    success: true,
    message: 'Password changed successfully'
  });
}

// POST /api/users/forgot-password - Send OTP for password reset
export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const body = await request.json();
    const { action, email } = body;
    
    if (action === 'send-otp') {
      // Check if user exists
      const user = await env.DB.prepare(
        'SELECT email FROM users WHERE email = ? AND password IS NOT NULL'
      ).bind(email.toLowerCase()).first();
      
      if (!user) {
        return errorResponse('Account not found or uses Google Sign-In', 404);
      }
      
      // Generate OTP (6 digits)
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // In production, you would send this via email
      // For now, we'll just return it (remove in production!)
      console.log(`OTP for ${email}: ${otp}`);
      
      // Store OTP in a temporary table or cache (for simplicity, returning it here)
      // In production, save to database with expiration
      
      return jsonResponse({
        success: true,
        message: 'OTP sent',
        otp // REMOVE THIS IN PRODUCTION - only for demo
      });
    }
    
    return errorResponse('Invalid action');
    
  } catch (error) {
    console.error('Forgot password error:', error);
    return errorResponse('Failed to process request', 500);
  }
}
