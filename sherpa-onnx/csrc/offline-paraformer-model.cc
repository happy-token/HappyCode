// sherpa-onnx/csrc/offline-paraformer-model.cc
//
// Copyright (c)  2022-2023  Xiaomi Corporation

#include "sherpa-onnx/csrc/offline-paraformer-model.h"

#include <algorithm>
#include <memory>
#include <string>
#include <utility>
#include <vector>

#if __ANDROID_API__ >= 9
#include "android/asset_manager.h"
#include "android/asset_manager_jni.h"
#endif

#if __OHOS__
#include "rawfile/raw_file_manager.h"
#endif

#include <fstream>
#include <sstream>

#include "sherpa-onnx/csrc/file-utils.h"
#include "sherpa-onnx/csrc/macros.h"
#include "sherpa-onnx/csrc/onnx-utils.h"
#include "sherpa-onnx/csrc/session.h"
#include "sherpa-onnx/csrc/symbol-table.h"
#include "sherpa-onnx/csrc/text-utils.h"

namespace sherpa_onnx {

class OfflineParaformerModel::Impl {
 public:
  explicit Impl(const OfflineModelConfig &config)
      : config_(config),
        env_(ORT_LOGGING_LEVEL_ERROR),
        sess_opts_(GetSessionOptions(config)),
        allocator_{} {
    auto buf = ReadFile(config_.paraformer.model);
    Init(buf.data(), buf.size());

    // Load embedding model if provided (for SeACo-Paraformer)
    if (!config_.paraformer.model_eb.empty()) {
      auto eb_buf = ReadFile(config_.paraformer.model_eb);
      InitEmbedding(eb_buf.data(), eb_buf.size());
    }
  }

  template <typename Manager>
  Impl(Manager *mgr, const OfflineModelConfig &config)
      : config_(config),
        env_(ORT_LOGGING_LEVEL_ERROR),
        sess_opts_(GetSessionOptions(config)),
        allocator_{} {
    auto buf = ReadFile(mgr, config_.paraformer.model);
    Init(buf.data(), buf.size());

    // Load embedding model if provided (for SeACo-Paraformer)
    if (!config_.paraformer.model_eb.empty()) {
      auto eb_buf = ReadFile(mgr, config_.paraformer.model_eb);
      InitEmbedding(eb_buf.data(), eb_buf.size());
    }
  }

