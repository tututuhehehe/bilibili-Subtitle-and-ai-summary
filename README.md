# bilibili-Subtitle-and-ai-summary
> 🚀 一键获取 B 站视频/番剧字幕，支持沉浸式 AI 视频内容总结与连续对话的强力浏览器油猴脚本。

[![GreasyFork](https://img.shields.io/badge/GreasyFork-安装脚本-blue.svg)](https://greasyfork.org/zh-CN/scripts/575450-b站字幕获取与ai助手-沉浸式翻译-总结)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## ✨ 核心功能
* **一键字幕提取**：自动拦截并一键提取 B 站当前视频/番剧的 CC 闭路字幕，支持一键复制纯文本到剪贴板。
* **沉浸式 AI 总结与对话**：
  * 内置精美右侧边栏浮窗，不干扰视频观看。
  * 提供根据视频字幕生成结构化、支持 Markdown 渲染（加粗、列表、代码块、表格等）的 AI 详细总结。
  * 追问模式：基于视频内容与 AI 进行持续性的上下文对话。
* **灵活的多服务商与模型配置**：
  * 内置支持 **阿里云百炼 (DashScope)** 及 **DeepSeek 官方 API**。
  * 支持**完全自定义** OpenAI 接口格式的 API 服务商 (Endpoint/API Key)。
  * **主备双模型自由切换**：可在对话窗口右上角快速切换两个常用模型（例如 DeepSeek-V4-Flash 和 DeepSeek-V4-Pro）。
* **高级深度思考 (Reasoning) 适配**：
  * 无缝兼容并渲染带有“思考过程（Reasoning/Thinking）”的模型。
  * 自动折叠思考过程文本，界面依然保持清爽。
* **自定义总结 Prompt**：完全掌控给 AI 的首次总结指令，实现最符合你阅读偏好的摘要结构。
* **UI 体验友好**：深色拟物/毛玻璃浮窗、多状态信息提示、侧边沉浸式收起、可拖拽/可折叠操作。

## 📦 安装说明
1. **安装脚本管理器插件**：
   * 推荐使用 [Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/)。
2. **一键安装脚本**：
   * 前去 GreasyFork 页面点击安装：  
     👉 [点击这里跳转到 Greasyfork 安装](https://greasyfork.org/zh-CN/scripts/575450-b站字幕获取与ai助手-沉浸式翻译-总结)

## 📝 快速使用
1. 打开任意一个带有 CC 字幕的 B站 视频或番剧详情页。
2. 如果是首次使用，请点击打开右侧悬浮的 **AI总结** 面板，点击顶部菜单的 **⚙️ (齿轮)** 图标配置你的 API Key 等参数。
3. 配置完成后，点击面板右上角的 **刷新** 按钮，或者直接展开面板，就会自动拦截字幕请求并生成摘要。
4. 如果只需提取字幕原本，可以使用提取功能将其原样复制进剪贴板。
5. 在下方对话输入框中输入你的问题，随时向 AI 进行视频内容的深入追问体验。

## ⚙️ 进阶配置说明
内置配置面板支持以下字段：
* **服务商切换**：快速切换阿里云、DeepSeek 以及自定义端点（Endpoint）。
* **API Key**：你的云服务提供商 Token（脚本仅存储在本地，绝不私自外传）。
* **主模型 / 备用模型**：填入具体的模型名，例如 `qwen-max`、`deepseek-reasoner` 或 `gpt-4o`。
* **开启思考模式 (Reasoning)**：为深度推理模型自动适配对应头部并渲染思维链。
* **自定义 Prompt**：例如你可更改为：“*请总结该视频的笑点，并按照时间轴顺序列出。*”

## 🏷️ 数据安全与隐私
* 本脚本所有配置信息（包括 API Key）均通过油猴管理器安全函数 `GM_setValue` **严格保存在用户浏览器本地**，绝对不会上传至任何第三方服务器。
* 网络请求基于 `GM_xmlhttpRequest`，仅与用户配置的目标 API Endpoint 服务商发生互动。

## 📜 许可证
本项目采用 [MIT License](LICENSE) 许可，请随意 Fork 或提交 PR 共同改进。
