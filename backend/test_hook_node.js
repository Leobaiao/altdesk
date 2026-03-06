const http = require('http');

const data = JSON.stringify({
    EventType: 'messages',
    message: {
        sender_pn: '5511976131029@s.whatsapp.net',
        text: 'SIMULACAO VIA NODE SCRIPT',
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
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