  std::vector<Ort::Value> Forward(Ort::Value features,
                                  Ort::Value features_length) {
    // Check if model requires bias_embed input (SeACo-Paraformer)
    bool needs_bias_embed = false;
    int32_t bias_embed_index = -1;
    for (size_t i = 0; i < input_names_.size(); ++i) {
      if (input_names_[i] == "bias_embed") {
        needs_bias_embed = true;
        bias_embed_index = static_cast<int32_t>(i);
        break;
      }
    }

    if (needs_bias_embed) {
      // Create an empty bias_embed tensor for SeACo-Paraformer
      // Shape: (batch_size, 0, embedding_dim) to indicate no hotwords
      auto features_shape = features.GetTensorTypeAndShapeInfo().GetShape();
      int64_t batch_size = features_shape[0];

      // Get embedding dimension from embedding model if available, otherwise use a default
      int64_t embedding_dim = 512;  // Default embedding dimension for SeACo-Paraformer
      if (embedding_sess_) {
        // Try to get embedding dimension from embedding model output shape
        auto output_type_info = embedding_sess_->GetOutputTypeInfo(0);
        auto output_shape = output_type_info.GetTensorTypeAndShapeInfo().GetShape();
        if (output_shape.size() >= 3) {
          embedding_dim = output_shape[2];
        } else if (output_shape.size() == 2) {
          // If output is 2D (N, D), use D as embedding_dim
          embedding_dim = output_shape[1];
        }
      }

      // Create empty bias_embed: shape (batch_size, 0, embedding_dim)
      std::array<int64_t, 3> bias_embed_shape{batch_size, 0, embedding_dim};
      Ort::Value bias_embed = Ort::Value::CreateTensor<float>(
          allocator_, bias_embed_shape.data(), bias_embed_shape.size());

      // Build inputs array in the order expected by the model
      // Input order should match input_names_: typically ["speech", "speech_lengths", "bias_embed"]
      // We need to clone features and features_length since we may need to use them multiple times
      Ort::Value features_clone = Clone(allocator_, &features);
      Ort::Value features_length_clone = Clone(allocator_, &features_length);

      std::vector<Ort::Value> inputs;
      inputs.reserve(3);

      // Find the correct order based on input_names_
      for (size_t i = 0; i < input_names_.size(); ++i) {
        const std::string &name = input_names_[i];
        if (name == "speech" || name == "features") {
          inputs.push_back(std::move(features_clone));
        } else if (name == "speech_lengths" ||
                   name == "features_length" ||
                   name == "features_lengths") {
          inputs.push_back(std::move(features_length_clone));
        } else if (name == "bias_embed") {
          inputs.push_back(std::move(bias_embed));
        }
      }

      // If we didn't find the expected names, use default order
      if (inputs.size() != 3) {
        inputs.clear();
        inputs.push_back(std::move(features));
        inputs.push_back(std::move(features_length));
        inputs.push_back(std::move(bias_embed));
      }

      return sess_->Run({}, input_names_ptr_.data(), inputs.data(), inputs.size(),
                        output_names_ptr_.data(), output_names_ptr_.size());
    } else {
      // Standard Paraformer without bias_embed
      std::array<Ort::Value, 2> inputs = {std::move(features),
                                          std::move(features_length)};

      return sess_->Run({}, input_names_ptr_.data(), inputs.data(), inputs.size(),
                        output_names_ptr_.data(), output_names_ptr_.size());
    }
  }

  std::vector<Ort::Value> Forward(Ort::Value features,
                                  Ort::Value features_length,
                                  Ort::Value bias_embed) {
    // This version receives a bias_embed from the recognizer
    // Build inputs array in the order expected by the model
    std::vector<Ort::Value> inputs;
    inputs.reserve(3);

    // We need to clone features and features_length since std::move invalidates them
    Ort::Value features_clone = Clone(allocator_, &features);
    Ort::Value features_length_clone = Clone(allocator_, &features_length);

    // Find the correct order based on input_names_
    for (size_t i = 0; i < input_names_.size(); ++i) {
      const std::string &name = input_names_[i];
      if (name == "speech" || name == "features") {
        inputs.push_back(std::move(features_clone));
      } else if (name == "speech_lengths" ||
                 name == "features_length" ||
                 name == "features_lengths") {
        inputs.push_back(std::move(features_length_clone));
      } else if (name == "bias_embed") {
        inputs.push_back(std::move(bias_embed));
      }
    }

    // If we didn't find the expected names, use default order
    if (inputs.size() != 3) {
      inputs.clear();
      inputs.push_back(std::move(features));
      inputs.push_back(std::move(features_length));
      inputs.push_back(std::move(bias_embed));
    }

    return sess_->Run({}, input_names_ptr_.data(), inputs.data(), inputs.size(),
                      output_names_ptr_.data(), output_names_ptr_.size());
  }

  int32_t VocabSize() const { return vocab_size_; }

  int32_t LfrWindowSize() const { return lfr_window_size_; }

  int32_t LfrWindowShift() const { return lfr_window_shift_; }

  const std::vector<float> &NegativeMean() const { return neg_mean_; }

  const std::vector<float> &InverseStdDev() const { return inv_stddev_; }

  OrtAllocator *Allocator() { return allocator_; }

  std::vector<Ort::Value> ForwardEmbedding(Ort::Value input_ids) {
    if (!embedding_sess_) {
      return {};
    }

    std::array<Ort::Value, 1> inputs = {std::move(input_ids)};
    return embedding_sess_->Run({}, embedding_input_names_ptr_.data(),
                                inputs.data(), inputs.size(),
                                embedding_output_names_ptr_.data(),
                                embedding_output_names_ptr_.size());
  }

