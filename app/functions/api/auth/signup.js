// functions/api/auth/signup.js
export async function onRequestPost(context) {
  const { request, env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const { email, password, role } = await request.json();

    // Validate input
    if (!email || !password || !role) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: email, password, role' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Validate email domain
    if (!email.endsWith('@firstasia.edu.ph')) {
      return new Response(JSON.stringify({ 
        error: 'Use school email (@firstasia.edu.ph)' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Validate role
    if (!['Teacher', 'Admin'].includes(role)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid role. Must be Teacher or Admin' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Validate password length
    if (password.length < 6) {
      return new Response(JSON.stringify({ 
        error: 'Password must be at least 6 characters long' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (!env.DB) {
      return new Response(JSON.stringify({ 
        error: 'Database not configured',
        hint: 'Bind D1 database in Settings > Functions > D1 bindings' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check if user already exists
    const existing = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first();

    if (existing) {
      return new Response(JSON.stringify({ 
        error: 'Email already registered' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Create user
    const result = await env.DB.prepare(
      'INSERT INTO users (email, password, role) VALUES (?, ?, ?)'
    ).bind(email, password, role).run();

    if (!result.success) {
      return new Response(JSON.stringify({ 
        error: 'Failed to create user' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      user: { email, role }
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Signup error:', error);
    return new Response(JSON.stringify({ 
      error: 'Signup failed',
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
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
