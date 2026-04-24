# Vim Markdown 渲染配置完成

## 已安装内容

### 1. 插件管理器: vim-plug
- 位置: `~/.vim/autoload/plug.vim`
- 管理方式: 轻量级、快速

### 2. Markdown 插件
- **tabular**: 表格对齐支持
- **vim-markdown**: 完整的 Markdown 语法支持和渲染

### 3. 配置文件
位置: `~/.vimrc`

主要功能:
- ✅ 语法高亮
- ✅ Conceal 模式（隐藏 Markdown 符号，显示更干净）
- ✅ 自动换行
- ✅ 表格支持
- ✅ 代码块高亮
- ✅ Frontmatter 支持 (TOML/JSON)

## 使用方法

```bash
# 打开 Markdown 文件
vim file.md

# 在 vim 中:
# - 按 `za` 切换折叠
# - 按 `gc` 切换代码块注释
# - 输入 :Tableize 格式化表格
```

## 测试

```bash
vim /tmp/test.md
```

## 常用命令

| 命令 | 功能 |
|------|------|
| `:PlugInstall` | 安装插件 |
| `:PlugUpdate` | 更新插件 |
| `:PlugClean` | 清理未使用的插件 |
| `:set conceallevel=2` | 启用符号隐藏 |
| `:set conceallevel=0` | 禁用符号隐藏 |

## 自定义

编辑 `~/.vimrc` 修改配置：

```vim
" 禁用折叠
let g:vim_markdown_folding_disabled = 1

" 启用数学公式
let g:vim_markdown_math = 1

" 调整隐藏级别
set conceallevel=2  " 2 = 隐藏标记但保持结构
```

## 注意事项

1. 终端需要支持 true color 才能正确显示颜色
2. Conceal 级别可以通过 `:set conceallevel=X` 调整
   - 0 = 关闭
   - 1 = 部分隐藏
   - 2 = 完全隐藏（推荐）
   - 3 = 完全隐藏并忽略宽度
