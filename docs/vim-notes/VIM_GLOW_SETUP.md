# Vim + Glow Markdown 配置完成

## 配置说明

### 已安装
- **glow**: 终端 Markdown 预览工具（已安装在 `/opt/homebrew/bin/glow`）
- **tabular**: 表格格式化插件
- **增强语法高亮**: H1-H6 标题彩色显示

### 使用方法

#### 1. 打开 Markdown 文件
```bash
vim file.md
```

在 vim 中，标题会显示为不同颜色：
- H1: 红色
- H2: 绿色  
- H3: 黄色
- H4: 蓝色
- H5: 紫色
- H6: 青色

#### 2. 使用 Glow 预览（推荐）

在 vim 中按以下快捷键：

| 快捷键 | 功能 |
|--------|------|
| `<Leader>p` | 在终端用 glow 预览（默认宽度） |
| `<Leader>P` | 自定义宽度预览 |
| `<Leader>f` | 格式化表格 |

`<Leader>` 默认是 `\`（反斜杠）

或者直接输入命令：
```vim
:GlowPreview
:GlowPager        " 分页模式（可滚动）
:GlowPreviewWide 80  " 指定宽度 80
```

#### 3. 命令行直接使用
```bash
# 直接预览
glow file.md --style dark

# 分页模式（可滚动）
glow file.md --style dark --pager

# 指定宽度
glow file.md --style dark --width 100
```

### 示例测试

```bash
# 打开测试文件
vim /tmp/test.md

# 在 vim 中按 \p 查看 glow 预览
```

## 配置详情

### `~/.vimrc` 关键配置
```vim
" 预览命令
command! -nargs=0 GlowPreview execute '!glow ' . shellescape(expand('%:p')) . ' --style dark --width 100'

" 快捷键绑定
autocmd FileType markdown nnoremap <buffer> <silent> <Leader>p :GlowPreview<CR>
```

### 语法高亮
- ✅ 标题 H1-H6 彩色显示
- ✅ 代码块特殊颜色
- ✅ 链接带下划线
- ✅ 粗体/斜体正确显示
- ✅ 自动换行
- ✅ 拼写检查
- ✅ 行号显示

## 故障排查

### Q: glow 预览退出后看不到 vim？
A: 这是正常的，glow 会在同一个终端窗口显示。按 `q` 退出 glow 后会回到 vim。

### Q: 想要分屏预览？
A: 使用两个终端窗口：
```bash
# 窗口 1: 编辑
vim file.md

# 窗口 2: 实时查看（需要安装 entr 或 watch）
watch -n 1 'glow file.md --style dark'
```

### Q: 表格显示不佳？
A: 在 vim 中按 `\f` 格式化表格，或在 glow 预览中会自动正确显示。

## 替代方案

如果需要在独立窗口预览，可以：

1. **使用 tmux 分屏**：
   ```bash
   # tmux 左侧编辑，右侧预览
   tmux split-window -h 'glow file.md --style dark'
   ```

2. **使用 VS Code**（如果需要 GUI 预览）：
   ```bash
   code file.md
   # 按 Cmd+Shift+V 打开预览
   ```

3. **浏览器预览**（需要安装 live-server）：
   ```bash
   npm install -g live-server
   live-server --port=8080 .
   ```
