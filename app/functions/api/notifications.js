// ============================================================================
// FUNCTIONS/API/NOTIFICATIONS.JS - Notification Endpoints
// ============================================================================

import { 
  getUserFromToken,
  jsonResponse, 
  errorResponse,
  handleCORS
} from '../utils.js';

// Handle OPTIONS requests for CORS
export async function onRequestOptions() {
  return handleCORS();
}

// GET /api/notifications - Get user's notifications
export async function onRequestGet(context) {
  const { request, env } = context;
  
  try {
    const user = await getUserFromToken(request, env);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }
    
    const url = new URL(request.url);
    const filter = url.searchParams.get('filter'); // 'all', 'unread', 'approved', 'pending'
    
    let query = 'SELECT * FROM notifications WHERE to_email = ?';
    const params = [user.email];
    
    // Apply filters
    switch (filter) {
      case 'unread':
        query += ' AND read = 0';
        break;
      case 'approved':
        query += ' AND status = ?';
        params.push('approved');
        break;
      case 'pending':
        query += ' AND status = ?';
        params.push('pending');
        break;
    }
    
    query += ' ORDER BY created_at DESC';
    
    const { results } = await env.DB.prepare(query).bind(...params).all();
    
    // Get unread count
    const unreadCount = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE to_email = ? AND read = 0'
    ).bind(user.email).first();
    
    return jsonResponse({
      success: true,
      notifications: results,
      unreadCount: unreadCount.count
    });
    
  } catch (error) {
    console.error('Get notifications error:', error);
    return errorResponse('Failed to fetch notifications', 500);
  }
}

// PUT /api/notifications/:id/read - Mark notification as read
export async function onRequestPut(context) {
  const { request, env } = context;
  
  try {
    const user = await getUserFromToken(request, env);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const notificationId = pathParts[pathParts.indexOf('notifications') + 1];
    
    // Verify notification belongs to user
    const notification = await env.DB.prepare(
      'SELECT * FROM notifications WHERE id = ? AND to_email = ?'
    ).bind(notificationId, user.email).first();
    
    if (!notification) {
      return errorResponse('Notification not found', 404);
    }
    
    // Mark as read
    await env.DB.prepare(
      'UPDATE notifications SET read = 1 WHERE id = ?'
    ).bind(notificationId).run();
    
    return jsonResponse({
      success: true,
      message: 'Notification marked as read'
    });
    
  } catch (error) {
    console.error('Mark notification read error:', error);
    return errorResponse('Failed to update notification', 500);
  }
}

// DELETE /api/notifications/:id - Delete notification
export async function onRequestDelete(context) {
  const { request, env } = context;
  
  try {
    const user = await getUserFromToken(request, env);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const notificationId = pathParts[pathParts.indexOf('notifications') + 1];
    
    // Verify notification belongs to user
    const notification = await env.DB.prepare(
      'SELECT * FROM notifications WHERE id = ? AND to_email = ?'
    ).bind(notificationId, user.email).first();
    
    if (!notification) {
      return errorResponse('Notification not found', 404);
    }
    
    // Delete notification
    await env.DB.prepare(
      'DELETE FROM notifications WHERE id = ?'
    ).bind(notificationId).run();
    
    return jsonResponse({
      success: true,
      message: 'Notification deleted'
    });
    
  } catch (error) {
    console.error('Delete notification error:', error);
    return errorResponse('Failed to delete notification', 500);
  }
}
