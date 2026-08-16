use std::collections::HashMap;
use std::sync::{Mutex, MutexGuard, OnceLock};

use serde::{Deserialize, Serialize};
use tokio::sync::oneshot;

/// The endpoint is a compile-time constant on purpose: there is no config field,
/// no environment variable and no command parameter that can move it. Keeping the
/// base URL out of reach of the UI is the security boundary this MVP relies on.
pub const OLLAMA_BASE_URL: &str = "http://127.0.0.1:11434";

/// One client for the whole process. reqwest pools connections internally, so a
/// fresh client per request would throw the pool away every time. It lives here
/// rather than on `OllamaState` because the status and model commands take no state.
///
/// Proxies are cleared deliberately. reqwest otherwise picks up `HTTP_PROXY` and
/// `ALL_PROXY` from the environment and does not exempt loopback, so a machine with
/// a proxy configured would ship every prompt to a third-party host — exactly the
/// thing the hardcoded base URL above exists to prevent.
pub fn http_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .no_proxy()
            .build()
            .expect("failed to build the local HTTP client")
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaStatusDto {
    pub running: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaModelDto {
    pub name: String,
    pub size: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parameter_size: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quantization: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modified_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateRequest {
    pub request_id: String,
    pub model: String,
    pub system: String,
    pub prompt: String,
    pub format: Option<serde_json::Value>,
    pub temperature: f32,
    pub num_ctx: Option<u32>,
    pub timeout_secs: u64,
    pub think: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateResponse {
    pub content: String,
    pub model: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_duration_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub eval_count: Option<u32>,
}

/// The only error shape the frontend ever sees; `code` maps 1:1 onto `AppErrorCode`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandError {
    pub code: String,
    pub message: String,
}

#[derive(Debug, thiserror::Error)]
pub enum OllamaError {
    #[error("Could not reach Ollama on 127.0.0.1:11434")]
    Unreachable,
    #[error("Ollama did not respond in time")]
    Timeout,
    #[error("The request was cancelled")]
    Cancelled,
    #[error("The model `{0}` is not installed")]
    ModelMissing(String),
    #[error("Ollama returned an unusable response: {0}")]
    InvalidOutput(String),
    #[error("{0}")]
    Unknown(String),
}

impl OllamaError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::Unreachable => "ollama_unreachable",
            Self::Timeout => "timeout",
            Self::Cancelled => "cancelled",
            Self::ModelMissing(_) => "model_missing",
            Self::InvalidOutput(_) => "invalid_model_output",
            Self::Unknown(_) => "unknown",
        }
    }
}

impl From<OllamaError> for CommandError {
    fn from(error: OllamaError) -> Self {
        Self {
            code: error.code().to_string(),
            message: error.to_string(),
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct VersionResponse {
    pub version: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TagsResponse {
    #[serde(default)]
    pub models: Vec<TagEntry>,
}

#[derive(Debug, Deserialize)]
pub struct TagEntry {
    pub name: String,
    #[serde(default)]
    pub size: u64,
    pub modified_at: Option<String>,
    pub details: Option<TagDetails>,
}

#[derive(Debug, Default, Deserialize)]
pub struct TagDetails {
    pub parameter_size: Option<String>,
    pub quantization_level: Option<String>,
}

impl From<TagEntry> for OllamaModelDto {
    fn from(entry: TagEntry) -> Self {
        let TagEntry {
            name,
            size,
            modified_at,
            details,
        } = entry;
        let details = details.unwrap_or_default();
        Self {
            name,
            size,
            parameter_size: details.parameter_size,
            quantization: details.quantization_level,
            modified_at,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ChatMessage<'a> {
    pub role: &'a str,
    pub content: &'a str,
}

#[derive(Debug, Serialize)]
pub struct ChatOptions {
    pub temperature: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub num_ctx: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct ChatRequestBody<'a> {
    pub model: &'a str,
    pub messages: Vec<ChatMessage<'a>>,
    pub stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub think: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format: Option<&'a serde_json::Value>,
    pub options: ChatOptions,
}

impl<'a> ChatRequestBody<'a> {
    pub fn from_request(request: &'a GenerateRequest) -> Self {
        Self {
            model: &request.model,
            messages: vec![
                ChatMessage {
                    role: "system",
                    content: &request.system,
                },
                ChatMessage {
                    role: "user",
                    content: &request.prompt,
                },
            ],
            stream: false,
            think: request.think,
            format: request.format.as_ref(),
            options: ChatOptions {
                temperature: request.temperature,
                num_ctx: request.num_ctx,
            },
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct ChatResponse {
    #[serde(default)]
    pub model: String,
    pub message: Option<ChatResponseMessage>,
    /// Nanoseconds, per the Ollama API.
    pub total_duration: Option<u64>,
    pub eval_count: Option<u32>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ChatResponseMessage {
    #[serde(default)]
    pub content: String,
}

type PendingMap = HashMap<String, oneshot::Sender<()>>;

/// Tracks in-flight generations so the UI can stop one by request id.
pub struct OllamaState {
    pending: Mutex<PendingMap>,
}

impl OllamaState {
    pub fn new() -> Self {
        Self {
            pending: Mutex::new(HashMap::new()),
        }
    }

    pub fn register(&self, request_id: String) -> oneshot::Receiver<()> {
        let (sender, receiver) = oneshot::channel();
        self.lock().insert(request_id, sender);
        receiver
    }

    pub fn finish(&self, request_id: &str) {
        self.lock().remove(request_id);
    }

    /// Cancelling an unknown id is a no-op: the request has most likely just finished.
    pub fn cancel(&self, request_id: &str) {
        let sender = self.lock().remove(request_id);
        if let Some(sender) = sender {
            let _ = sender.send(());
        }
    }

    /// Every caller is a synchronous method, so the guard can never be held across
    /// an await point. A poisoned lock still hands back the map: a panicking command
    /// must not take cancellation down with it.
    fn lock(&self) -> MutexGuard<'_, PendingMap> {
        self.pending
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

impl Default for OllamaState {
    fn default() -> Self {
        Self::new()
    }
}
