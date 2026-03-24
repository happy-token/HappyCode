# KeVoiceInput 定制依赖仓库

这两个仓库包含 KeVoiceInput 项目所依赖的定制化修改，使其能够使用 SeACo Paraformer 的高级功能。

## 项目结构

- `sherpa-onnx` - 针对 KeVoiceInput 定制的 C++ 库，包含 model_eb 支持
- `sherpa-rs` - 针对 KeVoiceInput 定制的 Rust 绑定，与上述库配合使用

这两个仓库均包含了关键的自定义修改以支持 SeACo Paraformer 模型的热词(hotword)功能以及其他 KeVoiceInput 的特定需求。
