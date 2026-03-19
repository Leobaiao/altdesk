/**
 * AltDesk Webchat Widget v1.0
 * 
 * HOW TO EMBED:
 * <script>
 *   (function(w,d,s,o,f,js,fjs){
 *     w['AltDeskWidget']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
 *     js=d.createElement(s),fjs=d.getElementsByTagName(s)[0];
 *     js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
 *   }(window,document,'script','altdesk','https://YOUR_API_URL/widget.js'));
 *   altdesk('init', { apiUrl: 'https://YOUR_API_URL', channelId: 'YOUR_CHANNEL_ID', title: 'Fale Conosco' });
 * </script>
 */

(function () {
    "use strict";

    if (window.AltDeskWidgetLoaded) return;
    window.AltDeskWidgetLoaded = true;

    let config = { apiUrl: "", channelId: "", title: "Fale Conosco", accentColor: "#00a884" };
    let socket = null;
    let sessionId = null;
    let minimized = true;
    let initialized = false;

    // --- Build UI ---
    const styles = `
        #altdesk-widget-btn {
            position: fixed; bottom: 24px; right: 24px; z-index: 9999;
            width: 60px; height: 60px; border-radius: 50%; border: none; cursor: pointer;
            background: var(--altdesk-accent, #00a884); color: #fff; font-size: 26px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        #altdesk-widget-btn:hover { transform: scale(1.08); box-shadow: 0 6px 28px rgba(0,0,0,0.3); }
        #altdesk-widget {
            position: fixed; bottom: 98px; right: 24px; z-index: 9998;
            width: 360px; height: 540px; border-radius: 20px; overflow: hidden;
            box-shadow: 0 12px 48px rgba(0,0,0,0.2); display: flex; flex-direction: column;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            transition: opacity 0.25s, transform 0.25s;
            background: #111b21;
        }
        #altdesk-widget.hidden { opacity: 0; pointer-events: none; transform: translateY(16px) scale(0.97); }
        #altdesk-header {
            background: var(--altdesk-accent, #00a884); padding: 16px 20px; display: flex; align-items: center; gap: 12px;
        }
        #altdesk-header .title { font-weight: 700; color: #fff; font-size: 1rem; }
        #altdesk-header .sub { color: rgba(255,255,255,0.75); font-size: 0.75rem; }
        #altdesk-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; background: #0b141a; }
        .altdesk-msg { max-width: 78%; padding: 9px 14px; border-radius: 12px; font-size: 0.88rem; line-height: 1.4; word-break: break-word; }
        .altdesk-msg.in { background: #1f2c34; color: #e9edef; align-self: flex-start; border-bottom-left-radius: 4px; }
        .altdesk-msg.out { background: var(--altdesk-accent, #00a884); color: #fff; align-self: flex-end; border-bottom-right-radius: 4px; }
        .altdesk-msg .ts { font-size: 0.65rem; opacity: 0.6; margin-top: 4px; text-align: right; }
        #altdesk-name-screen { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; background: #0b141a; gap: 16px; }
        #altdesk-name-screen h3 { color: #e9edef; font-size: 1.1rem; text-align: center; margin: 0; }
        #altdesk-name-screen p { color: #8696a0; font-size: 0.85rem; text-align: center; margin: 0; }
        #altdesk-name-screen input {
            width: 100%; padding: 12px 16px; border-radius: 12px; border: 1px solid #2a3942;
            background: #1f2c34; color: #e9edef; font-size: 0.9rem; outline: none; box-sizing: border-box;
        }
        #altdesk-name-screen button {
            width: 100%; padding: 12px; border-radius: 12px; border: none; cursor: pointer;
            background: var(--altdesk-accent, #00a884); color: #fff; font-weight: 700; font-size: 0.9rem;
        }
        #altdesk-footer { padding: 10px 14px; background: #1f2c34; display: flex; gap: 8px; align-items: center; }
        #altdesk-input {
            flex: 1; padding: 10px 14px; border-radius: 24px; border: none;
            background: #2a3942; color: #e9edef; font-size: 0.88rem; outline: none;
        }
        #altdesk-send {
            width: 38px; height: 38px; border-radius: 50%; border: none; cursor: pointer;
            background: var(--altdesk-accent, #00a884); color: #fff; font-size: 18px; display: flex; align-items: center; justify-content: center;
        }
    `;

    function injectStyles() {
        const el = document.createElement("style");
        el.textContent = styles;
        document.head.appendChild(el);
    }

    function createWidget() {
        // Floating button
        const btn = document.createElement("button");
        btn.id = "altdesk-widget-btn";
        btn.innerHTML = "💬";
        btn.onclick = toggleWidget;
        document.body.appendChild(btn);

        // Widget panel
        const widget = document.createElement("div");
        widget.id = "altdesk-widget";
        widget.classList.add("hidden");
        widget.innerHTML = `
            <div id="altdesk-header">
                <div>
                    <div class="title">${config.title}</div>
                    <div class="sub">Geralmente responde em minutos</div>
                </div>
            </div>
            <div id="altdesk-name-screen">
                <h3>👋 Olá! Como posso te chamar?</h3>
                <p>Antes de começar, nos diga seu nome</p>
                <input id="altdesk-name-input" placeholder="Seu nome..." />
                <button id="altdesk-start-btn">Iniciar conversa →</button>
            </div>
            <div id="altdesk-messages" style="display:none"></div>
            <div id="altdesk-footer" style="display:none">
                <input id="altdesk-input" placeholder="Digite sua mensagem..." />
                <button id="altdesk-send">➤</button>
            </div>
        `;
        document.body.appendChild(widget);

        document.getElementById("altdesk-start-btn").onclick = startSession;
        document.getElementById("altdesk-send").onclick = sendMessage;
        document.getElementById("altdesk-input").addEventListener("keydown", (e) => {
            if (e.key === "Enter") sendMessage();
        });
    }

    function toggleWidget() {
        const widget = document.getElementById("altdesk-widget");
        minimized = !minimized;
        widget.classList.toggle("hidden", minimized);
        document.getElementById("altdesk-widget-btn").innerHTML = minimized ? "💬" : "✕";
    }

    function appendMessage(text, direction) {
        const container = document.getElementById("altdesk-messages");
        const msg = document.createElement("div");
        msg.className = `altdesk-msg ${direction}`;
        const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        msg.innerHTML = `<div>${escapeHtml(text)}</div><div class="ts">${time}</div>`;
        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
    }

    function escapeHtml(t) {
        const d = document.createElement("div"); d.appendChild(document.createTextNode(t)); return d.innerHTML;
    }

    async function startSession() {
        const nameInput = document.getElementById("altdesk-name-input");
        const name = nameInput.value.trim();
        if (!name) { nameInput.focus(); return; }

        sessionId = "wc_" + Math.random().toString(36).slice(2) + "_" + Date.now();

        try {
            // Notify backend: create a webchat session
            await fetch(`${config.apiUrl}/api/public/webchat/session`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId, name, channelId: config.channelId })
            });

            // Switch to chat view
            document.getElementById("altdesk-name-screen").style.display = "none";
            document.getElementById("altdesk-messages").style.display = "flex";
            document.getElementById("altdesk-footer").style.display = "flex";

            appendMessage(`Olá, ${name}! Seja bem-vindo(a). Em breve um de nossos atendentes irá te responder. 😊`, "in");
        } catch (e) {
            console.error("[AltDesk Widget] Failed to create session:", e);
        }
    }

    async function sendMessage() {
        const input = document.getElementById("altdesk-input");
        const text = input.value.trim();
        if (!text || !sessionId) return;
        input.value = "";
        appendMessage(text, "out");

        try {
            await fetch(`${config.apiUrl}/api/public/webchat/message`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId, text, channelId: config.channelId })
            });
        } catch (e) {
            console.error("[AltDesk Widget] Failed to send message:", e);
        }
    }

    // --- Public API ---
    const queue = window["AltDeskWidget"]?.q || [];
    window["AltDeskWidget"] = function (method, opts) {
        if (method === "init") {
            config = { ...config, ...opts };
            if (config.accentColor) {
                document.documentElement.style.setProperty("--altdesk-accent", config.accentColor);
            }
            if (!initialized) {
                initialized = true;
                injectStyles();
                createWidget();
            }
        }
    };

    // Process queued calls
    queue.forEach(args => window["AltDeskWidget"].apply(null, args));
})();
