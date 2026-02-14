// functions/api/notifications/unread-count.js
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

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

    const result = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM notifications 
       WHERE to_email = ? AND read = 0`
    ).bind(userEmail).first();

    return new Response(JSON.stringify({
      success: true,
      count: result?.count || 0
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Get unread count error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to get unread count',
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
