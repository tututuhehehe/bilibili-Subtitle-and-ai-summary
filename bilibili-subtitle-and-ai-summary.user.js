// ==UserScript==
// @name         B站字幕获取与AI助手 (沉浸式翻译/总结)
// @namespace    https://github.com/tututuhehehe/bilibili-Subtitle-and-ai-summary
// @version      1.0.0  
// @author       李沐恩
// @description  一键获取B站视频字幕，支持沉浸式AI对话、双模型切换、侧边栏收起、自定义总结Prompt
// @match        *://*.bilibili.com/video/*
// @match        *://*.bilibili.com/bangumi/play/*
// @icon         https://www.bilibili.com/favicon.ico
// @require      https://cdn.jsdelivr.net/npm/marked/marked.min.js
// @grant        unsafeWindow
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      *
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    const startTime = performance.now();
    const version = '3.7.0';

    // 配置数据
    let aiConfig = {
        endpoint: GM_getValue('ai_endpoint', 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'),
        apiKey: GM_getValue('ai_api_key', ''),
        model1: GM_getValue('ai_model1', 'qwen-plus'),
        model2: GM_getValue('ai_model2', 'qwen-turbo'),
        prompt: GM_getValue('ai_custom_prompt', '请根据以下视频字幕，提取出核心观点，并用结构化的 Markdown 格式（如标题、列表、加粗重点，必要时可以使用表格）进行详细总结。')
    };

    // 状态数据
    let currentSubtitle = "";
    let chatHistory = []; 
    let isRequesting = false; 

    function addGlobalStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .bilibili-subtitle-infobar {
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                background-color: rgba(25, 26, 27, 0.98); border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 8px; padding: 12px 20px; color: white; font-size: 14px; font-weight: bold;
                z-index: 2147483647; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8); backdrop-filter: blur(10px);
                text-align: center; transition: all 0.3s ease;
            }
            .bilibili-subtitle-infobar.info { border-left: 4px solid #00a1d6; }
            .bilibili-subtitle-infobar.success { border-left: 4px solid #52c41a; }
            .bilibili-subtitle-infobar.error { border-left: 4px solid #f5222d; }
            
            #bili-ai-minimized {
                position: fixed; right: 0; top: 100px; width: 40px; height: 100px;
                background-color: #1e1e20; border: 1px solid #333; border-right: none; border-radius: 12px 0 0 12px;
                box-shadow: -5px 5px 15px rgba(0,0,0,0.5); z-index: 2147483646; display: none;
                flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;
            }
            #bili-ai-minimized:hover { background-color: #2a2a2b; width: 45px; }
            #bili-ai-minimized span { color: #00a1d6; font-size: 14px; font-weight: bold; writing-mode: vertical-rl; letter-spacing: 2px; }

            #bili-ai-panel {
                position: fixed; right: 20px; top: 80px; width: 420px; height: 680px;
                background-color: #1e1e20; border: 1px solid #333; border-radius: 12px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.6); z-index: 2147483646; display: none;
                flex-direction: column; color: #eee; font-family: sans-serif;
            }
            .ai-panel-header {
                display: flex; justify-content: space-between; align-items: center;
                padding: 10px 16px; border-bottom: 1px solid #333; background: #252528; border-radius: 12px 12px 0 0;
            }
            .ai-panel-header-left { display: flex; align-items: center; gap: 8px; }
            .ai-panel-title { font-size: 15px; font-weight: bold; color: #00a1d6; }
            .ai-model-select { background: #1e1e20; color: #ccc; border: 1px solid #444; border-radius: 4px; padding: 2px 6px; font-size: 12px; outline: none; cursor: pointer;}
            .ai-refresh-btn { cursor: pointer; color: #00a1d6; font-size: 14px; transition: transform 0.3s; }
            .ai-refresh-btn:hover { transform: rotate(180deg); }
            
            .ai-panel-header-actions { display: flex; align-items: center; gap: 12px; }
            .ai-icon-btn { cursor: pointer; color: #999; font-size: 16px; transition: color 0.2s; }
            .ai-icon-btn:hover { color: #fff; }
            
            .ai-panel-chat { flex: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
            .chat-bubble { max-width: 92%; padding: 10px 14px; border-radius: 8px; font-size: 14px; line-height: 1.6; word-wrap: break-word; overflow-x: auto; }
            .chat-bubble.user { background: #00a1d6; color: white; align-self: flex-end; border-bottom-right-radius: 2px; }
            .chat-bubble.assistant { background: #2a2a2b; color: #d1d5db; align-self: flex-start; border-bottom-left-radius: 2px; border: 1px solid #333;}
            .chat-bubble.system { background: transparent; color: #888; align-self: center; font-size: 12px; text-align: center; }
            
            /* Markdown 样式适配 */
            .chat-bubble.assistant h1, .chat-bubble.assistant h2, .chat-bubble.assistant h3 { color: #fff; margin-top: 0; margin-bottom: 8px; font-size: 15px; }
            .chat-bubble.assistant p { margin: 0 0 8px 0; }
            .chat-bubble.assistant p:last-child { margin: 0; }
            .chat-bubble.assistant ul, .chat-bubble.assistant ol { margin: 0 0 8px 0; padding-left: 20px; }
            .chat-bubble.assistant strong { color: #50E3C2; }
            .chat-bubble.assistant code { background: #1e1e20; padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 13px; }
            .chat-bubble.assistant pre { background: #1a1a1b; padding: 10px; border-radius: 6px; overflow-x: auto; border: 1px solid #111; margin: 8px 0;}
            
            /* 表格渲染样式 */
            .chat-bubble.assistant table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 13px; color: #eee; }
            .chat-bubble.assistant th, .chat-bubble.assistant td { border: 1px solid #444; padding: 6px 10px; text-align: left; }
            .chat-bubble.assistant th { background-color: #1a1a1b; color: #00a1d6; font-weight: bold; }
            .chat-bubble.assistant tr:nth-child(even) { background-color: rgba(255, 255, 255, 0.03); }
            
            .ai-panel-input-area { padding: 12px; border-top: 1px solid #333; background: #252528; display: flex; gap: 8px; border-radius: 0 0 12px 12px;}
            .ai-chat-textarea { flex: 1; height: 36px; min-height: 36px; max-height: 100px; background: #1e1e20; border: 1px solid #444; color: white; border-radius: 6px; padding: 8px; font-size: 13px; resize: none; outline: none; font-family: inherit;}
            .ai-chat-send { background: #00a1d6; color: white; border: none; padding: 0 16px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: background 0.2s;}
            .ai-chat-send:hover { background: #0088b5; }
            .ai-chat-send:disabled { background: #444; color: #888; cursor: not-allowed; }

            .ai-panel-settings { position: absolute; bottom: 61px; left: 0; right: 0; padding: 16px; border-top: 1px solid #333; font-size: 12px; background: rgba(37, 37, 40, 0.95); backdrop-filter: blur(10px); display: none; z-index: 10; border-radius: 0 0 12px 12px;}
            .ai-input { width: 100%; box-sizing: border-box; margin-top: 4px; margin-bottom: 8px; padding: 6px; background: #1e1e20; border: 1px solid #444; color: white; border-radius: 4px; font-family: inherit;}
            .ai-settings-row { display: flex; gap: 8px; }
        `;
        document.head.appendChild(style);
    }

    function showInfoBar(m,t='info',d=3000){const e=document.querySelector('.bilibili-subtitle-infobar');if(e)e.remove();const i=document.createElement('div');i.className=`bilibili-subtitle-infobar ${t}`;i.textContent=m;document.body.appendChild(i);if(d>0){setTimeout(()=>{if(i.parentNode){i.style.opacity='0';i.style.transform='translate(-50%, -50%) scale(0.9)';setTimeout(()=>i.remove(),300);}},d);}return i;}
    function setupNetworkInterception(){const s=document.createElement('script');s.textContent=`(function(){window._biliSubtitleUrls=window._biliSubtitleUrls||[];const o=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){if(typeof u==='string'&&(u.includes('subtitle')||u.includes('ai_subtitle')))window._biliSubtitleUrls.push(u);return o.apply(this,arguments);};const f=window.fetch;window.fetch=function(u,op){let r=typeof u==='string'?u:(u&&u.url?u.url:'');if(r&&(r.includes('subtitle')||r.includes('ai_subtitle')))window._biliSubtitleUrls.push(r);return f.apply(this,arguments);};})();`;(document.head||document.documentElement).appendChild(s);s.remove();}
    function getSubtitleUrls(){const r=[];document.querySelectorAll('script').forEach(s=>{const c=s.textContent;if(!c)return;const u=c.match(/https?:\/\/[^\s"]*subtitle\/[^\s"]*\.json\?auth_key=[^\s"]*/g);if(u)r.push(...u);const a=c.match(/https?:\/\/[^\s"]*ai_subtitle\/[^\s"]*\?auth_key=[^\s"]*/g);if(a)r.push(...a);});if(typeof unsafeWindow!=='undefined'&&unsafeWindow._biliSubtitleUrls)r.push(...unsafeWindow._biliSubtitleUrls);else if(window._biliSubtitleUrls)r.push(...window._biliSubtitleUrls);return[...new Set(r)].filter(url=>url&&(url.includes('subtitle')||url.includes('ai_subtitle'))&&url.includes('auth_key'));}
    function getSubtitleBody(d){if(d&&d.body)return d.body;if(d&&d.data&&d.data.body)return d.data.body;throw new Error('无法解析字幕数据');}
    function fetchSubtitleText(){return new Promise((res,rej)=>{const u=getSubtitleUrls();if(u.length===0)return rej(new Error('未找到字幕'));let url=u[0];if(url.startsWith('//'))url='https:'+url;window.fetch(url).then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();}).then(d=>res(getSubtitleBody(d).map(i=>i.content).join('\n'))).catch(rej);});}
    function handleCopySubtitle(){showInfoBar('正在提取...','info',0);fetchSubtitleText().then(t=>{document.querySelector('.bilibili-subtitle-infobar.info')?.remove();GM_setClipboard(t,'text');showInfoBar('✅ 已复制！','success',2500);}).catch(e=>{document.querySelector('.bilibili-subtitle-infobar.info')?.remove();showInfoBar('提取失败: '+e.message,'error');});}

    function requestAIStream(messages, onChunk, onComplete, onError) {
        if (!aiConfig.apiKey) {
            onError("请先点击右上角⚙️图标配置 API Key");
            return;
        }
        
        const selectedModel = document.getElementById('ai-model-select').value;
        isRequesting = true;
        document.getElementById('ai-chat-send').disabled = true;

        GM_xmlhttpRequest({
            method: "POST",
            url: aiConfig.endpoint,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${aiConfig.apiKey}`,
                "Accept": "text/event-stream"
            },
            data: JSON.stringify({
                model: selectedModel,
                messages: messages,
                stream: true
            }),
            responseType: 'stream',
            onloadstart: async function(response) {
                try {
                    const reader = response.response.getReader();
                    const decoder = new TextDecoder('utf-8');
                    let buffer = '';
                    let fullText = '';

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        let lines = buffer.split('\n');
                        buffer = lines.pop(); 

                        for (let line of lines) {
                            line = line.trim();
                            if (line.startsWith('data: ')) {
                                const dataStr = line.substring(6);
                                if (dataStr === '[DONE]') continue;
                                try {
                                    const data = JSON.parse(dataStr);
                                    if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                                        const chunk = data.choices[0].delta.content;
                                        fullText += chunk;
                                        onChunk(fullText);
                                    }
                                } catch (e) {}
                            }
                        }
                    }
                    isRequesting = false;
                    document.getElementById('ai-chat-send').disabled = false;
                    onComplete(fullText);
                } catch (err) {
                    isRequesting = false;
                    document.getElementById('ai-chat-send').disabled = false;
                    onError("流读取中断");
                }
            },
            onerror: function(err) {
                isRequesting = false;
                document.getElementById('ai-chat-send').disabled = false;
                onError("网络请求失败，请检查配置或网络");
            }
        });
    }

    function appendChatBubble(role, contentHTML) {
        const chatContainer = document.getElementById('ai-panel-chat');
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${role}`;
        bubble.innerHTML = contentHTML;
        chatContainer.appendChild(bubble);
        
        if (role !== 'assistant') {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        return bubble;
    }

    function triggerSummary(plainText) {
        const chatContainer = document.getElementById('ai-panel-chat');
        chatContainer.innerHTML = ''; 
        chatHistory = []; 
        
        const systemPrompt = "你是一个得力的视频内容总结与问答助手。请直接输出 Markdown 格式的排版内容。";
        // 使用用户自定义的 Prompt
        const userPrompt = `${aiConfig.prompt}\n\n字幕内容：\n${plainText}`;
        
        chatHistory.push({ role: "system", content: systemPrompt });
        chatHistory.push({ role: "user", content: userPrompt });

        appendChatBubble('system', '正在阅读视频字幕并生成总结...');
        const assistantBubble = appendChatBubble('assistant', '<span style="color:#888;">AI 思考中...</span>');

        requestAIStream(
            chatHistory,
            (currentText) => {
                assistantBubble.innerHTML = marked.parse(currentText);
            },
            (fullText) => {
                chatHistory.push({ role: "assistant", content: fullText });
                document.getElementById('ai-panel-chat').querySelector('.system').textContent = '总结完成，您可以继续提问👇';
            },
            (errMsg) => {
                assistantBubble.innerHTML = `<span style="color:#f5222d;">❌ ${errMsg}</span>`;
            }
        );
    }

    function handleSendChat() {
        if (isRequesting) return;
        const inputEl = document.getElementById('ai-chat-textarea');
        const text = inputEl.value.trim();
        if (!text) return;

        inputEl.value = '';
        inputEl.style.height = '36px'; 
        appendChatBubble('user', text);
        
        chatHistory.push({ role: "user", content: text });
        const assistantBubble = appendChatBubble('assistant', '<span style="color:#888;">思考中...</span>');
        
        const chatContainer = document.getElementById('ai-panel-chat');
        chatContainer.scrollTop = chatContainer.scrollHeight;

        requestAIStream(
            chatHistory,
            (currentText) => { assistantBubble.innerHTML = marked.parse(currentText); },
            (fullText) => { chatHistory.push({ role: "assistant", content: fullText }); },
            (errMsg) => { assistantBubble.innerHTML = `<span style="color:#f5222d;">❌ ${errMsg}</span>`; }
        );
    }

    function handleAISummaryBtn() {
        createAIPanel();
        const panel = document.getElementById('bili-ai-panel');
        const minTab = document.getElementById('bili-ai-minimized');
        
        panel.style.display = 'flex';
        minTab.style.display = 'none';

        if (chatHistory.length > 0) return;

        const chatContainer = document.getElementById('ai-panel-chat');
        if (!aiConfig.apiKey) {
            chatContainer.innerHTML = '<div class="chat-bubble system" style="color:#ffcc00">⚠️ 请先点击右上角 ⚙️ 配置您的 API Key。</div>';
            document.getElementById('ai-panel-settings-container').style.display = 'block';
            return;
        }

        chatContainer.innerHTML = '<div class="chat-bubble system">获取字幕中...</div>';

        fetchSubtitleText().then(plainText => {
            currentSubtitle = plainText; 
            triggerSummary(plainText);
        }).catch(err => {
            chatContainer.innerHTML = `<div class="chat-bubble system" style="color:#f5222d;">❌ 提取字幕失败: ${err.message}</div>`;
        });
    }

    function createAIPanel() {
        if (document.getElementById('bili-ai-panel')) return;

        const minTab = document.createElement('div');
        minTab.id = 'bili-ai-minimized';
        minTab.innerHTML = `<span>✨AI助手</span>`;
        document.body.appendChild(minTab);

        minTab.addEventListener('click', () => {
            document.getElementById('bili-ai-panel').style.display = 'flex';
            minTab.style.display = 'none';
        });

        const panel = document.createElement('div');
        panel.id = 'bili-ai-panel';
        panel.innerHTML = `
            <div class="ai-panel-header">
                <div class="ai-panel-header-left">
                    <span class="ai-panel-title">✨ AI</span>
                    <select id="ai-model-select" class="ai-model-select" title="切换模型">
                        <option value="${aiConfig.model1}">${aiConfig.model1} (主)</option>
                        ${aiConfig.model2 ? `<option value="${aiConfig.model2}">${aiConfig.model2} (备)</option>` : ''}
                    </select>
                    <span class="ai-refresh-btn" id="ai-refresh-btn" title="重新总结">🔄</span>
                </div>
                <div class="ai-panel-header-actions">
                    <span class="ai-icon-btn" id="ai-setting-toggle" title="设置">⚙️</span>
                    <span class="ai-icon-btn" id="ai-minimize-btn" title="收起到侧边">➖</span>
                    <span class="ai-icon-btn" id="ai-panel-close" title="彻底关闭">✖</span>
                </div>
            </div>
            
            <div class="ai-panel-chat" id="ai-panel-chat">
                <div class="chat-bubble system">准备就绪。</div>
            </div>
            
            <div class="ai-panel-settings" id="ai-panel-settings-container">
                <div style="margin-bottom: 4px; color: #999;">API 配置 (保存在本地):</div>
                <input type="text" id="set-endpoint" class="ai-input" value="${aiConfig.endpoint}" placeholder="API Endpoint">
                <input type="password" id="set-apikey" class="ai-input" value="${aiConfig.apiKey}" placeholder="API Key (sk-...)">
                <div class="ai-settings-row">
                    <input type="text" id="set-model1" class="ai-input" value="${aiConfig.model1}" placeholder="主模型">
                    <input type="text" id="set-model2" class="ai-input" value="${aiConfig.model2}" placeholder="备用模型">
                </div>
                <div style="margin: 6px 0 4px 0; color: #999;">自定义总结 Prompt:</div>
                <textarea id="set-prompt" class="ai-input" style="height: 54px; resize: vertical;" placeholder="要求 AI 如何进行总结...">${aiConfig.prompt}</textarea>
                <button class="ai-chat-send" id="ai-save-btn" style="width:100%; margin-top:4px;">保存配置</button>
            </div>

            <div class="ai-panel-input-area">
                <textarea id="ai-chat-textarea" class="ai-chat-textarea" placeholder="向 AI 提问关于视频的内容..."></textarea>
                <button id="ai-chat-send" class="ai-chat-send">发送</button>
            </div>
        `;
        document.body.appendChild(panel);

        document.getElementById('ai-panel-close').addEventListener('click', () => {
            panel.style.display = 'none';
        });
        document.getElementById('ai-minimize-btn').addEventListener('click', () => {
            panel.style.display = 'none';
            minTab.style.display = 'flex';
        });

        document.getElementById('ai-refresh-btn').addEventListener('click', () => {
            if (!currentSubtitle) return;
            triggerSummary(currentSubtitle);
        });

        document.getElementById('ai-setting-toggle').addEventListener('click', () => {
            const box = document.getElementById('ai-panel-settings-container');
            box.style.display = box.style.display === 'none' ? 'block' : 'none';
        });

        document.getElementById('ai-save-btn').addEventListener('click', () => {
            aiConfig.endpoint = document.getElementById('set-endpoint').value;
            aiConfig.apiKey = document.getElementById('set-apikey').value;
            aiConfig.model1 = document.getElementById('set-model1').value;
            aiConfig.model2 = document.getElementById('set-model2').value;
            aiConfig.prompt = document.getElementById('set-prompt').value;
            
            GM_setValue('ai_endpoint', aiConfig.endpoint);
            GM_setValue('ai_api_key', aiConfig.apiKey);
            GM_setValue('ai_model1', aiConfig.model1);
            GM_setValue('ai_model2', aiConfig.model2);
            GM_setValue('ai_custom_prompt', aiConfig.prompt);
            
            const select = document.getElementById('ai-model-select');
            select.innerHTML = `<option value="${aiConfig.model1}">${aiConfig.model1} (主)</option>`;
            if (aiConfig.model2) {
                select.innerHTML += `<option value="${aiConfig.model2}">${aiConfig.model2} (备)</option>`;
            }
            
            const btn = document.getElementById('ai-save-btn');
            btn.textContent = '已保存！';
            btn.style.background = '#52c41a';
            setTimeout(() => {
                btn.textContent = '保存配置';
                btn.style.background = '#00a1d6';
                document.getElementById('ai-panel-settings-container').style.display = 'none';
            }, 1000);
        });

        document.getElementById('ai-chat-send').addEventListener('click', handleSendChat);
        document.getElementById('ai-chat-textarea').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault(); 
                handleSendChat();
            }
        });
        
        const textarea = document.getElementById('ai-chat-textarea');
        textarea.addEventListener('input', function() {
            this.style.height = '36px';
            this.style.height = (this.scrollHeight) + 'px';
        });
    }

    function createDownloadInterface(subtitlePanel) {
        function addButtons() {
            const subtitleItems = document.querySelectorAll('.bpx-player-ctrl-subtitle-language-item');
            if (subtitleItems.length === 0) return;

            subtitleItems.forEach(item => {
                if (item.querySelector('.bilibili-subtitle-actions')) return;

                const actionsContainer = document.createElement('div');
                actionsContainer.className = 'bilibili-subtitle-actions';
                actionsContainer.style.cssText = 'display: inline-block; margin-left: 0.6em;';

                const btnStyle = `background: transparent; border: none; color: white; cursor: pointer; font-size: 0.85em; padding: 0.1em 0.3em; border-radius: 3px; transition: all 0.2s ease;`;

                // 核心改动：换位置 & 修改文案
                const aiBtn = document.createElement('button');
                aiBtn.textContent = '[总结]';
                aiBtn.style.cssText = btnStyle; // 总结在左边，不加左边距
                aiBtn.addEventListener('click', (e) => { e.stopPropagation(); handleAISummaryBtn(); });
                aiBtn.addEventListener('mouseenter', () => aiBtn.style.color = '#ff69b4');
                aiBtn.addEventListener('mouseleave', () => aiBtn.style.color = 'white');

                const copyBtn = document.createElement('button');
                copyBtn.textContent = '[复制]';
                copyBtn.style.cssText = btnStyle + 'margin-left: 4px;'; // 复制在右边，加上左边距隔开
                copyBtn.addEventListener('click', (e) => { e.stopPropagation(); handleCopySubtitle(); });
                copyBtn.addEventListener('mouseenter', () => copyBtn.style.color = '#00a1d6');
                copyBtn.addEventListener('mouseleave', () => copyBtn.style.color = 'white');

                actionsContainer.appendChild(aiBtn); // 先插入总结
                actionsContainer.appendChild(copyBtn); // 后插入复制
                item.appendChild(actionsContainer);
            });
        }

        addButtons();
        const observer = new MutationObserver(addButtons);
        observer.observe(subtitlePanel, { childList: true, subtree: true });
        setTimeout(() => observer.disconnect(), 15000);
    }

    function init() {
        addGlobalStyles();
        setupNetworkInterception();

        let timeoutId;
        const checkInterval = setInterval(() => {
            const subtitlePanel = document.querySelector('.bpx-player-ctrl-subtitle-menu-left') ||
                                document.querySelector('.bpx-player-ctrl-subtitle-menu-origin') ||
                                document.querySelector('.bpx-player-ctrl-subtitle-language-item');
            if (subtitlePanel) {
                clearInterval(checkInterval);
                clearTimeout(timeoutId);
                const actualPanel = subtitlePanel.closest('.bpx-player-ctrl-subtitle-menu-left') ||
                                  subtitlePanel.closest('.bpx-player-ctrl-subtitle-menu-origin') ||
                                  subtitlePanel.parentElement;
                createDownloadInterface(actualPanel);
                console.log(`%c 🎬 B站字幕与AI助手 v${version} %c Cost ${Math.round(performance.now() - startTime)}ms`, "background:#4A90E2;color:white;padding:2px 6px;border-radius:3px 0 0 3px;", "background:#50E3C2;color:#003333;padding:2px 6px;border-radius:0 3px 3px 0;");
            }
        }, 500);

        timeoutId = setTimeout(() => clearInterval(checkInterval), 30000);
    }

    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } 
    else { init(); }
})();
