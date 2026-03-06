
const http = require('http');

const optionsLocalhost = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/conversations', // arbitrary endpoint, handled by auth but port should connect
    method: 'GET',
    timeout: 2000
};

const optionsIP = {
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/conversations',
    method: 'GET',
    timeout: 2000
};

function test(name, opts) {
    const req = http.request(opts, (res) => {
        console.log(`${name}: Connected - Status ${res.statusCode}`);
    });

    req.on('error', (e) => {
        console.error(`${name}: Failed - ${e.message}`);
    });

    req.on('timeout', () => {
        req.destroy();
        console.error(`${name}: Timeout`);
    });

    req.end();
}

console.log("Testing connectivity...");
test("localhost", optionsLocalhost);
test("127.0.0.1", optionsIP);
