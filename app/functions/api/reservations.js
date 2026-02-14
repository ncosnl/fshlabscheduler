// ============================================================================
// FUNCTIONS/API/RESERVATIONS.JS - Lab Reservation Endpoints
// ============================================================================

import { 
  getUserFromToken,
  jsonResponse, 
  errorResponse,
  handleCORS,
  formatDate
} from '../utils.js';

// Handle OPTIONS requests for CORS
export async function onRequestOptions() {
  return handleCORS();
}

// GET /api/reservations - Get reservations
export async function onRequestGet(context) {
  const { request, env } = context;
  
  try {
    const user = await getUserFromToken(request, env);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }
    
    const url = new URL(request.url);
    const labName = url.searchParams.get('lab');
    const date = url.searchParams.get('date');
    const status = url.searchParams.get('status');
    
    let query = 'SELECT * FROM reservations WHERE 1=1';
    const params = [];
    
    // Filter by lab
    if (labName) {
      query += ' AND lab_name = ?';
      params.push(labName);
    }
    
    // Filter by date
    if (date) {
      query += ' AND date = ?';
      params.push(date);
    }
    
    // Filter by status
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    // Teachers can only see their own reservations
    if (user.role === 'Teacher') {
      query += ' AND user_email = ?';
      params.push(user.email);
    }
    
    query += ' ORDER BY date DESC, time_slot ASC';
    
    const { results } = await env.DB.prepare(query).bind(...params).all();
    
    return jsonResponse({ success: true, reservations: results });
    
  } catch (error) {
    console.error('Get reservations error:', error);
    return errorResponse('Failed to fetch reservations', 500);
  }
}

// POST /api/reservations - Create new reservation
export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const user = await getUserFromToken(request, env);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }
    
    const body = await request.json();
    const { 
      labName, 
      date, 
      timeSlot, 
      teacherName, 
      subject, 
      grade, 
      students, 
      purpose 
    } = body;
    
    // Validate required fields
    if (!labName || !date || !timeSlot || !teacherName || !subject || !grade || !students || !purpose) {
      return errorResponse('All fields are required');
    }
    
    // Check if time slot is already taken
    const existing = await env.DB.prepare(
      'SELECT id FROM reservations WHERE lab_name = ? AND date = ? AND time_slot = ? AND status != ?'
    ).bind(labName, date, timeSlot, 'rejected').first();
    
    if (existing) {
      return errorResponse('This time slot is already reserved', 409);
    }
    
    // Create reservation
    const result = await env.DB.prepare(
      `INSERT INTO reservations 
       (user_email, lab_name, date, time_slot, teacher_name, subject, grade, students, purpose, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      user.email,
      labName,
      date,
      timeSlot,
      teacherName,
      subject,
      grade,
      students,
      purpose,
      'pending'
    ).run();
    
    const reservationId = result.meta.last_row_id;
    
    // Create notifications for all admins
    const admins = await env.DB.prepare(
      'SELECT email FROM users WHERE role = ?'
    ).bind('Admin').all();
    
    for (const admin of admins.results) {
      await env.DB.prepare(
        `INSERT INTO notifications 
         (type, reservation_id, from_email, to_email, subject, message, lab, date, time_slot, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        'request',
        reservationId,
        user.email,
        admin.email,
        `New Lab Request: ${labName}`,
        `${teacherName} has requested ${labName} for ${subject} class.`,
        labName,
        date,
        timeSlot,
        'pending'
      ).run();
    }
    
    return jsonResponse({
      success: true,
      reservationId,
      message: 'Reservation submitted successfully'
    }, 201);
    
  } catch (error) {
    console.error('Create reservation error:', error);
    return errorResponse('Failed to create reservation', 500);
  }
}

// PUT /api/reservations/:id - Update reservation (approve/reject)
export async function onRequestPut(context) {
  const { request, env } = context;
  
  try {
    const user = await getUserFromToken(request, env);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }
    
    if (user.role !== 'Admin') {
      return errorResponse('Only admins can approve/reject reservations', 403);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const reservationId = pathParts[pathParts.length - 1];
    
    const body = await request.json();
    const { status } = body; // 'approved' or 'rejected'
    
    if (!['approved', 'rejected'].includes(status)) {
      return errorResponse('Invalid status');
    }
    
    // Get reservation details
    const reservation = await env.DB.prepare(
      'SELECT * FROM reservations WHERE id = ?'
    ).bind(reservationId).first();
    
    if (!reservation) {
      return errorResponse('Reservation not found', 404);
    }
    
    // Update reservation status
    await env.DB.prepare(
      'UPDATE reservations SET status = ?, approved_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(status, user.email, reservationId).run();
    
    // Create notification for teacher
    const message = status === 'approved'
      ? `Your reservation for ${reservation.lab_name} on ${reservation.date} (${reservation.time_slot}) has been approved!`
      : `Your reservation for ${reservation.lab_name} on ${reservation.date} (${reservation.time_slot}) was not approved. Please try a different time slot.`;
    
    await env.DB.prepare(
      `INSERT INTO notifications 
       (type, reservation_id, from_email, to_email, subject, message, lab, date, time_slot, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      'approval',
      reservationId,
      user.email,
      reservation.user_email,
      status === 'approved' ? 'Reservation Approved' : 'Reservation Not Approved',
      message,
      reservation.lab_name,
      reservation.date,
      reservation.time_slot,
      status
    ).run();
    
    return jsonResponse({
      success: true,
      message: `Reservation ${status}`
    });
    
  } catch (error) {
    console.error('Update reservation error:', error);
    return errorResponse('Failed to update reservation', 500);
  }
}

// DELETE /api/reservations/:id - Delete reservation
export async function onRequestDelete(context) {
  const { request, env } = context;
  
  try {
    const user = await getUserFromToken(request, env);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const reservationId = pathParts[pathParts.length - 1];
    
    // Get reservation
    const reservation = await env.DB.prepare(
      'SELECT * FROM reservations WHERE id = ?'
    ).bind(reservationId).first();
    
    if (!reservation) {
      return errorResponse('Reservation not found', 404);
    }
    
    // Check permissions
    if (user.role !== 'Admin' && reservation.user_email !== user.email) {
      return errorResponse('You can only delete your own reservations', 403);
    }
    
    // Delete reservation (will cascade delete notifications)
    await env.DB.prepare(
      'DELETE FROM reservations WHERE id = ?'
    ).bind(reservationId).run();
    
    return jsonResponse({
      success: true,
      message: 'Reservation deleted'
    });
    
  } catch (error) {
    console.error('Delete reservation error:', error);
    return errorResponse('Failed to delete reservation', 500);
  }
}
