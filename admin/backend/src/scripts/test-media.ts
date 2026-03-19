import "dotenv/config";

async function testMedia() {
    const url = "http://127.0.0.1:3001/api/webhooks/whatsapp/gti/whatsapp-gti-dev/messages";
    const payload = {
        EventType: "messages",
        message: {
            type: "image",
            chatid: "5511999999999@s.whatsapp.net",
            sender_pn: "5511999999999@s.whatsapp.net",
            url: "https://placehold.co/600x400.png",
            caption: "Imagem de teste",
            messageTimestamp: Date.now()
        }
    };

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const txt = await res.text();
            console.error("Webhook failed:", res.status, txt);
            process.exit(1);
        }

        const data = await res.json();
        console.log("Webhook successful!", data);
    } catch (err) {
        console.error("Network error:", err);
        process.exit(1);
    }
}

testMedia();
