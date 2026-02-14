// functions/api/reservations/[id].js
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// PUT - Update reservation (approve/reject)
export async function onRequestPut(context) {
  const { request, env, params } = context;
  
  try {
    const id = params.id;
    const { status, admin_email } = await request.json();

    if (!status || !['approved', 'rejected'].includes(status)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid status. Must be approved or rejected' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get the reservation
    const reservation = await env.DB.prepare(
      'SELECT * FROM reservations WHERE id = ?'
    ).bind(id).first();

    if (!reservation) {
      return new Response(JSON.stringify({ 
        error: 'Reservation not found' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Update reservation status
    const result = await env.DB.prepare(
      'UPDATE reservations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(status, id).run();

    if (!result.success) {
      return new Response(JSON.stringify({ 
        error: 'Failed to update reservation' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get updated reservation
    const updated = await env.DB.prepare(
      'SELECT * FROM reservations WHERE id = ?'
    ).bind(id).first();

    // Create notification for teacher
    const message = status === 'approved'
      ? `Your reservation for ${updated.lab_name} on ${updated.date} (${updated.time_slot}) has been approved!`
      : `Your reservation for ${updated.lab_name} on ${updated.date} (${updated.time_slot}) was not approved. Please try a different time slot.`;

    await env.DB.prepare(
      `INSERT INTO notifications 
       (type, reservation_id, from_email, to_email, subject, message, 
        lab, date, time_slot, status, read) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
    ).bind(
      'approval',
      id,
      admin_email || 'admin@firstasia.edu.ph',
      updated.teacher_email,
      status === 'approved' ? 'Reservation Approved' : 'Reservation Not Approved',
      message,
      updated.lab_name,
      updated.date,
      updated.time_slot,
      status
    ).run();

    return new Response(JSON.stringify({
      success: true,
      reservation: updated
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Update reservation error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to update reservation',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// DELETE - Delete reservation
export async function onRequestDelete(context) {
  const { env, params } = context;
  
  try {
    const id = params.id;

    // Check if reservation exists
    const reservation = await env.DB.prepare(
      'SELECT * FROM reservations WHERE id = ?'
    ).bind(id).first();

    if (!reservation) {
      return new Response(JSON.stringify({ 
        error: 'Reservation not found' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Delete associated notifications first
    await env.DB.prepare(
      'DELETE FROM notifications WHERE reservation_id = ?'
    ).bind(id).run();

    // Delete reservation
    const result = await env.DB.prepare(
      'DELETE FROM reservations WHERE id = ?'
    ).bind(id).run();

    if (!result.success) {
      return new Response(JSON.stringify({ 
        error: 'Failed to delete reservation' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Reservation deleted successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Delete reservation error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to delete reservation',
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
