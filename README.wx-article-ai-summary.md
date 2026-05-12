# 微信公众号文章 AI 助手

> 面向微信公众号文章页的沉浸式 AI 总结与问答用户脚本。打开文章后，一键提取标题、作者和正文内容，并通过兼容 OpenAI 接口的大语言模型生成结构化总结。

## 脚本信息

- 文件名：`wx-article-ai-summary.user.js`
- 脚本名：微信公众号文章 AI 助手 (沉浸式总结/对话)
- 适用页面：`*://mp.weixin.qq.com/s/*`
- 当前版本：`1.0.0`
- 依赖：通过 `@require` 引入 `marked.js`
- 许可证：MIT

## 功能亮点

- 自动读取微信公众号文章正文区域 `#js_content`。
- 同时提取文章标题 `#activity-name` 和公众号作者 `#js_name`。
- 在页面右侧显示可收起的 `AI总结` 侧边栏。
- 首次点击可生成 Markdown 格式文章总结。
- 总结完成后可继续围绕文章内容追问。
- 支持阿里云百炼、DeepSeek 官方和自定义 OpenAI 兼容接口。
- 支持主模型、备用模型切换。
- 支持自定义总结 Prompt。
- 支持 Reasoning/Thinking 模式，并折叠展示思考过程。
- 深色毛玻璃风格 UI，尽量减少对原文章阅读体验的干扰。

## 安装方式

1. 安装用户脚本管理器：
   - [Tampermonkey](https://www.tampermonkey.net/)
   - [Violentmonkey](https://violentmonkey.github.io/)

2. 在脚本管理器中新建脚本。

3. 将 `wx-article-ai-summary.user.js` 的完整内容粘贴进去并保存。

4. 打开任意微信公众号文章页面。

5. 页面右侧出现 `AI总结` 后即可使用。

## 快速使用

1. 打开一篇微信公众号文章，地址通常形如：
   `https://mp.weixin.qq.com/s/...`

2. 点击页面右侧的 `AI总结`。

3. 首次使用时，点击右上角设置按钮，配置：
   - 服务商
   - API Key
   - 主模型 / 备用模型
   - 是否开启思考模式
   - 自定义总结 Prompt

4. 保存配置后，点击底部 `总结`。

5. 等待 AI 读取文章并生成总结。

6. 总结完成后，可以在底部输入框继续提问，例如：
   - “这篇文章的核心论点是什么？”
   - “帮我列出行动清单。”
   - “作者的依据是否充分？”
   - “用 5 条 bullet 总结给我。”

## 配置说明

### 服务商

内置三种选择：

- `阿里云百炼`：默认 Endpoint 为 `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
- `DeepSeek官方`：默认 Endpoint 为 `https://api.deepseek.com/chat/completions`
- `自定义`：手动填写 OpenAI 兼容的 Chat Completions Endpoint

### 模型

脚本提供主模型和备用模型两个输入框。保存后，可以在面板顶部下拉框中快速切换。

示例：

- `deepseek-v4-flash`
- `deepseek-v4-pro`
- `deepseek-chat`
- `deepseek-reasoner`
- `qwen-plus`
- `qwen-max`

具体可用模型取决于你的服务商账号和接口权限。

### 思考模式

开启后，脚本会根据服务商附加不同 payload：

- 阿里云百炼：`enable_thinking: true`
- DeepSeek：`thinking: { type: "enabled" }`

如果使用自定义 Endpoint，脚本会根据地址中是否包含 `dashscope` 或 `deepseek.com` 尝试自动适配。

### 自定义 Prompt

默认 Prompt 会要求 AI 提取文章核心观点，并用结构化 Markdown 总结。你可以改成更符合自己阅读习惯的指令，例如：

```text
请用以下结构总结文章：
1. 一句话结论
2. 关键论点
3. 重要证据
4. 值得追问的问题
5. 可执行建议
```

## 工作原理

脚本加载后会：

1. 向页面注入深色 AI 面板样式。
2. 创建右侧常驻 `AI总结` 收起按钮。
3. 点击后检测当前页面是否存在 `#js_content`。
4. 读取标题、作者和正文文本。
5. 使用 `GM_xmlhttpRequest` 向已配置的 AI API 发起流式请求。
6. 手动解析 SSE 返回数据，将正文内容渲染为 Markdown。
7. 如果响应中包含 `reasoning_content`，将其放入可折叠的“思考过程”区域。

## 常见问题

### 为什么按钮没出现？

请确认当前页面地址匹配 `https://mp.weixin.qq.com/s/...`，并确认用户脚本管理器已启用该脚本。

### 为什么提示未找到文章正文？

脚本依赖微信公众号文章正文节点 `#js_content`。如果页面不是标准公众号文章页，或正文由特殊方式渲染，可能无法提取。

### 为什么发送按钮不可用？

通常是还没有配置 API Key。点击面板右上角设置按钮，填写并保存后再试。

### 为什么请求失败？

请检查：

- API Key 是否正确。
- Endpoint 是否为 Chat Completions 兼容接口。
- 模型名是否可用。
- 当前服务商是否支持流式输出。
- 用户脚本管理器是否允许 `GM_xmlhttpRequest` 和跨域连接。

## 隐私说明

- API Key、Endpoint、模型和 Prompt 仅通过用户脚本管理器本地存储保存。
- 文章标题、作者和正文只会发送到你配置的 AI API Endpoint。
- 脚本没有后端服务，不会把内容发送到仓库作者或其他额外服务器。

## 与 B 站脚本的区别

| 对比项 | 微信公众号脚本 | B 站脚本 |
| --- | --- | --- |
| 内容来源 | 文章 DOM 正文 | 视频 CC 字幕接口 |
| 适用页面 | 微信公众号文章 | B 站视频、番剧 |
| 额外能力 | 文章问答 | 字幕复制、字幕自动捕获 |
| 主题色 | 微信绿色 | B 站蓝色 |

## 许可证

本脚本随项目采用 [MIT License](LICENSE)。
