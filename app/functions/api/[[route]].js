// ============================================================================
// MAIN API ROUTER - Handles all backend requests
// File: functions/api/[[route]].js
// Cloudflare Pages Functions with catch-all routing
// ============================================================================

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    
    // Remove /api/ from the path
    const pathParts = url.pathname.split('/').filter(p => p);
    // pathParts = ['api', 'auth', 'login'] -> we want ['auth', 'login']
    const apiIndex = pathParts.indexOf('api');
    const path = apiIndex >= 0 ? pathParts.slice(apiIndex + 1).join('/') : pathParts.join('/');
    
    const method = request.method;

    // CORS headers for all responses
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (method === 'OPTIONS') {
        return new Response(null, { 
            status: 204,
            headers: corsHeaders 
        });
    }

    try {
        console.log(`${method} /api/${path}`);

        // Route to appropriate handler
        if (path.startsWith('auth/') || path === 'auth/login' || path === 'auth/signup' || path === 'auth/change-password') {
            return await handleAuth(request, env, path, method, corsHeaders);
        } else if (path.startsWith('reservations') || path === 'reservations') {
            return await handleReservations(request, env, path, method, corsHeaders);
        } else if (path.startsWith('notifications') || path === 'notifications') {
            return await handleNotifications(request, env, path, method, corsHeaders);
        } else {
            return jsonResponse({ error: 'Not found', path, method }, 404, corsHeaders);
        }
    } catch (error) {
        console.error('API Error:', error);
        return jsonResponse({ 
            error: error.message,
            details: error.toString()
        }, 500, corsHeaders);
    }
}

// ============================================================================
// AUTHENTICATION HANDLERS
// ============================================================================

async function handleAuth(request, env, path, method, corsHeaders) {
    try {
        // POST /api/auth/signup
        if ((path === 'auth/signup' || path.endsWith('/signup')) && method === 'POST') {
            const body = await request.json();
            const { email, password, role } = body;

            if (!email || !password || !role) {
                return jsonResponse({ error: 'Missing required fields' }, 400, corsHeaders);
            }

            if (!email.endsWith('@firstasia.edu.ph')) {
                return jsonResponse({ error: 'Use school email' }, 400, corsHeaders);
            }

            if (!env.DB) {
                return jsonResponse({ 
                    error: 'Database not configured',
                    hint: 'Bind D1 database in Settings > Functions > D1 bindings' 
                }, 500, corsHeaders);
            }

            const existing = await env.DB.prepare(
                'SELECT id FROM users WHERE email = ?'
            ).bind(email).first();

            if (existing) {
                return jsonResponse({ error: 'Email already registered' }, 400, corsHeaders);
            }

            await env.DB.prepare(
                'INSERT INTO users (email, password, role) VALUES (?, ?, ?)'
            ).bind(email, password, role).run();

            return jsonResponse({
                success: true,
                user: { email, role }
            }, 201, corsHeaders);
        }

        // POST /api/auth/login
        if ((path === 'auth/login' || path.endsWith('/login')) && method === 'POST') {
            const body = await request.json();
            const { email, password } = body;

            if (!env.DB) {
                return jsonResponse({ 
                    error: 'Database not configured',
                    hint: 'Bind D1 database in Settings > Functions > D1 bindings' 
                }, 500, corsHeaders);
            }

            const user = await env.DB.prepare(
                'SELECT email, password, role FROM users WHERE email = ?'
            ).bind(email).first();

            if (!user || user.password !== password) {
                return jsonResponse({ error: 'Invalid credentials' }, 401, corsHeaders);
            }

            return jsonResponse({
                success: true,
                user: { email: user.email, role: user.role }
            }, 200, corsHeaders);
        }

        // POST /api/auth/change-password
        if ((path === 'auth/change-password' || path.endsWith('/change-password')) && method === 'POST') {
            const body = await request.json();
            const { email, currentPassword, newPassword } = body;

            if (!env.DB) {
                return jsonResponse({ error: 'Database not configured' }, 500, corsHeaders);
            }

            const user = await env.DB.prepare(
                'SELECT password FROM users WHERE email = ?'
            ).bind(email).first();

            if (!user || user.password !== currentPassword) {
                return jsonResponse({ error: 'Current password incorrect' }, 401, corsHeaders);
            }

            await env.DB.prepare(
                'UPDATE users SET password = ? WHERE email = ?'
            ).bind(newPassword, email).run();

            return jsonResponse({ success: true }, 200, corsHeaders);
        }

        return jsonResponse({ 
            error: 'Endpoint not found',
            path,
            method,
            hint: 'Check if the endpoint and method are correct'
        }, 404, corsHeaders);
        
    } catch (error) {
        console.error('Auth error:', error);
        return jsonResponse({ 
            error: 'Authentication error',
            message: error.message 
        }, 500, corsHeaders);
    }
}

// ============================================================================
// RESERVATION HANDLERS
// ============================================================================

