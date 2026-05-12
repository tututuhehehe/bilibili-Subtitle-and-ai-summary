// ==UserScript==
// @name         微信公众号文章 AI 助手 (沉浸式总结/对话)
// @namespace    https://github.com/tututuhehehe/wx-article-ai-summary
// @version      1.0.0
// @author       limoon (Modified)
// @description  一键获取微信公众号文章内容，支持沉浸式AI对话、双模型切换、侧边栏收起、自定义总结Prompt，支持阿里云与DeepSeek官方接口切换
// @match        *://mp.weixin.qq.com/s/*
// @icon         https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico
// @require      https://cdn.jsdelivr.net/npm/marked@4.3.0/marked.min.js
// @grant        unsafeWindow
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      *
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    const startTime = performance.now();
    const version = GM_info.script.version;

    // 配置数据字典
    const CONFIG_DICT = {
        provider: { key: 'wx_ai_provider', def: 'aliyun', el: 'set-provider' },
        endpoint: { key: 'wx_ai_endpoint', def: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', el: 'set-endpoint' },
        apiKey: { key: 'wx_ai_api_key', def: '', el: 'set-apikey' },
        model1: { key: 'wx_ai_model1', def: 'deepseek-v4-flash', el: 'set-model1' },
        model2: { key: 'wx_ai_model2', def: 'deepseek-v4-pro', el: 'set-model2' },
        thinking: { key: 'wx_ai_thinking', def: false, el: 'set-thinking', isCheckbox: true },
        prompt: { key: 'wx_ai_custom_prompt', def: '请根据以下微信公众号文章内容，提取出核心观点，并用结构化的 Markdown 格式（如标题、列表、加粗重点，必要时可以使用表格）进行详细总结。', el: 'set-prompt' }
    };

    let aiConfig = {};
    for (let k in CONFIG_DICT) aiConfig[k] = GM_getValue(CONFIG_DICT[k].key, CONFIG_DICT[k].def);

    // 状态数据
    let currentArticleText = "";
    let chatHistory = [];
    let isRequesting = false;

    function addGlobalStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .wx-ai-infobar {
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                background-color: rgba(25, 26, 27, 0.98); border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 8px; padding: 12px 20px; color: white; font-size: 14px; font-weight: bold;
                z-index: 2147483647; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8); backdrop-filter: blur(10px);
                text-align: center; transition: all 0.3s ease;
            }
            .wx-ai-infobar.info { border-left: 4px solid #07c160; }
            .wx-ai-infobar.success { border-left: 4px solid #52c41a; }
            .wx-ai-infobar.error { border-left: 4px solid #f5222d; }

            /* 常驻侧边栏样式 */
            #wx-ai-minimized {
                position: fixed; right: 0; top: 50%; transform: translateY(-50%); width: 40px; height: 110px;
                background-color: #1e1e20; border: 1px solid #333; border-right: none; border-radius: 12px 0 0 12px;
                box-shadow: -5px 5px 15px rgba(0,0,0,0.5); z-index: 2147483646; display: flex;
                flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;
            }
            #wx-ai-minimized:hover { background-color: #2a2a2b; width: 45px; }
            #wx-ai-minimized span { color: #07c160; font-size: 14px; font-weight: bold; writing-mode: vertical-lr; letter-spacing: 4px; text-align: center;}

            #wx-ai-panel {
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
            .ai-panel-title { font-size: 15px; font-weight: bold; color: #07c160; }
            .ai-model-select { background: #1e1e20; color: #ccc; border: 1px solid #444; border-radius: 4px; padding: 2px 6px; font-size: 12px; outline: none; cursor: pointer;}
            .ai-refresh-btn { cursor: pointer; color: #07c160; font-size: 14px; transition: transform 0.3s; }
            .ai-refresh-btn:hover { transform: rotate(180deg); }

            .ai-panel-header-actions { display: flex; align-items: center; gap: 12px; }
            .ai-icon-btn { cursor: pointer; color: #999; font-size: 16px; transition: color 0.2s; }
            .ai-icon-btn:hover { color: #fff; }

            .ai-panel-chat { flex: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
            .chat-bubble { max-width: 92%; padding: 10px 14px; border-radius: 8px; font-size: 14px; line-height: 1.6; word-wrap: break-word; overflow-x: auto; }
            .chat-bubble.user { background: #07c160; color: white; align-self: flex-end; border-bottom-right-radius: 2px; }
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
            .chat-bubble.assistant table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 13px; color: #eee; }
            .chat-bubble.assistant th, .chat-bubble.assistant td { border: 1px solid #444; padding: 6px 10px; text-align: left; }
            .chat-bubble.assistant th { background-color: #1a1a1b; color: #07c160; font-weight: bold; }
            .chat-bubble.assistant tr:nth-child(even) { background-color: rgba(255, 255, 255, 0.03); }

            .ai-panel-input-area { padding: 12px; border-top: 1px solid #333; background: #252528; display: flex; gap: 8px; border-radius: 0 0 12px 12px;}
            .ai-chat-textarea { flex: 1; height: 36px; min-height: 36px; max-height: 100px; background: #1e1e20; border: 1px solid #444; color: white; border-radius: 6px; padding: 8px; font-size: 13px; resize: none; outline: none; font-family: inherit;}
            .ai-chat-send { background: #07c160; color: white; border: none; padding: 0 16px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: background 0.2s;}
            .ai-chat-send:hover { background: #06ad56; }
            .ai-chat-send:disabled { background: #444; color: #888; cursor: not-allowed; }

            .ai-panel-settings { position: absolute; bottom: 61px; left: 0; right: 0; padding: 16px; border-top: 1px solid #333; font-size: 12px; background: rgba(37, 37, 40, 0.95); backdrop-filter: blur(10px); display: none; z-index: 10; border-radius: 0 0 12px 12px;}
            .ai-input { width: 100%; box-sizing: border-box; margin-top: 4px; margin-bottom: 8px; padding: 6px; background: #1e1e20; border: 1px solid #444; color: white; border-radius: 4px; font-family: inherit;}
            .ai-settings-row { display: flex; gap: 8px; }
        `;
        document.head.appendChild(style);
    }

    function showInfoBar(m, t = 'info', d = 3000) { const e = document.querySelector('.wx-ai-infobar'); if (e) e.remove(); const i = document.createElement('div'); i.className = `wx-ai-infobar ${t}`; i.textContent = m; document.body.appendChild(i); if (d > 0) { setTimeout(() => { if (i.parentNode) { i.style.opacity = '0'; i.style.transform = 'translate(-50%, -50%) scale(0.9)'; setTimeout(() => i.remove(), 300); } }, d); } return i; }

    // 获取微信公众号文章内容
    function fetchArticleText() {
        return new Promise((resolve, reject) => {
            const contentNode = document.getElementById('js_content');
            if (!contentNode) {
                return reject(new Error('未找到文章正文内容 (#js_content)'));
            }

            // 获取标题和作者
            const titleNode = document.getElementById('activity-name');
            const authorNode = document.getElementById('js_name');

            const title = titleNode ? titleNode.innerText.trim() : document.title;
            const author = authorNode ? authorNode.innerText.trim() : '未知作者';

            // 优先尝试 innerText，避免提取隐藏内容。如为空则 fallback 到 textContent
            let text = contentNode.innerText;
            if (!text || text.trim() === '') {
                text = contentNode.textContent;
            }

            text = text.replace(/\n\s*\n/g, '\n').trim();

            if (!text) {
                return reject(new Error('文章内容为空'));
            }

            const finalContext = `文章标题：${title}\n公众号作者：${author}\n\n正文内容：\n${text}`;
            resolve(finalContext);
        });
    }

    function requestAIStream(messages, onChunk, onComplete, onError) {
        if (!aiConfig.apiKey) {
            onError("请先点击右上角⚙️图标配置 API Key");
            return;
        }

        const selectedModel = document.getElementById('ai-model-select').value;
        isRequesting = true;
        updateChatSendButtonState();

        const payload = {
            model: selectedModel,
            messages: messages,
            stream: true
        };

        // 根据服务商组装思考模式参数
        if (aiConfig.provider === 'aliyun') {
            payload.enable_thinking = aiConfig.thinking;
        } else if (aiConfig.provider === 'deepseek') {
            payload.thinking = { type: aiConfig.thinking ? "enabled" : "disabled" };
        } else {
            if (aiConfig.endpoint.includes('dashscope')) payload.enable_thinking = aiConfig.thinking;
            if (aiConfig.endpoint.includes('deepseek.com')) payload.thinking = { type: aiConfig.thinking ? "enabled" : "disabled" };
        }

        GM_xmlhttpRequest({
            method: "POST",
            url: aiConfig.endpoint,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${aiConfig.apiKey}`,
                "Accept": "text/event-stream"
            },
            data: JSON.stringify(payload),
            responseType: 'stream',
            onloadstart: async function (response) {
                try {
                    const reader = response.response.getReader();
                    const decoder = new TextDecoder('utf-8');
                    let buffer = '';
                    let reasoningContent = '';
                    let mainContent = '';

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
                                    if (data.choices && data.choices[0].delta) {
                                        const delta = data.choices[0].delta;
                                        let updated = false;

                                        // 处理思考过程
                                        if (delta.reasoning_content) {
                                            reasoningContent += delta.reasoning_content;
                                            updated = true;
                                        }
                                        // 处理正文内容
                                        if (delta.content) {
                                            mainContent += delta.content;
                                            updated = true;
                                        }

                                        if (updated) {
                                            let displayHtml = '';
                                            if (reasoningContent) {
                                                // 折叠显示思考过程
                                                displayHtml += `<details ${mainContent ? '' : 'open'} style="margin-bottom: 8px;">
                                                    <summary style="color:#aaa;font-size:12px;cursor:pointer;user-select:none;">💭 思考过程</summary>
                                                    <div style="color:#888;font-size:12px;padding:8px;background:rgba(0,0,0,0.2);border-radius:6px;margin-top:4px;white-space:pre-wrap;">${reasoningContent}</div>
                                                </details>`;
                                            }
                                            if (mainContent) {
                                                displayHtml += marked.parse(mainContent);
                                            } else if (reasoningContent) {
                                                displayHtml += '<span style="color:#888;">AI 深度思考中...</span>';
                                            }
                                            onChunk(displayHtml);
                                        }
                                    }
                                } catch (e) { }
                            }
                        }
                    }
                    isRequesting = false;
                    onComplete(mainContent || reasoningContent);
                    updateChatSendButtonState();
                } catch (err) {
                    isRequesting = false;
                    onError("流读取中断");
                    updateChatSendButtonState();
                }
            },
            onerror: function (err) {
                isRequesting = false;
                onError("网络请求失败，请检查配置或网络");
                updateChatSendButtonState();
            }
        });
    }

    function updateChatSendButtonState() {
        const btn = document.getElementById('ai-chat-send');
        const textarea = document.getElementById('ai-chat-textarea');
        if (!btn || !textarea) return;

        if (!aiConfig.apiKey || aiConfig.apiKey.trim() === '') {
            btn.textContent = '发送';
            btn.disabled = true;
            textarea.placeholder = '请先配置 API Key...';
        } else if (chatHistory.length === 0) {
            btn.textContent = '总结';
            btn.disabled = isRequesting;
            textarea.placeholder = '点击“总结”获取文章内容总结...';
        } else {
            btn.textContent = '发送';
            btn.disabled = isRequesting;
            textarea.placeholder = '向 AI 提问关于文章的内容...';
        }
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

        const systemPrompt = "你是一个得力的文章内容总结与问答助手。请直接输出 Markdown 格式的排版内容。";
        const userPrompt = `${aiConfig.prompt}\n\n${plainText}`;

        chatHistory.push({ role: "system", content: systemPrompt });
        chatHistory.push({ role: "user", content: userPrompt });

        appendChatBubble('system', '正在阅读文章内容并生成总结...');
        const assistantBubble = appendChatBubble('assistant', '<span style="color:#888;">AI 响应中...</span>');

        requestAIStream(
            chatHistory,
            (htmlToDisplay) => { assistantBubble.innerHTML = htmlToDisplay; },
            (plainTextForHistory) => {
                chatHistory.push({ role: "assistant", content: plainTextForHistory });
                document.getElementById('ai-panel-chat').querySelector('.system').textContent = '总结完成，您可以继续提问👇';
            },
            (errMsg) => { assistantBubble.innerHTML = `<span style="color:#f5222d;">❌ ${errMsg}</span>`; }
        );
    }

    function handleSendChat() {
        if (isRequesting) return;

        if (!aiConfig.apiKey || aiConfig.apiKey.trim() === '') {
            const chatContainer = document.getElementById('ai-panel-chat');
            chatContainer.innerHTML = '<div class="chat-bubble system" style="color:#ffcc00">⚠️ 请先点击右上角 ⚙️ 配置您的 API Key。</div>';
            document.getElementById('ai-panel-settings-container').style.display = 'block';
            return;
        }

        if (chatHistory.length === 0) {
            ensureArticleAndExecuteGlobal(() => { handleAISummaryBtn(); });
            return;
        }

        const inputEl = document.getElementById('ai-chat-textarea');
        const text = inputEl.value.trim();
        if (!text) return;

        inputEl.value = '';
        inputEl.style.height = '36px';
        appendChatBubble('user', text);

        chatHistory.push({ role: "user", content: text });
        const assistantBubble = appendChatBubble('assistant', '<span style="color:#888;">AI 响应中...</span>');

        const chatContainer = document.getElementById('ai-panel-chat');
        chatContainer.scrollTop = chatContainer.scrollHeight;

        requestAIStream(
            chatHistory,
            (htmlToDisplay) => { assistantBubble.innerHTML = htmlToDisplay; },
            (plainTextForHistory) => { chatHistory.push({ role: "assistant", content: plainTextForHistory }); },
            (errMsg) => { assistantBubble.innerHTML = `<span style="color:#f5222d;">❌ ${errMsg}</span>`; }
        );
    }

    function handleAISummaryBtn() {
        const panel = document.getElementById('wx-ai-panel');
        const minTab = document.getElementById('wx-ai-minimized');

        panel.style.display = 'flex';
        minTab.style.display = 'none';

        if (chatHistory.length > 0) return;

        const chatContainer = document.getElementById('ai-panel-chat');
        if (!aiConfig.apiKey) {
            chatContainer.innerHTML = '<div class="chat-bubble system" style="color:#ffcc00">⚠️ 请先点击右上角 ⚙️ 配置您的 API Key。</div>';
            document.getElementById('ai-panel-settings-container').style.display = 'block';
            return;
        }

        chatContainer.innerHTML = '<div class="chat-bubble system">获取文章内容中...</div>';

        fetchArticleText().then(plainText => {
            currentArticleText = plainText;
            triggerSummary(plainText);
        }).catch(err => {
            chatContainer.innerHTML = `<div class="chat-bubble system" style="color:#f5222d;">❌ 提取内容失败: ${err.message}</div>`;
        });
    }

    // 全局自动检测正文节点
    function ensureArticleAndExecuteGlobal(actionCallback) {
        if (document.getElementById('js_content')) {
            actionCallback();
        } else {
            showInfoBar("当前页面未检测到公众号文章正文", "error");
        }
    }

    // 创建整个 AI UI（侧拉常驻按钮 + 对话面板）
    function createAIPanel() {
        if (document.getElementById('wx-ai-panel')) return;

        const minTab = document.createElement('div');
        minTab.id = 'wx-ai-minimized';
        minTab.innerHTML = `<span>AI总结</span>`;
        document.body.appendChild(minTab);

        minTab.addEventListener('click', () => {
            ensureArticleAndExecuteGlobal(() => { handleAISummaryBtn(); });
        });

        const panel = document.createElement('div');
        panel.id = 'wx-ai-panel';
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
                </div>
            </div>

            <div class="ai-panel-chat" id="ai-panel-chat">
                <div class="chat-bubble system">准备就绪。点击下方“总结”开始。</div>
            </div>

            <div class="ai-panel-settings" id="ai-panel-settings-container">
                <div style="margin-bottom: 4px; color: #999;">服务商与API配置:</div>
                <div class="ai-settings-row">
                    <select id="set-provider" class="ai-input" style="width: 38%; padding: 4px;">
                        <option value="aliyun" ${aiConfig.provider === 'aliyun' ? 'selected' : ''}>阿里云百炼</option>
                        <option value="deepseek" ${aiConfig.provider === 'deepseek' ? 'selected' : ''}>DeepSeek官方</option>
                        <option value="custom" ${aiConfig.provider === 'custom' ? 'selected' : ''}>自定义</option>
                    </select>
                    <input type="password" id="set-apikey" class="ai-input" style="width: 62%;" value="${aiConfig.apiKey}" placeholder="API Key (sk-...)">
                </div>
                <input type="text" id="set-endpoint" class="ai-input" value="${aiConfig.endpoint}" placeholder="自定义 API Endpoint" style="display: ${aiConfig.provider === 'custom' ? 'block' : 'none'};">

                <div class="ai-settings-row">
                    <input type="text" id="set-model1" class="ai-input" value="${aiConfig.model1}" placeholder="主模型">
                    <input type="text" id="set-model2" class="ai-input" value="${aiConfig.model2}" placeholder="备用模型">
                </div>
                <div style="margin: 4px 0 8px 0;">
                    <label style="color:#eee; font-size:12px; cursor:pointer; display:flex; align-items:center; gap:6px;">
                        <input type="checkbox" id="set-thinking" ${aiConfig.thinking ? 'checked' : ''}>
                        开启思考模式 (Reasoning)
                    </label>
                </div>
                <div style="margin: 0 0 4px 0; color: #999;">自定义总结 Prompt:</div>
                <textarea id="set-prompt" class="ai-input" style="height: 54px; resize: vertical;" placeholder="要求 AI 如何进行总结...">${aiConfig.prompt}</textarea>
                <button class="ai-chat-send" id="ai-save-btn" style="width:100%; margin-top:4px;">保存配置</button>
            </div>

            <div class="ai-panel-input-area">
                <textarea id="ai-chat-textarea" class="ai-chat-textarea" placeholder="向 AI 提问关于文章的内容..."></textarea>
                <button id="ai-chat-send" class="ai-chat-send">发送</button>
            </div>
        `;
        document.body.appendChild(panel);

        // 设置栏：服务商切换事件绑定
        document.getElementById('set-provider').addEventListener('change', function () {
            const epInput = document.getElementById('set-endpoint');
            if (this.value === 'aliyun') {
                epInput.style.display = 'none';
                epInput.value = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
            } else if (this.value === 'deepseek') {
                epInput.style.display = 'none';
                epInput.value = 'https://api.deepseek.com/chat/completions';
            } else {
                epInput.style.display = 'block';
            }
        });

        // 面板内按键事件
        document.getElementById('ai-minimize-btn').addEventListener('click', () => {
            panel.style.display = 'none';
            minTab.style.display = 'flex';
        });

        document.getElementById('ai-refresh-btn').addEventListener('click', () => {
            if (!currentArticleText) {
                ensureArticleAndExecuteGlobal(() => { handleAISummaryBtn(); });
                return;
            }
            triggerSummary(currentArticleText);
        });

        document.getElementById('ai-setting-toggle').addEventListener('click', () => {
            const box = document.getElementById('ai-panel-settings-container');
            box.style.display = box.style.display === 'none' ? 'block' : 'none';
        });

        document.getElementById('ai-save-btn').addEventListener('click', () => {
            for (let k in CONFIG_DICT) {
                const config = CONFIG_DICT[k];
                const el = document.getElementById(config.el);
                aiConfig[k] = config.isCheckbox ? el.checked : el.value;
                GM_setValue(config.key, aiConfig[k]);
            }

            const select = document.getElementById('ai-model-select');
            select.innerHTML = `<option value="${aiConfig.model1}">${aiConfig.model1} (主)</option>`;
            if (aiConfig.model2) {
                select.innerHTML += `<option value="${aiConfig.model2}">${aiConfig.model2} (备)</option>`;
            }

            updateChatSendButtonState();

            const btn = document.getElementById('ai-save-btn');
            btn.textContent = '已保存！';
            btn.style.background = '#52c41a';
            setTimeout(() => {
                btn.textContent = '保存配置';
                btn.style.background = '#07c160';
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
        textarea.addEventListener('input', function () {
            this.style.height = '36px';
            this.style.height = (this.scrollHeight) + 'px';
        });

        // 初始化按钮状态
        updateChatSendButtonState();
    }

    function init() {
        addGlobalStyles();
        createAIPanel();
        console.log(`%c 📄 微信文章AI助手 v${version} %c Cost ${Math.round(performance.now() - startTime)}ms`, "background:#07c160;color:white;padding:2px 6px;border-radius:3px 0 0 3px;", "background:#50E3C2;color:#003333;padding:2px 6px;border-radius:0 3px 3px 0;");
    }

    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
    else { init(); }
})();