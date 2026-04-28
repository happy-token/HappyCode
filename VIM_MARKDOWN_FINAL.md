# Vim Markdown 配置 - 最终版

## 方案说明

由于 vim-markdown 插件存在 `<CR>` 模式搜索错误，已切换到更稳定的方案：

### 使用插件
- **markdown-preview.nvim**: 在浏览器中实时预览 Markdown（推荐）
- **tabular**: 表格对齐支持

### 功能
✅ 语法高亮
✅ 自动换行
✅ Conceal 模式（隐藏 Markdown 符号）
✅ 拼写检查
✅ 行号显示
✅ 表格支持
✅ **浏览器实时预览**（核心功能）

## 使用方法

### 1. 打开 Markdown 文件
```bash
vim file.md
```

### 2. 在浏览器中预览
在 vim 中输入：
```vim
:MarkdownPreview
```

这会在默认浏览器中打开一个实时预览窗口，支持：
- GitHub 风格渲染
- 表格完整显示
- 标题层级清晰
- 代码块高亮
- 数学公式（如果启用）

### 3. 停止预览
```vim
:MarkdownPreviewStop
```

### 4. 快捷键（可选）
在 `.vimrc` 中添加：
```vim
let g:mkdp_keys = {
\ 'l': '<C-l>',
\ 'k': '<C-k>',
\ 'j': '<C-j>',
\ 'h': '<C-h>',
\ }
```

## 本地 Vim 显示

在终端中，Markdown 会显示为：
- 标题：彩色 + 粗体
- 代码：特殊颜色
- 链接：带下划线
- 表格：基本显示

## 配置选项

编辑 `~/.vimrc` 调整：

```vim
" 启用/禁用拼写检查
autocmd FileType markdown setlocal nospell

" 调整 conceal 级别
:set conceallevel=0  " 显示所有符号
:set conceallevel=2  " 隐藏符号（推荐）

" 启用/禁用行号
autocmd FileType markdown setlocal nonumber
```

## 测试

```bash
vim /tmp/test.md
```

然后在 vim 中输入 `:MarkdownPreview` 查看完整渲染效果。

## 故障排查

### 问题：预览不工作
解决：确保 Node.js 已安装
```bash
node --version
npm --version
```

### 问题：表格显示不佳
解决：在浏览器中预览，或使用 tabular 插件格式化
```vim
:Tableize/|/
```

### 问题：标题不明显
解决：浏览器预览会正确显示标题层级和样式
