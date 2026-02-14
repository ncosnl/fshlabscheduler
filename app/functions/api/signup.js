// functions/api/auth/signup.js
export async function onRequestPost(context) {
    const { request, env } = context;
    
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    try {
        const body = await request.json();
        const { email, password, role } = body;

        if (!email || !password || !role) {
            return new Response(JSON.stringify({ 
                error: 'Missing required fields' 
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        if (!email.endsWith('@firstasia.edu.ph')) {
            return new Response(JSON.stringify({ 
                error: 'Use school email' 
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

        await env.DB.prepare(
            'INSERT INTO users (email, password, role) VALUES (?, ?, ?)'
        ).bind(email, password, role).run();

        return new Response(JSON.stringify({
            success: true,
            user: { email, role }
        }), {
            status: 201,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
        
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Signup error',
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
