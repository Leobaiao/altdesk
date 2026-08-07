/**
 * AltDesk Chat Widget (Standalone)
 *
 * Como usar:
 * <script src="https://api.altdesk.com.br/altdesk-widget.js"
 *         data-tenant="SEU_TENANT_ID"
 *         data-backend="https://api.altdesk.com.br"></script>
 */

(function () {
    // 1. Encontrar o próprio script para ler os atributos
    const scripts = document.getElementsByTagName('script');
    let currentScript = null;
    
    for (let i = 0; i < scripts.length; i++) {
        if (scripts[i].src && scripts[i].src.includes('altdesk-widget.js')) {
            currentScript = scripts[i];
            break;
        }
    }

    if (!currentScript) {
        console.error("[AltDesk Widget] Script tag not found. Make sure the filename is 'altdesk-widget.js'.");
        return;
    }

    const tenantId = currentScript.getAttribute('data-tenant');
    const backendUrl = currentScript.getAttribute('data-backend') || 'https://api.altdesk.com.br';

    if (!tenantId) {
        console.error("[AltDesk Widget] data-tenant attribute is missing.");
        return;
    }

    // 2. Estado Global do Widget
    let config = null;
    let isOpen = false;
    let isBusinessHours = true;
    let visitorId = localStorage.getItem(`altdesk_visitor_${tenantId}`);
    let socket = null;
    let messages = []; // [{ id, text, isUser }]
    let visitorInfo = null; // { name, email, phone } se preenchido no pré-chat
    
    if (!visitorId) {
        visitorId = 'v_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem(`altdesk_visitor_${tenantId}`, visitorId);
    }

    // Elementos do DOM
    let container, bubble, panel, messagesArea, inputField, sendBtn, preChatForm, unreadBadge;

    // 3. Inicialização e Busca de Configuração
    async function init() {
        try {
            // Busca configuração
            const res = await fetch(`${backendUrl}/api/public/widget/${tenantId}`);
            if (!res.ok) {
                console.warn("[AltDesk Widget] Widget indisponível ou inativo.");
                return;
            }
            const data = await res.json();
            config = data.configJson;

            // Busca horário comercial
            const bhRes = await fetch(`${backendUrl}/api/public/widget/${tenantId}/business-hours`);
            if (bhRes.ok) {
                const bhData = await bhRes.json();
                isBusinessHours = bhData.online;
            }

            // Injeta CSS e renderiza UI
            injectCSS();
            renderUI();
            
            // Auto-open
            if (config.autoOpen && config.gatilhoAbertura === 'time') {
                setTimeout(() => {
                    if (!isOpen) toggleWidget();
                }, (config.autoOpenDelaySegundos || 5) * 1000);
            }

            // Busca histórico e conecta socket (mas apenas após o widget estar renderizado)
            await loadHistory();
            connectSocket();

        } catch (err) {
            console.error("[AltDesk Widget] Falha ao inicializar:", err);
        }
    }

    // 4. Renderização da UI
    function renderUI() {
        // Container
        container = document.createElement('div');
        container.id = 'altdesk-widget-container';
        
        const isLeft = config.posicao === 'bottom-left';
        if (isLeft) {
            container.style.left = '20px';
        } else {
            container.style.right = '20px';
        }
        document.body.appendChild(container);

        // --- Drag Logic ---
        let currentTranslateX = 0;
        let currentTranslateY = 0;

        function makeDraggable(dragHandle) {
            let isDrag = false;
            let startX, startY;
            let initialTranslateX = 0;
            let initialTranslateY = 0;

            function startDrag(e) {
                if (e.target.closest('button')) return; // Ignore buttons like close
                
                isDrag = false;
                const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
                const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
                
                startX = clientX;
                startY = clientY;
                initialTranslateX = currentTranslateX;
                initialTranslateY = currentTranslateY;

                function onMove(moveEvent) {
                    const moveClientX = moveEvent.type === 'touchmove' ? moveEvent.touches[0].clientX : moveEvent.clientX;
                    const moveClientY = moveEvent.type === 'touchmove' ? moveEvent.touches[0].clientY : moveEvent.clientY;
                    
                    const dx = moveClientX - startX;
                    const dy = moveClientY - startY;
                    
                    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                        isDrag = true;
                        if (moveEvent.cancelable) moveEvent.preventDefault();
                        
                        currentTranslateX = initialTranslateX + dx;
                        currentTranslateY = initialTranslateY + dy;
                        container.style.transform = `translate(${currentTranslateX}px, ${currentTranslateY}px)`;
                    }
                }
                
                function onEnd() {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onEnd);
                    document.removeEventListener('touchmove', onMove);
                    document.removeEventListener('touchend', onEnd);
                }
                
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onEnd);
                document.addEventListener('touchmove', onMove, { passive: false });
                document.addEventListener('touchend', onEnd);
            }

            dragHandle.addEventListener('mousedown', startDrag);
            dragHandle.addEventListener('touchstart', startDrag, { passive: true });
            
            dragHandle.addEventListener('click', (e) => {
                if (isDrag) {
                    e.stopPropagation();
                    e.preventDefault();
                }
            }, true);
        }
        // --- Fim Drag Logic ---

        // Badge
        unreadBadge = document.createElement('div');
        unreadBadge.className = 'ad-badge';
        unreadBadge.style.display = 'none';
        unreadBadge.innerText = '1';

        // Bubble (Launcher)
        bubble = document.createElement('div');
        bubble.className = `ad-bubble ad-format-${config.launcherFormato || 'circle'}`;
        bubble.style.backgroundColor = config.corPrimaria || '#6C63FF';
        
        // SVG do ícone de chat
        bubble.innerHTML = `
            <svg viewBox="0 0 24 24" width="28" height="28" fill="#fff" class="ad-icon-open">
                <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"></path>
            </svg>
            <svg viewBox="0 0 24 24" width="28" height="28" fill="#fff" class="ad-icon-close" style="display:none;">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path>
            </svg>
        `;
        bubble.appendChild(unreadBadge);
        bubble.onclick = toggleWidget;
        makeDraggable(bubble);
        container.appendChild(bubble);

        // Painel Principal
        panel = document.createElement('div');
        panel.className = 'ad-panel';
        if (config.tema === 'dark') panel.classList.add('ad-dark');
        
        const isDark = config.tema === 'dark';
        const bgColor = isDark ? '#1A1A2E' : (config.corFundo || '#FFFFFF');
        const textColor = isDark ? '#E0E0E0' : (config.corTexto || '#1A1A2E');
        
        panel.style.backgroundColor = bgColor;
        if (isLeft) {
            panel.style.transformOrigin = 'bottom left';
            panel.classList.add('ad-pos-left');
        } else {
            panel.style.transformOrigin = 'bottom right';
            panel.classList.add('ad-pos-right');
        }

        // Header
        const header = document.createElement('div');
        header.className = 'ad-header';
        header.style.backgroundColor = config.corPrimaria || '#6C63FF';
        
        let avatarHTML = config.avatarUrl 
            ? `<img src="${config.avatarUrl}" alt="Avatar" class="ad-avatar" />`
            : `<div class="ad-avatar ad-avatar-fallback">💬</div>`;

        header.innerHTML = `
            <div class="ad-header-content">
                ${avatarHTML}
                <div class="ad-header-text">
                    <div class="ad-title">Fale Conosco</div>
                    <div class="ad-subtitle">
                        <span class="ad-status-dot"></span>
                        ${isBusinessHours ? 'Online agora' : 'Offline (Deixe sua mensagem)'}
                    </div>
                </div>
            </div>
            <button class="ad-close-btn" aria-label="Fechar">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg>
            </button>
        `;
        header.querySelector('.ad-close-btn').onclick = toggleWidget;
        header.style.cursor = 'move';
        makeDraggable(header);

        // Área de Mensagens
        messagesArea = document.createElement('div');
        messagesArea.className = 'ad-messages';
        
        // Consentimento LGPD
        if (config.textoConsentimentoLgpd) {
            const lgpd = document.createElement('div');
            lgpd.className = 'ad-lgpd';
            lgpd.innerText = '🔒 ' + config.textoConsentimentoLgpd;
            messagesArea.appendChild(lgpd);
        }

        // Mensagem de Boas vindas ou Fora de horário
        const initialMsgText = isBusinessHours 
            ? (config.mensagemBoasVindas || 'Olá! Como podemos ajudar?')
            : (config.mensagemForaHorario || 'Deixe sua mensagem e retornaremos em breve.');
            
        appendMessage(initialMsgText, false);

        // Formulário Pré-Chat
        const hasPreChat = config.exigirNome || config.exigirEmail || config.exigirTelefone;
        if (hasPreChat && !localStorage.getItem(`altdesk_info_${tenantId}`)) {
            preChatForm = document.createElement('form');
            preChatForm.className = 'ad-prechat';
            preChatForm.innerHTML = `<div class="ad-prechat-title">Antes de conversar, precisamos de:</div>`;
            
            if (config.exigirNome) {
                preChatForm.innerHTML += `<input type="text" id="ad-pc-name" placeholder="Seu nome" required />`;
            }
            if (config.exigirEmail) {
                preChatForm.innerHTML += `<input type="email" id="ad-pc-email" placeholder="Seu email" required />`;
            }
            if (config.exigirTelefone) {
                preChatForm.innerHTML += `<input type="tel" id="ad-pc-phone" placeholder="Seu telefone" required />`;
            }
            preChatForm.innerHTML += `<button type="submit" style="background-color:${config.corPrimaria || '#6C63FF'}">Iniciar conversa</button>`;
            
            preChatForm.onsubmit = (e) => {
                e.preventDefault();
                visitorInfo = {
                    name: document.getElementById('ad-pc-name')?.value || '',
                    email: document.getElementById('ad-pc-email')?.value || '',
                    phone: document.getElementById('ad-pc-phone')?.value || ''
                };
                localStorage.setItem(`altdesk_info_${tenantId}`, JSON.stringify(visitorInfo));
                preChatForm.style.display = 'none';
                enableInput();
            };
            
            messagesArea.appendChild(preChatForm);
        } else {
            visitorInfo = JSON.parse(localStorage.getItem(`altdesk_info_${tenantId}`) || 'null');
        }

        // Input Area
        const inputArea = document.createElement('form');
        inputArea.className = 'ad-input-area';
        inputArea.onsubmit = handleSend;
        
        inputArea.innerHTML = `
            <input type="text" id="ad-input" placeholder="Digite sua mensagem..." autocomplete="off" ${hasPreChat && !visitorInfo ? 'disabled' : ''} />
            <button type="submit" id="ad-send" style="background-color:${config.corPrimaria || '#6C63FF'}" ${hasPreChat && !visitorInfo ? 'disabled' : ''}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
            </button>
        `;
        
        inputField = inputArea.querySelector('#ad-input');
        sendBtn = inputArea.querySelector('#ad-send');

        panel.appendChild(header);
        panel.appendChild(messagesArea);
        panel.appendChild(inputArea);
        container.appendChild(panel);
    }

    // 5. Funções de Interação
    function toggleWidget() {
        isOpen = !isOpen;
        if (isOpen) {
            panel.classList.add('ad-open');
            bubble.querySelector('.ad-icon-open').style.display = 'none';
            bubble.querySelector('.ad-icon-close').style.display = 'block';
            unreadBadge.style.display = 'none';
            if (config.animacoesAtivas ?? true) {
                bubble.style.transform = 'scale(0.9)';
                setTimeout(() => bubble.style.transform = 'scale(1)', 150);
            }
            inputField?.focus();
            scrollToBottom();
        } else {
            panel.classList.remove('ad-open');
            bubble.querySelector('.ad-icon-open').style.display = 'block';
            bubble.querySelector('.ad-icon-close').style.display = 'none';
        }
    }

    function enableInput() {
        if (inputField) inputField.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
        inputField?.focus();
    }

    function appendMessage(text, isUser) {
        // Verifica se a mensagem já existe para não duplicar (baseado em id falso para histórico, mas serve)
        const msgDiv = document.createElement('div');
        msgDiv.className = `ad-msg ${isUser ? 'ad-msg-user' : 'ad-msg-agent'}`;
        if (isUser) {
            msgDiv.style.backgroundColor = config.corPrimaria || '#6C63FF';
            msgDiv.style.color = '#fff';
        } else {
            msgDiv.style.color = config.tema === 'dark' ? '#E0E0E0' : (config.corTexto || '#1A1A2E');
            msgDiv.style.backgroundColor = config.tema === 'dark' ? 'rgba(255,255,255,0.06)' : '#F5F6FA';
        }
        
        // Escape básico de HTML
        msgDiv.innerText = text;
        messagesArea.appendChild(msgDiv);
        scrollToBottom();
    }

    function scrollToBottom() {
        if (messagesArea) {
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }
    }

    function playSound() {
        if (config.somNotificacao ?? true) {
            try {
                // Tenta tocar um beep simples
                const audio = new Audio('data:audio/mp3;base64,//OEXAA... (aqui ficaria um beep base64 curto, simplificando com Oscillator)');
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.value = 880;
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
                osc.start();
                osc.stop(ctx.currentTime + 0.1);
            } catch (e) {}
        }
    }

    // 6. Envio de Mensagem e Socket
    async function handleSend(e) {
        e.preventDefault();
        const text = inputField.value.trim();
        if (!text) return;
        
        inputField.value = '';
        appendMessage(text, true);

        // Se o socket estiver conectado, envia via socket. Se não, via HTTP.
        if (socket && socket.connected) {
            socket.emit("webchat:message", { text, visitorInfo });
        } else {
            try {
                await fetch(`${backendUrl}/api/public/widget/${tenantId}/message`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ visitorId, text, visitorInfo })
                });
            } catch (err) {
                console.error("[AltDesk Widget] Erro ao enviar:", err);
            }
        }
    }

    async function loadHistory() {
        try {
            const res = await fetch(`${backendUrl}/api/public/widget/${tenantId}/history/${visitorId}`);
            if (res.ok) {
                const data = await res.json();
                data.messages.forEach(m => {
                    appendMessage(m.body, m.direction === 'IN');
                });
            }
        } catch (err) {
            console.error("[AltDesk Widget] Erro ao carregar histórico:", err);
        }
    }

    function connectSocket() {
        // Carrega Socket.IO dinamicamente se não existir
        if (typeof io === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
            script.onload = initSocket;
            document.head.appendChild(script);
        } else {
            initSocket();
        }
    }

    function initSocket() {
        socket = io(`${backendUrl}/widget`, {
            auth: { tenantId, visitorId },
            transports: ['websocket', 'polling']
        });

        socket.on("connect", () => {
            console.log("[AltDesk Widget] Conectado em tempo real.");
        });

        socket.on("message:new", (data) => {
            // Só exibe se for mensagem do agente (OUT)
            const dir = data.direction || data.Direction || (data.message && data.message.Direction);
            if (dir === 'OUT') {
                const body = data.text || data.Body || (data.message && data.message.Body);
                if (body) {
                    appendMessage(body, false);
                }
                if (!isOpen) {
                    if (config.badgeAtivo ?? true) unreadBadge.style.display = 'flex';
                    playSound();
                }
            }
        });
    }

    // 7. Estilos (Injetados dinamicamente)
    function injectCSS() {
        const font = config.fonte || 'Inter';
        const style = document.createElement('style');
        style.innerHTML = `
            #altdesk-widget-container {
                position: fixed;
                bottom: 0;
                z-index: 999999;
                font-family: '${font}', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            #altdesk-widget-container * {
                box-sizing: border-box;
            }
            
            /* Bubble */
            .ad-bubble {
                position: absolute;
                bottom: 20px;
                right: 0; /* Controlado via JS */
                width: 60px;
                height: 60px;
                border-radius: 50%;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
            .ad-bubble:hover {
                transform: scale(1.05);
            }
            .ad-format-pill {
                width: auto;
                padding: 0 20px;
                border-radius: 30px;
            }
            .ad-format-square {
                border-radius: 16px;
            }
            
            /* Badge */
            .ad-badge {
                position: absolute;
                top: -5px;
                right: -5px;
                background: #FF3B30;
                color: #fff;
                font-size: 11px;
                font-weight: bold;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 2px solid #fff;
            }

            /* Panel */
            .ad-panel {
                position: absolute;
                bottom: 90px;
                width: 360px;
                height: 600px;
                max-height: calc(100vh - 120px);
                border-radius: 16px;
                box-shadow: 0 12px 40px rgba(0,0,0,0.15);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                opacity: 0;
                pointer-events: none;
                transform: scale(0.95);
                transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                border: 1px solid rgba(0,0,0,0.08);
            }
            .ad-pos-left { left: 0; }
            .ad-pos-right { right: 0; }
            
            .ad-panel.ad-open {
                opacity: 1;
                pointer-events: all;
                transform: scale(1);
            }
            
            @media (max-width: 480px) {
                .ad-panel {
                    position: fixed;
                    top: 0 !important;
                    bottom: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    width: 100% !important;
                    height: 100% !important;
                    max-height: 100vh !important;
                    border-radius: 0;
                    transform: translateY(20px);
                }
                .ad-panel.ad-open {
                    transform: translateY(0);
                }
            }

            /* Header */
            .ad-header {
                padding: 16px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                color: #fff;
            }
            .ad-header-content {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .ad-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                object-fit: cover;
                border: 2px solid rgba(255,255,255,0.3);
            }
            .ad-avatar-fallback {
                background: rgba(255,255,255,0.2);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
            }
            .ad-title {
                font-weight: 700;
                font-size: 15px;
            }
            .ad-subtitle {
                font-size: 12px;
                opacity: 0.8;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .ad-status-dot {
                width: 6px;
                height: 6px;
                background: #4ADE80;
                border-radius: 50%;
                display: inline-block;
            }
            .ad-close-btn {
                background: none;
                border: none;
                cursor: pointer;
                padding: 4px;
                opacity: 0.8;
                transition: opacity 0.2s;
            }
            .ad-close-btn:hover {
                opacity: 1;
            }

            /* Messages Area */
            .ad-messages {
                flex: 1;
                padding: 20px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            .ad-msg {
                max-width: 85%;
                padding: 12px 16px;
                font-size: 14px;
                line-height: 1.4;
                word-break: break-word;
            }
            .ad-msg-agent {
                align-self: flex-start;
                border-radius: 16px 16px 16px 4px;
            }
            .ad-msg-user {
                align-self: flex-end;
                border-radius: 16px 16px 4px 16px;
            }
            
            .ad-lgpd {
                font-size: 11px;
                text-align: center;
                margin-bottom: 10px;
            }

            /* Pre-chat form */
            .ad-prechat {
                display: flex;
                flex-direction: column;
                gap: 10px;
                padding: 16px;
                border-radius: 12px;
                border: 1px solid;
            }
            .ad-prechat-title {
                font-size: 13px;
                font-weight: 600;
                margin-bottom: 4px;
            }
            .ad-prechat input {
                padding: 10px 12px;
                border-radius: 8px;
                border: 1px solid;
                font-size: 13px;
                font-family: inherit;
            }
            .ad-prechat button {
                padding: 12px;
                border-radius: 8px;
                border: none;
                color: #fff;
                font-weight: 600;
                cursor: pointer;
                font-size: 13px;
                margin-top: 4px;
            }

            /* Input Area */
            .ad-input-area {
                padding: 12px;
                display: flex;
                gap: 8px;
                border-top: 1px solid rgba(0,0,0,0.08);
            }
            #ad-input {
                flex: 1;
                padding: 12px 16px;
                border-radius: 20px;
                border: 1px solid;
                font-size: 14px;
                font-family: inherit;
                outline: none;
                transition: border-color 0.2s;
            }
            #ad-send {
                width: 44px;
                height: 44px;
                border-radius: 50%;
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            #ad-send:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            /* Dark mode adjustents */
            .ad-dark .ad-messages {
                background-color: #1A1A2E;
            }
            .ad-dark .ad-input-area {
                border-top-color: rgba(255,255,255,0.1);
            }
            .ad-dark #ad-input {
                background: rgba(255,255,255,0.06);
                border-color: transparent;
                color: #E0E0E0;
            }
            .ad-dark #ad-input:focus {
                border-color: rgba(255,255,255,0.2);
            }
            .ad-dark .ad-lgpd {
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.1);
                color: #999;
                padding: 10px;
                border-radius: 8px;
            }
            .ad-dark .ad-prechat {
                background: rgba(255,255,255,0.03);
                border-color: rgba(255,255,255,0.1);
            }
            .ad-dark .ad-prechat-title { color: #E0E0E0; }
            .ad-dark .ad-prechat input {
                background: rgba(255,255,255,0.06);
                border-color: transparent;
                color: #E0E0E0;
            }
            
            /* Light mode explicit */
            .ad-panel:not(.ad-dark) #ad-input {
                background: #F5F6FA;
                border-color: transparent;
            }
            .ad-panel:not(.ad-dark) #ad-input:focus {
                border-color: rgba(0,0,0,0.15);
            }
            .ad-panel:not(.ad-dark) .ad-prechat {
                background: #F5F6FA;
                border-color: rgba(0,0,0,0.05);
            }
            .ad-panel:not(.ad-dark) .ad-prechat input {
                background: #fff;
                border-color: rgba(0,0,0,0.1);
            }
            .ad-panel:not(.ad-dark) .ad-lgpd {
                background: rgba(0,0,0,0.02);
                border: 1px solid rgba(0,0,0,0.05);
                color: #666;
                padding: 10px;
                border-radius: 8px;
            }
        `;
        document.head.appendChild(style);

        // Load custom font if needed
        if (font !== 'Inter') {
            const fontLink = document.createElement('link');
            fontLink.rel = 'stylesheet';
            fontLink.href = `https://fonts.googleapis.com/css2?family=${font.replace(' ', '+')}:wght@400;500;600;700&display=swap`;
            document.head.appendChild(fontLink);
        }
    }

    // Start
    init();
})();
