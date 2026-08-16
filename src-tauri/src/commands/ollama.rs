use std::time::Duration;

use reqwest::StatusCode;
use tauri::State;
use tokio::sync::oneshot;

use crate::models::ollama::{
    http_client, ChatRequestBody, ChatResponse, CommandError, GenerateRequest, GenerateResponse,
    OllamaError, OllamaModelDto, OllamaState, OllamaStatusDto, TagsResponse, VersionResponse,
    OLLAMA_BASE_URL,
};

const STATUS_TIMEOUT: Duration = Duration::from_secs(2);
const TAGS_TIMEOUT: Duration = Duration::from_secs(10);

/// A stopped server is a normal state, not a command failure, so this never errors.
#[tauri::command]
pub async fn check_ollama() -> OllamaStatusDto {
    match fetch_version().await {
        Ok(version) => OllamaStatusDto {
            running: true,
            version,
            error: None,
        },
        Err(error) => OllamaStatusDto {
            running: false,
            version: None,
            error: Some(error.to_string()),
        },
    }
}

#[tauri::command]
pub async fn list_ollama_models() -> Result<Vec<OllamaModelDto>, CommandError> {
    let response = http_client()
        .get(format!("{OLLAMA_BASE_URL}/api/tags"))
        .timeout(TAGS_TIMEOUT)
        .send()
        .await
        .map_err(classify_transport_error)?;

    let status = response.status();
    if !status.is_success() {
        let message = format!("Ollama returned HTTP {status} for /api/tags");
        return Err(OllamaError::Unknown(message).into());
    }

    let body = response
        .json::<TagsResponse>()
        .await
        .map_err(classify_transport_error)?;

    Ok(body.models.into_iter().map(OllamaModelDto::from).collect())
}

#[tauri::command]
pub async fn generate_diagram(
    request: GenerateRequest,
    state: State<'_, OllamaState>,
) -> Result<GenerateResponse, CommandError> {
    run_chat(request, state.inner()).await
}

#[tauri::command]
pub async fn repair_diagram(
    request: GenerateRequest,
    state: State<'_, OllamaState>,
) -> Result<GenerateResponse, CommandError> {
    run_chat(request, state.inner()).await
}

#[tauri::command]
pub async fn cancel_generation(
    request_id: String,
    state: State<'_, OllamaState>,
) -> Result<(), CommandError> {
    state.cancel(&request_id);
    Ok(())
}

async fn run_chat(
    request: GenerateRequest,
    state: &OllamaState,
) -> Result<GenerateResponse, CommandError> {
    let cancel = state.register(request.request_id.clone());
    let result = execute_chat(&request, cancel).await;
    // De-register on every path, including cancellation and transport failures.
    state.finish(&request.request_id);
    Ok(result?)
}

async fn execute_chat(
    request: &GenerateRequest,
    cancel: oneshot::Receiver<()>,
) -> Result<GenerateResponse, OllamaError> {
    let timeout = Duration::from_secs(request.timeout_secs.max(1));
    let body = ChatRequestBody::from_request(request);
    let pending = http_client()
        .post(format!("{OLLAMA_BASE_URL}/api/chat"))
        .timeout(timeout)
        .json(&body)
        .send();

    // Reading the body is part of the cancellable work, not a step after it.
    let call = async move {
        let response = pending.await.map_err(classify_transport_error)?;
        let status = response.status();
        let text = response.text().await.map_err(classify_transport_error)?;
        Ok::<(StatusCode, String), OllamaError>((status, text))
    };

    let (status, text) = tokio::select! {
        result = call => result?,
        _ = cancel => return Err(OllamaError::Cancelled),
        _ = tokio::time::sleep(timeout) => return Err(OllamaError::Timeout),
    };

    if status == StatusCode::NOT_FOUND {
        return Err(OllamaError::ModelMissing(request.model.clone()));
    }
    if !status.is_success() {
        // Ollama reports an uninstalled model as prose ("try pulling it first")
        // at least as often as it reports it with a status code.
        if mentions_missing_model(&text) {
            return Err(OllamaError::ModelMissing(request.model.clone()));
        }
        // Ollama explains real failures ("model requires more system memory") in
        // the body, so it is worth carrying into the technical details panel.
        return Err(OllamaError::Unknown(format!(
            "Ollama returned HTTP {status}: {}",
            summarise_body(&text)
        )));
    }

    let parsed: ChatResponse = serde_json::from_str(&text)
        .map_err(|error| OllamaError::InvalidOutput(error.to_string()))?;

    if let Some(error) = parsed.error {
        if mentions_missing_model(&error) {
            return Err(OllamaError::ModelMissing(request.model.clone()));
        }
        return Err(OllamaError::Unknown(error));
    }

    let content = parsed
        .message
        .map(|message| message.content)
        .unwrap_or_default();
    if content.trim().is_empty() {
        return Err(OllamaError::InvalidOutput(
            "the model returned an empty message".to_string(),
        ));
    }

    // The content is handed over verbatim: parsing and validating the diagram
    // belongs to the TypeScript layer, which owns the schema and the repair loop.
    Ok(GenerateResponse {
        content,
        model: if parsed.model.is_empty() {
            request.model.clone()
        } else {
            parsed.model
        },
        total_duration_ms: parsed.total_duration.map(|nanos| nanos / 1_000_000),
        eval_count: parsed.eval_count,
    })
}

async fn fetch_version() -> Result<Option<String>, OllamaError> {
    let response = http_client()
        .get(format!("{OLLAMA_BASE_URL}/api/version"))
        .timeout(STATUS_TIMEOUT)
        .send()
        .await
        .map_err(classify_transport_error)?;

    let status = response.status();
    if !status.is_success() {
        return Err(OllamaError::Unknown(format!("Ollama returned HTTP {status}")));
    }

    let body = response
        .json::<VersionResponse>()
        .await
        .map_err(classify_transport_error)?;

    Ok(body.version)
}

fn classify_transport_error(error: reqwest::Error) -> OllamaError {
    if error.is_timeout() {
        OllamaError::Timeout
    } else if error.is_connect() {
        OllamaError::Unreachable
    } else if error.is_decode() {
        OllamaError::InvalidOutput(error.to_string())
    } else {
        OllamaError::Unknown(error.to_string())
    }
}

/// Keeps an error body short enough for a message box and free of newlines.
fn summarise_body(text: &str) -> String {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return "no response body".to_string();
    }

    let flattened = trimmed.split_whitespace().collect::<Vec<_>>().join(" ");
    if flattened.chars().count() <= 300 {
        return flattened;
    }
    flattened.chars().take(300).collect::<String>() + "…"
}

fn mentions_missing_model(message: &str) -> bool {
    let message = message.to_ascii_lowercase();
    message.contains("not found") || message.contains("try pulling")
}
