// functions/api/auth/login.js
export async function onRequestPost(context) {
    const { request, env } = context;
    
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    try {
        const body = await request.json();
        const { email, password } = body;

        if (!env.DB) {
            return new Response(JSON.stringify({ 
                error: 'Database not configured',
                hint: 'Bind D1 database in Settings > Functions > D1 bindings' 
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        const user = await env.DB.prepare(
            'SELECT email, password, role FROM users WHERE email = ?'
        ).bind(email).first();

        if (!user || user.password !== password) {
            return new Response(JSON.stringify({ 
                error: 'Invalid credentials' 
            }), {
                status: 401,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        return new Response(JSON.stringify({
            success: true,
            user: { email: user.email, role: user.role }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
        
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Login error',
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
