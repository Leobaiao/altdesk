
import { getPool } from "../src/db.js";
import { requirePermission } from "../src/mw.js";

async function testPermissionMiddleware() {
    console.log("Starting permission middleware test...");
    
    const mockRes = {
        status: function(code) {
            this.statusCode = code;
            return this;
        },
        json: function(data) {
            this.body = data;
            return this;
        }
    };
    
    const mockNext = () => {
        console.log("Success: Next was called");
    };
    
    const middleware = requirePermission('users');
    
    // Case 1: User with permission
    const req1 = {
        user: {
            role: 'AGENT',
            permissions: { users: true }
        }
    };
    console.log("\nTesting user WITH permission...");
    middleware(req1, mockRes, mockNext);
    
    // Case 2: User WITHOUT permission
    const req2 = {
        user: {
            role: 'AGENT',
            permissions: { users: false }
        }
    };
    console.log("\nTesting user WITHOUT permission...");
    const res2 = Object.assign({}, mockRes);
    middleware(req2, res2, () => console.log("FAIL: Next called for user without permission"));
    console.log("Response Code:", res2.statusCode);
    console.log("Response Body:", res2.body);
    
    // Case 3: Admin bypass
    const req3 = {
        user: {
            role: 'ADMIN',
            permissions: { users: false } // Admin should bypass
        }
    };
    console.log("\nTesting ADMIN bypass (even with false permission)...");
    middleware(req3, mockRes, mockNext);

    console.log("\nTest completed.");
}

testPermissionMiddleware().catch(console.error);