  bool HasEmbeddingModel() const { return embedding_sess_ != nullptr; }

 private:
  // Load CMVN parameters from am.mvn file
  // Format: <LearnRateCoef> 0 [ value1 value2 ... valueN ]
  // First <LearnRateCoef> line contains neg_mean, second contains inv_stddev
  bool LoadCmvnFromFile(const std::string &mvn_file,
                        std::vector<float> *neg_mean,
                        std::vector<float> *inv_stddev) {
    std::ifstream file(mvn_file);
    if (!file.is_open()) {
      return false;
    }

    std::string line;
    bool found_first = false;
    bool found_second = false;

    while (std::getline(file, line)) {
      if (line.find("<LearnRateCoef>") == std::string::npos) {
        continue;
      }

      // Parse the line: <LearnRateCoef> 0 [ value1 value2 ... valueN ]
      // Find the opening bracket '['
      size_t bracket_start = line.find('[');
      if (bracket_start == std::string::npos) {
        continue;
      }

      // Find the closing bracket ']'
      size_t bracket_end = line.find_last_of(']');
      if (bracket_end == std::string::npos || bracket_end <= bracket_start) {
        continue;
      }

      // Extract the substring between [ and ]
      std::string values_str = line.substr(bracket_start + 1, bracket_end - bracket_start - 1);
      
      // Split by whitespace and parse floats
      std::vector<float> values;
      std::istringstream iss(values_str);
      std::string val_str;
      while (iss >> val_str) {
        if (!val_str.empty()) {
          try {
            float val = std::stof(val_str);
            values.push_back(val);
          } catch (const std::exception &) {
            // Skip invalid values
            continue;
          }
        }
      }

      if (values.empty()) {
        continue;
      }

      if (!found_first) {
        *neg_mean = std::move(values);
        found_first = true;
      } else if (!found_second) {
        *inv_stddev = std::move(values);
        found_second = true;
        break;
      }
    }

    return found_first && found_second;
  }

  // Try to find am.mvn file in the same directory as model file
  std::string FindAmMvnFile(const std::string &model_path) {
    // Get directory of model file
    size_t last_slash = model_path.find_last_of("/\\");
    if (last_slash == std::string::npos) {
      return "am.mvn";  // Try current directory
    }

    std::string dir = model_path.substr(0, last_slash + 1);
    std::string mvn_file = dir + "am.mvn";

    if (FileExists(mvn_file)) {
      return mvn_file;
    }

    return "";
  }

