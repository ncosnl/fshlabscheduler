// functions/api/reservations/index.js
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// GET - List reservations
export async function onRequestGet(context) {
  const { request, env } = context;
  
  try {
    const url = new URL(request.url);
    const lab = url.searchParams.get('lab');
    const date = url.searchParams.get('date');
    const teacher = url.searchParams.get('teacher');
    const status = url.searchParams.get('status');

    let query = 'SELECT * FROM reservations WHERE 1=1';
    const params = [];

    if (lab) {
      query += ' AND lab_name = ?';
      params.push(lab);
    }
    if (date) {
      query += ' AND date = ?';
      params.push(date);
    }
    if (teacher) {
      query += ' AND teacher_email = ?';
      params.push(teacher);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY date DESC, time_slot ASC';

    const stmt = env.DB.prepare(query).bind(...params);
    const { results } = await stmt.all();

    return new Response(JSON.stringify({
      success: true,
      reservations: results || []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Get reservations error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch reservations',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// POST - Create reservation
export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const data = await request.json();
    const {
      lab_name, date, time_slot, teacher_email, teacher_name,
      subject, grade_level, num_students, purpose
    } = data;

    // Validate required fields
    if (!lab_name || !date || !time_slot || !teacher_email || !teacher_name || 
        !subject || !grade_level || !num_students || !purpose) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check if slot is already taken
    const existing = await env.DB.prepare(
      `SELECT id FROM reservations 
       WHERE lab_name = ? AND date = ? AND time_slot = ? 
       AND status != 'rejected'`
    ).bind(lab_name, date, time_slot).first();

    if (existing) {
      return new Response(JSON.stringify({ 
        error: 'This time slot is already reserved' 
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Create reservation
    const result = await env.DB.prepare(
      `INSERT INTO reservations 
       (lab_name, date, time_slot, teacher_email, teacher_name, subject, 
        grade_level, num_students, purpose, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    ).bind(
      lab_name, date, time_slot, teacher_email, teacher_name,
      subject, grade_level, num_students, purpose
    ).run();

    if (!result.success) {
      return new Response(JSON.stringify({ 
        error: 'Failed to create reservation' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const reservationId = result.meta.last_row_id;

    // Get the created reservation
    const reservation = await env.DB.prepare(
      'SELECT * FROM reservations WHERE id = ?'
    ).bind(reservationId).first();

    // Create notifications for all admins
    const { results: admins } = await env.DB.prepare(
      "SELECT email FROM users WHERE role = 'Admin'"
    ).all();

    if (admins && admins.length > 0) {
      for (const admin of admins) {
        await env.DB.prepare(
          `INSERT INTO notifications 
           (type, reservation_id, from_email, to_email, subject, message, 
            lab, date, time_slot, status, read) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
        ).bind(
          'request',
          reservationId,
          teacher_email,
          admin.email,
          `New Lab Request: ${lab_name}`,
          `${teacher_name} has requested ${lab_name} for ${subject} class.`,
          lab_name,
          date,
          time_slot,
          'pending'
        ).run();
      }
    }

    return new Response(JSON.stringify({
      success: true,
      reservation: reservation
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Create reservation error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to create reservation',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}
