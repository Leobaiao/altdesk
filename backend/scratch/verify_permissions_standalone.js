
// Standalone logic from mw.ts
function requirePermission(...permissions) {
  return (req, res, next) => {
    const u = req.user;
    if (!u) return res.status(403).json({ error: "Forbidden" });

    // SUPERADMIN and ADMIN can access everything
    if (u.role === 'SUPERADMIN' || u.role === 'ADMIN') return next();

    // Check granular permissions — user needs ANY of the listed permissions
    if (u.permissions) {
      const hasAny = permissions.some(p => u.permissions[p] === true);
      if (hasAny) return next();
    }

    return res.status(403).json({ 
      error: "Acesso Negado", 
      message: `Você não tem a permissão necessária: ${permissions.join(' ou ')}` 
    });
  };
}

async function testPermissionMiddleware() {
    console.log("Starting permission middleware test...");
    
    let nextCalled = false;
    let statusSet = 200;
    let bodySent = null;

    const mockRes = {
        status: function(code) {
            statusSet = code;
            return this;
        },
        json: function(data) {
            bodySent = data;
            return this;
        }
    };
    
    const mockNext = () => {
        nextCalled = true;
    };
    
    const middleware = requirePermission('users');
    
    // Case 1: User with permission
    nextCalled = false;
    const req1 = {
        user: {
            role: 'AGENT',
            permissions: { users: true }
        }
    };
    console.log("Testing user WITH permission...");
    middleware(req1, mockRes, mockNext);
    console.log("Next called:", nextCalled);
    
    // Case 2: User WITHOUT permission
    nextCalled = false;
    statusSet = 200;
    bodySent = null;
    const req2 = {
        user: {
            role: 'AGENT',
            permissions: { users: false }
        }
    };
    console.log("\nTesting user WITHOUT permission...");
    middleware(req2, mockRes, mockNext);
    console.log("Next called:", nextCalled);
    console.log("Response Code:", statusSet);
    console.log("Response Body:", bodySent);
    
    // Case 3: Admin bypass
    nextCalled = false;
    const req3 = {
        user: {
            role: 'ADMIN',
            permissions: { users: false } // Admin should bypass even if checkbox is off
        }
    };
    console.log("\nTesting ADMIN bypass...");
    middleware(req3, mockRes, mockNext);
    console.log("Next called:", nextCalled);

    // Case 4: Multiple permissions (Chat OR Tickets)
    const middlewareMultiple = requirePermission('chat', 'tickets');
    
    nextCalled = false;
    const req4 = {
        user: {
            role: 'AGENT',
            permissions: { chat: false, tickets: true }
        }
    };
    console.log("\nTesting user with partial permission (chat:false, tickets:true) for requirePermission('chat', 'tickets')...");
    middlewareMultiple(req4, mockRes, mockNext);
    console.log("Next called:", nextCalled);

    console.log("\nTest completed.");
}

testPermissionMiddleware().catch(console.error);
