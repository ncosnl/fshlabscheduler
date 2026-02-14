// functions/api/notifications/[id].js
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// PUT - Mark notification as read (endpoint: /api/notifications/:id/read)
export async function onRequestPut(context) {
  const { env, params, request } = context;
  
  try {
    const url = new URL(request.url);
    const id = params.id;
    
    // Check if this is the /read endpoint
    if (!url.pathname.endsWith('/read')) {
      return new Response(JSON.stringify({ 
        error: 'Invalid endpoint. Use /api/notifications/:id/read' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const result = await env.DB.prepare(
      'UPDATE notifications SET read = 1 WHERE id = ?'
    ).bind(id).run();

    if (!result.success) {
      return new Response(JSON.stringify({ 
        error: 'Failed to mark notification as read' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Notification marked as read'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Mark notification read error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to mark notification as read',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// DELETE - Delete notification
export async function onRequestDelete(context) {
  const { env, params } = context;
  
  try {
    const id = params.id;

    const result = await env.DB.prepare(
      'DELETE FROM notifications WHERE id = ?'
    ).bind(id).run();

    if (!result.success) {
      return new Response(JSON.stringify({ 
        error: 'Failed to delete notification' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Notification deleted successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Delete notification error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to delete notification',
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
