// functions/api/test.js
// Simple test to verify Functions are working

export async function onRequest(context) {
    return new Response(JSON.stringify({ 
        success: true,
        message: "Functions are working!",
        timestamp: new Date().toISOString()
    }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}
