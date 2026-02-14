// functions/api/notifications/index.js
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// GET - Get user notifications
export async function onRequestGet(context) {
  const { request, env } = context;
  
  try {
    const url = new URL(request.url);
    const userEmail = url.searchParams.get('user');

    if (!userEmail) {
      return new Response(JSON.stringify({ 
        error: 'Missing user parameter' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const { results } = await env.DB.prepare(
      `SELECT * FROM notifications 
       WHERE to_email = ? 
       ORDER BY created_at DESC`
    ).bind(userEmail).all();

    return new Response(JSON.stringify({
      success: true,
      notifications: results || []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch notifications',
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