async function handleReservations(request, env, path, method, corsHeaders) {
    const url = new URL(request.url);

    try {
        if (!env.DB) {
            return jsonResponse({ error: 'Database not configured' }, 500, corsHeaders);
        }

        // GET /api/reservations
        if (path === 'reservations' && method === 'GET') {
            const lab = url.searchParams.get('lab');
            const date = url.searchParams.get('date');
            const teacher = url.searchParams.get('teacher');
            const status = url.searchParams.get('status');

            let query = 'SELECT * FROM reservations WHERE 1=1';
            let params = [];

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

            query += ' ORDER BY date ASC, time_slot ASC';

            const stmt = env.DB.prepare(query).bind(...params);
            const { results } = await stmt.all();

            return jsonResponse({ reservations: results || [] }, 200, corsHeaders);
        }

        // POST /api/reservations
        if (path === 'reservations' && method === 'POST') {
            const data = await request.json();
            const {
                lab_name, date, time_slot, teacher_email, teacher_name,
                subject, grade_level, num_students, purpose
            } = data;

            const conflict = await env.DB.prepare(
                'SELECT id FROM reservations WHERE lab_name = ? AND date = ? AND time_slot = ? AND status != ?'
            ).bind(lab_name, date, time_slot, 'rejected').first();

            if (conflict) {
                return jsonResponse({ error: 'Time slot already reserved' }, 400, corsHeaders);
            }

            const result = await env.DB.prepare(
                `INSERT INTO reservations 
                (lab_name, date, time_slot, teacher_email, teacher_name, subject, grade_level, num_students, purpose, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
            ).bind(
                lab_name, date, time_slot, teacher_email, teacher_name,
                subject, grade_level, num_students, purpose
            ).run();

            const reservationId = result.meta.last_row_id;

            const admins = await env.DB.prepare(
                "SELECT email FROM users WHERE role = 'Admin'"
            ).all();

            for (const admin of admins.results || []) {
                await env.DB.prepare(
                    `INSERT INTO notifications 
                    (type, reservation_id, from_email, to_email, subject, message, lab, date, time_slot, status) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                ).bind(
                    'request', reservationId, teacher_email, admin.email,
                    `New Lab Request: ${lab_name}`,
                    `${teacher_name} has requested ${lab_name} for ${subject} class.`,
                    lab_name, date, time_slot, 'pending'
                ).run();
            }

            return jsonResponse({ success: true, reservation_id: reservationId }, 201, corsHeaders);
        }

        // PUT /api/reservations/:id
        const updateMatch = path.match(/^reservations\/(\d+)$/);
        if (updateMatch && method === 'PUT') {
            const id = updateMatch[1];
            const body = await request.json();
            const { status, admin_email } = body;

            if (!['approved', 'rejected'].includes(status)) {
                return jsonResponse({ error: 'Invalid status' }, 400, corsHeaders);
            }

            const reservation = await env.DB.prepare(
                'SELECT * FROM reservations WHERE id = ?'
            ).bind(id).first();

            if (!reservation) {
                return jsonResponse({ error: 'Reservation not found' }, 404, corsHeaders);
            }

            await env.DB.prepare(
                'UPDATE reservations SET status = ? WHERE id = ?'
            ).bind(status, id).run();

            const message = status === 'approved'
                ? `Your reservation for ${reservation.lab_name} on ${reservation.date} (${reservation.time_slot}) has been approved!`
                : `Your reservation for ${reservation.lab_name} on ${reservation.date} (${reservation.time_slot}) was not approved.`;

            await env.DB.prepare(
                `INSERT INTO notifications 
                (type, reservation_id, from_email, to_email, subject, message, lab, date, time_slot, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
                'approval', id, admin_email || 'admin', reservation.teacher_email,
                status === 'approved' ? 'Reservation Approved' : 'Reservation Not Approved',
                message, reservation.lab_name, reservation.date, reservation.time_slot, status
            ).run();

            return jsonResponse({ success: true }, 200, corsHeaders);
        }

        // DELETE /api/reservations/:id
        const deleteMatch = path.match(/^reservations\/(\d+)$/);
        if (deleteMatch && method === 'DELETE') {
            const id = deleteMatch[1];

            await env.DB.prepare('DELETE FROM reservations WHERE id = ?').bind(id).run();
            await env.DB.prepare('DELETE FROM notifications WHERE reservation_id = ?').bind(id).run();

            return jsonResponse({ success: true }, 200, corsHeaders);
        }

        return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
        
    } catch (error) {
        console.error('Reservation error:', error);
        return jsonResponse({ 
            error: 'Reservation error',
            message: error.message 
        }, 500, corsHeaders);
    }
}

// ============================================================================
// NOTIFICATION HANDLERS
// ============================================================================

async function handleNotifications(request, env, path, method, corsHeaders) {
    const url = new URL(request.url);

    try {
        if (!env.DB) {
            return jsonResponse({ error: 'Database not configured' }, 500, corsHeaders);
        }

        // GET /api/notifications
        if (path === 'notifications' && method === 'GET') {
            const user = url.searchParams.get('user');

            if (!user) {
                return jsonResponse({ error: 'User email required' }, 400, corsHeaders);
            }

            const { results } = await env.DB.prepare(
                'SELECT * FROM notifications WHERE to_email = ? ORDER BY created_at DESC'
            ).bind(user).all();

            return jsonResponse({ notifications: results || [] }, 200, corsHeaders);
        }

        // PUT /api/notifications/:id/read
        const readMatch = path.match(/^notifications\/(\d+)\/read$/);
        if (readMatch && method === 'PUT') {
            const id = readMatch[1];

            await env.DB.prepare(
                'UPDATE notifications SET read = 1 WHERE id = ?'
            ).bind(id).run();

            return jsonResponse({ success: true }, 200, corsHeaders);
        }

        // GET /api/notifications/unread-count
        if (path === 'notifications/unread-count' && method === 'GET') {
            const user = url.searchParams.get('user');

            if (!user) {
                return jsonResponse({ error: 'User email required' }, 400, corsHeaders);
            }

            const result = await env.DB.prepare(
                'SELECT COUNT(*) as count FROM notifications WHERE to_email = ? AND read = 0'
            ).bind(user).first();

            return jsonResponse({ count: result?.count || 0 }, 200, corsHeaders);
        }

        return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
        
    } catch (error) {
        console.error('Notification error:', error);
        return jsonResponse({ 
            error: 'Notification error',
            message: error.message 
        }, 500, corsHeaders);
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function jsonResponse(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...headers
        }
    });
}