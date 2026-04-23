# Markdown 终端预览命令

## 快速使用

### 1. 基本预览（推荐）
```bash
mdcat file.md
```

### 2. 分页模式（可滚动）
```bash
mdcat -p file.md
```

### 3. 自定义宽度
```bash
mdcat -w 80 file.md
```

### 4. 浅色主题
```bash
mdcat -l file.md
```

## 快捷别名

已在 `~/.zshrc` 中配置：

| 命令 | 功能 |
|------|------|
| `md file.md` | 基本预览 |
| `preview file.md` | 分页模式预览 |

重新加载配置后生效：
```bash
source ~/.zshrc
```

## glow 直接用法

```bash
# 基本预览
glow file.md --style dark

# 分页模式（可滚动）
glow file.md --style dark --pager

# 指定宽度
glow file.md --style dark --width 100

# 浅色主题
glow file.md --style light
```

## 测试示例

```bash
# 测试文件
mdcat /tmp/test.md

# 或直接用 glow
glow /tmp/test.md --style dark --pager
```

## 安装 glow

如果 glow 未安装：
```bash
brew install glow
```

## 其他 Markdown 工具

### bat (带语法高亮的 cat)
```bash
brew install bat
bat file.md
```

### less 查看器
```bash
glow file.md --pager | less -R
```

### 导出为 HTML
```bash
glow file.md --style dark > output.html
```

## 常用场景

### 查看 README
```bash
md README.md
```

### 查看文档
```bash
find . -name "*.md" -exec mdcat {} \;
```

### 管道输出
```bash
cat file.md | glow - --style dark
```

### 监控文件变化并预览
```bash
# 需要安装 entr
brew install entr
ls *.md | entr sh -c 'clear && mdcat file.md'
```

## 提示

- 按 `q` 退出预览
- 在分页模式下，使用方向键或 Page Up/Down 滚动
- 深色主题更适合长时间阅读
- 浅色主题适合打印或演示