  void Init(void *model_data, size_t model_data_length) {
    sess_ = std::make_unique<Ort::Session>(env_, model_data, model_data_length,
                                           sess_opts_);

    GetInputNames(sess_.get(), &input_names_, &input_names_ptr_);

    GetOutputNames(sess_.get(), &output_names_, &output_names_ptr_);

    // get meta data
    Ort::ModelMetadata meta_data = sess_->GetModelMetadata();
    if (config_.debug) {
      std::ostringstream os;
      PrintModelMetadata(os, meta_data);
#if __OHOS__
      SHERPA_ONNX_LOGE("%{public}s\n", os.str().c_str());
#else
      SHERPA_ONNX_LOGE("%s\n", os.str().c_str());
#endif
    }

    Ort::AllocatorWithDefaultOptions allocator;  // used in the macro below
    
    // Try to read vocab_size from metadata, if not found, read from tokens file
    auto vocab_size_value = LookupCustomModelMetaData(meta_data, "vocab_size", allocator);
    if (vocab_size_value.empty()) {
      // If vocab_size is not in metadata, try to read from tokens file
      if (!config_.tokens.empty()) {
        SymbolTable symbol_table(config_.tokens);
        vocab_size_ = symbol_table.NumSymbols();
        if (config_.debug) {
          SHERPA_ONNX_LOGE("vocab_size not found in metadata, using %d from tokens.txt",
                           vocab_size_);
        }
      } else {
        SHERPA_ONNX_LOGE("'vocab_size' does not exist in the metadata and tokens file is not provided");
        SHERPA_ONNX_EXIT(-1);
      }
    } else {
      vocab_size_ = atoi(vocab_size_value.c_str());
      if (vocab_size_ < 0) {
        SHERPA_ONNX_LOGE("Invalid value %d for 'vocab_size'", vocab_size_);
        SHERPA_ONNX_EXIT(-1);
      }
    }
    
    // Try to read lfr_window_size, use default value 7 if not found
    auto lfr_window_size_value = LookupCustomModelMetaData(meta_data, "lfr_window_size", allocator);
    if (lfr_window_size_value.empty()) {
      lfr_window_size_ = 7;  // Default value for Paraformer
      if (config_.debug) {
        SHERPA_ONNX_LOGE("lfr_window_size not found in metadata, using default %d",
                         lfr_window_size_);
      }
    } else {
      lfr_window_size_ = atoi(lfr_window_size_value.c_str());
      if (lfr_window_size_ < 0) {
        SHERPA_ONNX_LOGE("Invalid value %d for 'lfr_window_size'", lfr_window_size_);
        SHERPA_ONNX_EXIT(-1);
      }
    }
    
    // Try to read lfr_window_shift, use default value 6 if not found
    auto lfr_window_shift_value = LookupCustomModelMetaData(meta_data, "lfr_window_shift", allocator);
    if (lfr_window_shift_value.empty()) {
      lfr_window_shift_ = 6;  // Default value for Paraformer
      if (config_.debug) {
        SHERPA_ONNX_LOGE("lfr_window_shift not found in metadata, using default %d",
                         lfr_window_shift_);
      }
    } else {
      lfr_window_shift_ = atoi(lfr_window_shift_value.c_str());
      if (lfr_window_shift_ < 0) {
        SHERPA_ONNX_LOGE("Invalid value %d for 'lfr_window_shift'", lfr_window_shift_);
        SHERPA_ONNX_EXIT(-1);
      }
    }

    // Try to read neg_mean and inv_stddev from metadata first
    auto neg_mean_value = LookupCustomModelMetaData(meta_data, "neg_mean", allocator);
    auto inv_stddev_value = LookupCustomModelMetaData(meta_data, "inv_stddev", allocator);

    if (!neg_mean_value.empty() && !inv_stddev_value.empty()) {
      // Both found in metadata
      bool ret = SplitStringToFloats(neg_mean_value.c_str(), ",", true, &neg_mean_);
      if (!ret) {
        SHERPA_ONNX_LOGE("Invalid value '%s' for 'neg_mean'", neg_mean_value.c_str());
        SHERPA_ONNX_EXIT(-1);
      }
      ret = SplitStringToFloats(inv_stddev_value.c_str(), ",", true, &inv_stddev_);
      if (!ret) {
        SHERPA_ONNX_LOGE("Invalid value '%s' for 'inv_stddev'", inv_stddev_value.c_str());
        SHERPA_ONNX_EXIT(-1);
      }
      if (config_.debug) {
        SHERPA_ONNX_LOGE("Loaded CMVN parameters from ONNX metadata");
      }
    } else {
      // Try to load from am.mvn file
      std::string mvn_file = FindAmMvnFile(config_.paraformer.model);
      if (!mvn_file.empty()) {
        if (LoadCmvnFromFile(mvn_file, &neg_mean_, &inv_stddev_)) {
          if (config_.debug) {
            SHERPA_ONNX_LOGE("Loaded CMVN parameters from %s", mvn_file.c_str());
          }
        } else {
          SHERPA_ONNX_LOGE("Failed to load CMVN parameters from %s", mvn_file.c_str());
          SHERPA_ONNX_EXIT(-1);
        }
      } else {
        SHERPA_ONNX_LOGE(
            "'neg_mean' and 'inv_stddev' do not exist in the metadata, "
            "and am.mvn file not found. Please ensure either:\n"
            "  1. The ONNX model contains 'neg_mean' and 'inv_stddev' in metadata, or\n"
            "  2. An 'am.mvn' file exists in the same directory as the model file.");
        SHERPA_ONNX_EXIT(-1);
      }
    }

    // Validate that both vectors have the same size
    if (neg_mean_.size() != inv_stddev_.size()) {
      SHERPA_ONNX_LOGE(
          "neg_mean size (%zu) != inv_stddev size (%zu). This is required for CMVN.",
          neg_mean_.size(), inv_stddev_.size());
      SHERPA_ONNX_EXIT(-1);
    }
  }

