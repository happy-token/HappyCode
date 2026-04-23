# Vim Markdown 渲染增强配置

## 新增功能

### 1. 标题显示增强
- H1-H6 不同颜色和大小的字体
- 粗体显示，更易识别
- 每级标题有独特的颜色

### 2. 表格支持
- 表格分隔符高亮
- 自动格式化表格
- 快捷键: `<Leader>t` 或 `<Leader>T` 格式化表格

### 3. 语法高亮
- 代码块特殊颜色
- 链接带下划线
- 列表项标记高亮
- 引用块高亮

### 4. 其他改进
- 拼写检查
- 行号显示
- 相对行号
- 更好的缩进

## 文件结构

```
~/.vim/
├── .vimrc                           # 主配置文件
├── after/
│   └── ftplugin/
│       └── markdown.vim             # Markdown 特定设置
└── after/syntax/
    └── markdown/
        └── enhanced.vim             # 增强语法高亮
```

## 使用方法

```bash
# 打开 Markdown 文件
vim file.md

# 在 vim 中：
# - 标题会自动以不同颜色和大小显示
# - 表格会自动高亮分隔符
# - 按 <Leader>t 格式化表格
# - :set conceallevel=0 关闭符号隐藏
# - :set conceallevel=2 启用符号隐藏（推荐）
```

## Conceal 级别调整

```vim
:set conceallevel=0  " 显示所有 Markdown 符号
:set conceallevel=1  " 部分隐藏
:set conceallevel=2  " 完全隐藏（推荐）
:set conceallevel=3  " 完全隐藏并忽略宽度
```

## 测试

```bash
vim /tmp/test.md
```

确保文件中包含：
- `# Header 1`
- `## Header 2`
- `| Col1 | Col2 |` 等表格内容

## 故障排查

如果标题和表格仍然不显示：

1. 确认语法高亮已启用：
   ```vim
   :syntax on
   ```

2. 确认文件类型正确：
   ```vim
   :set filetype?
   " 应该显示：filetype=markdown
   ```

3. 检查 conceallevel：
   ```vim
   :set conceallevel?
   " 应该是：conceallevel=2
   ```

4. 手动重新加载语法文件：
   ```vim
   :syntax off
   :syntax on
   ```

5. 查看当前 highlighting：
   ```vim
   :highlight
   ```

## 插件说明

- **tabular**: 表格对齐
- **vim-markdown**: Markdown 完整支持
- **goyo.vim**: 专注写作模式（`:Goyo`）
- **limelight.vim**: 段落聚焦（`:Limelight`）

安装新插件后运行：
```vim
:PlugInstall
```
