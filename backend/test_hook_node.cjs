const http = require('http');

const data = JSON.stringify({
    EventType: 'messages',
    message: {
        sender_pn: '5511976131029@s.whatsapp.net',
        text: 'TESTE FINAL APOS RESET',
        type: 'text'
    },
    chat: {
        name: 'Leo Teste'
    }
});

const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/api/whatsapp/gti/whatsapp-gti-dev/test',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    let responseData = '';
    res.on('data', (chunk) => { responseData += chunk; });
    res.on('end', () => {
        console.log(`BODY: ${responseData}`);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