  void InitEmbedding(void *model_data, size_t model_data_length) {
    embedding_sess_ = std::make_unique<Ort::Session>(
        env_, model_data, model_data_length, sess_opts_);

    GetInputNames(embedding_sess_.get(), &embedding_input_names_,
                  &embedding_input_names_ptr_);

    GetOutputNames(embedding_sess_.get(), &embedding_output_names_,
                   &embedding_output_names_ptr_);
  }

 private:
  OfflineModelConfig config_;
  Ort::Env env_;
  Ort::SessionOptions sess_opts_;
  Ort::AllocatorWithDefaultOptions allocator_;

  std::unique_ptr<Ort::Session> sess_;

  std::vector<std::string> input_names_;
  std::vector<const char *> input_names_ptr_;

  std::vector<std::string> output_names_;
  std::vector<const char *> output_names_ptr_;

  // Embedding model for SeACo-Paraformer hotwords
  std::unique_ptr<Ort::Session> embedding_sess_;

  std::vector<std::string> embedding_input_names_;
  std::vector<const char *> embedding_input_names_ptr_;

  std::vector<std::string> embedding_output_names_;
  std::vector<const char *> embedding_output_names_ptr_;

  std::vector<float> neg_mean_;
  std::vector<float> inv_stddev_;

  int32_t vocab_size_ = 0;  // initialized in Init
  int32_t lfr_window_size_ = 0;
  int32_t lfr_window_shift_ = 0;
};

OfflineParaformerModel::OfflineParaformerModel(const OfflineModelConfig &config)
    : impl_(std::make_unique<Impl>(config)) {}

template <typename Manager>
OfflineParaformerModel::OfflineParaformerModel(Manager *mgr,
                                               const OfflineModelConfig &config)
    : impl_(std::make_unique<Impl>(mgr, config)) {}

OfflineParaformerModel::~OfflineParaformerModel() = default;

std::vector<Ort::Value> OfflineParaformerModel::Forward(
    Ort::Value features, Ort::Value features_length) {
  return impl_->Forward(std::move(features), std::move(features_length));
}

std::vector<Ort::Value> OfflineParaformerModel::Forward(
    Ort::Value features, Ort::Value features_length, Ort::Value bias_embed) {
  return impl_->Forward(std::move(features), std::move(features_length),
                        std::move(bias_embed));
}

int32_t OfflineParaformerModel::VocabSize() const { return impl_->VocabSize(); }

int32_t OfflineParaformerModel::LfrWindowSize() const {
  return impl_->LfrWindowSize();
}
int32_t OfflineParaformerModel::LfrWindowShift() const {
  return impl_->LfrWindowShift();
}
const std::vector<float> &OfflineParaformerModel::NegativeMean() const {
  return impl_->NegativeMean();
}
const std::vector<float> &OfflineParaformerModel::InverseStdDev() const {
  return impl_->InverseStdDev();
}

OrtAllocator *OfflineParaformerModel::Allocator() const {
  return impl_->Allocator();
}

std::vector<Ort::Value> OfflineParaformerModel::ForwardEmbedding(
    Ort::Value input_ids) const {
  return impl_->ForwardEmbedding(std::move(input_ids));
}

bool OfflineParaformerModel::HasEmbeddingModel() const {
  return impl_->HasEmbeddingModel();
}

#if __ANDROID_API__ >= 9
template OfflineParaformerModel::OfflineParaformerModel(
    AAssetManager *mgr, const OfflineModelConfig &config);
#endif

#if __OHOS__
template OfflineParaformerModel::OfflineParaformerModel(
    NativeResourceManager *mgr, const OfflineModelConfig &config);
#endif

}  // namespace sherpa_onnx
