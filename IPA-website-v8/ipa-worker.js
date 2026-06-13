const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // ── TEMPORARY PASSWORD RESET — REMOVE AFTER USE ──
    if (path === '/reset-admin-pw') {
      await env.IPA_DATA.put('admin_password', 'IPA@Admin2026');
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS });
    }

    // ── DIAGNOSTIC TEST ──
    if (path === '/test') {
      const diagnostics = {
        worker_running: true,
        kv_binding_exists: typeof env.IPA_DATA !== 'undefined',
        kv_binding_type: typeof env.IPA_DATA,
        env_keys: Object.keys(env),
        timestamp: new Date().toISOString(),
      };
      try {
        const testRead = await env.IPA_DATA.get('members');
        diagnostics.kv_read_success = true;
        diagnostics.kv_members_value = testRead === null ? 'null (empty - normal)' : 'has data';
      } catch(e) {
        diagnostics.kv_read_success = false;
        diagnostics.kv_error = e.message;
      }
      try {
        await env.IPA_DATA.put('test_key', 'hello_ipa');
        diagnostics.kv_write_success = true;
      } catch(e) {
        diagnostics.kv_write_success = false;
        diagnostics.kv_write_error = e.message;
      }
      return new Response(JSON.stringify(diagnostics, null, 2), { status: 200, headers: CORS });
    }

    // ── GET ALL MEMBERS ──
    if (path === '/api/members' && request.method === 'GET') {
      try {
        const raw = await env.IPA_DATA.get('members');
        const members = raw ? JSON.parse(raw) : [];
        return new Response(JSON.stringify(members), { status: 200, headers: CORS });
      } catch(e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
      }
    }

    // ── APPLY (membership form) ──
    if (path === '/api/apply' && request.method === 'POST') {
      try {
        const body = await request.json();
        const raw = await env.IPA_DATA.get('members');
        const members = raw ? JSON.parse(raw) : [];
        if (members.find(m => m.email === body.email)) {
          return new Response(JSON.stringify({ error: 'An application with this email already exists.' }), { status: 409, headers: CORS });
        }
        const nums = members.map(m => parseInt((m.id||'').replace('IPA-',''))).filter(n=>!isNaN(n));
        const nextNum = Math.max(0, ...nums) + 1;
        const id = 'IPA-' + String(nextNum).padStart(3,'0');
        const newMember = {
          id,
          name: `${body.firstName||''} ${body.lastName||''}`.trim(),
          email: body.email||'',
          phone: body.phone||'',
          address: body.address||'',
          occupation: body.occupation||'',
          employer: body.employer||'',
          village: body.village||'',
          kindred: body.kindred||'',
          title: body.title||'',
          gender: body.gender||'',
          referral: body.referral||'',
          whyJoin: body.whyJoin||'',
          joined: new Date().toISOString().slice(0,7),
          lastDues: '',
          status: 'pending',
          password: '',
          birthdayDay: '',
          birthdayMonth: '',
          notes: 'Applied via membership form',
          appliedAt: new Date().toISOString(),
        };
        members.push(newMember);
        await env.IPA_DATA.put('members', JSON.stringify(members));
        return new Response(JSON.stringify({ success: true, id: newMember.id }), { status: 200, headers: CORS });
      } catch(e) {
        return new Response(JSON.stringify({ error: e.message, stack: e.stack }), { status: 500, headers: CORS });
      }
    }

    // ── GET ANNOUNCEMENTS ──
    if (path === '/api/announcements' && request.method === 'GET') {
      try {
        const raw = await env.IPA_DATA.get('announcements');
        return new Response(JSON.stringify(raw ? JSON.parse(raw) : []), { status: 200, headers: CORS });
      } catch(e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
      }
    }

    // ── POST ANNOUNCEMENT ──
    if (path === '/api/announcements' && request.method === 'POST') {
      try {
        const body = await request.json();
        const raw = await env.IPA_DATA.get('announcements');
        const announcements = raw ? JSON.parse(raw) : [];
        const item = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2,7),
          category: body.category||'notice',
          title: body.title||'',
          body: body.body||'',
          date: body.date||new Date().toISOString().slice(0,10),
          pinned: body.pinned||false,
          createdAt: new Date().toISOString(),
        };
        announcements.push(item);
        await env.IPA_DATA.put('announcements', JSON.stringify(announcements));
        return new Response(JSON.stringify({ success: true, announcement: item }), { status: 200, headers: CORS });
      } catch(e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
      }
    }

    // ── DELETE ANNOUNCEMENT ──
    if (path.startsWith('/api/announcements/') && request.method === 'DELETE') {
      try {
        const id = path.split('/')[3];
        const raw = await env.IPA_DATA.get('announcements');
        let announcements = raw ? JSON.parse(raw) : [];
        announcements = announcements.filter(a => a.id !== id);
        await env.IPA_DATA.put('announcements', JSON.stringify(announcements));
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS });
      } catch(e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
      }
    }

    // ── UPDATE ANNOUNCEMENT ──
    if (path.startsWith('/api/announcements/') && request.method === 'PUT') {
      try {
        const id = path.split('/')[3];
        const body = await request.json();
        const raw = await env.IPA_DATA.get('announcements');
        let announcements = raw ? JSON.parse(raw) : [];
        const idx = announcements.findIndex(a => a.id === id);
        if (idx !== -1) announcements[idx] = { ...announcements[idx], ...body };
        await env.IPA_DATA.put('announcements', JSON.stringify(announcements));
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS });
      } catch(e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
      }
    }

    // ── ADD MEMBER (admin) ──
    if (path === '/api/members' && request.method === 'POST') {
      try {
        const body = await request.json();
        const raw = await env.IPA_DATA.get('members');
        const members = raw ? JSON.parse(raw) : [];
        const nums = members.map(m => parseInt((m.id||'').replace('IPA-',''))).filter(n=>!isNaN(n));
        const nextNum = Math.max(0, ...nums) + 1;
        const newMember = {
          id: 'IPA-' + String(nextNum).padStart(3,'0'),
          ...body,
          joined: body.joined || new Date().toISOString().slice(0,7),
        };
        members.push(newMember);
        await env.IPA_DATA.put('members', JSON.stringify(members));
        return new Response(JSON.stringify({ success: true, member: newMember }), { status: 200, headers: CORS });
      } catch(e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
      }
    }

    // ── UPDATE MEMBER ──
    if (path.startsWith('/api/members/') && request.method === 'PUT') {
      try {
        const id = path.split('/')[3];
        const body = await request.json();
        const raw = await env.IPA_DATA.get('members');
        let members = raw ? JSON.parse(raw) : [];
        const idx = members.findIndex(m => m.id === id);
        if (idx !== -1) members[idx] = { ...members[idx], ...body };
        await env.IPA_DATA.put('members', JSON.stringify(members));
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS });
      } catch(e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
      }
    }

    // ── DELETE MEMBER ──
    if (path.startsWith('/api/members/') && request.method === 'DELETE') {
      try {
        const id = path.split('/')[3];
        const raw = await env.IPA_DATA.get('members');
        let members = raw ? JSON.parse(raw) : [];
        members = members.filter(m => m.id !== id);
        await env.IPA_DATA.put('members', JSON.stringify(members));
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS });
      } catch(e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
      }
    }

    // ── ADMIN LOGIN ──
    if (path === '/api/admin/login' && request.method === 'POST') {
      try {
        const body = await request.json();
        const stored = await env.IPA_DATA.get('admin_password');
        const correct = stored || 'IPA@Admin2026';
        if (body.password === correct) {
          return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS });
        }
        return new Response(JSON.stringify({ success: false, error: 'Incorrect password' }), { status: 401, headers: CORS });
      } catch(e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
      }
    }

    // ── CHANGE ADMIN PASSWORD ──
    if (path === '/api/admin/change-password' && request.method === 'POST') {
      try {
        const body = await request.json();
        const stored = await env.IPA_DATA.get('admin_password');
        const current = stored || 'IPA@Admin2026';
        if (body.currentPassword !== current) {
          return new Response(JSON.stringify({ success: false, error: 'Current password is incorrect' }), { status: 401, headers: CORS });
        }
        if (!body.newPassword || body.newPassword.length < 8) {
          return new Response(JSON.stringify({ success: false, error: 'New password must be at least 8 characters' }), { status: 400, headers: CORS });
        }
        await env.IPA_DATA.put('admin_password', body.newPassword);
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS });
      } catch(e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
      }
    }

    return new Response(JSON.stringify({ error: 'Not found', path }), { status: 404, headers: CORS });
  }
};
