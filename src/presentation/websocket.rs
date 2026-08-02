use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use crate::presentation::dto::PriceDto;
use crate::presentation::handlers::AppState;

/// GET /api/ws — upgrade the connection to a WebSocket and stream prices.
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

/// Per-connection task: forward each broadcast batch to this client as JSON.
async fn handle_socket(socket: WebSocket, state: AppState) {
    let (mut sender, mut receiver) = socket.split();

    // Subscribe to the price broadcast.
    let mut rx = state.broadcaster.subscribe();

    // Task A: push broadcast prices to the client.
    let mut send_task = tokio::spawn(async move {
        while let Ok(prices) = rx.recv().await {
            let dtos: Vec<PriceDto> = prices.iter().map(PriceDto::from).collect();
            let json = match serde_json::to_string(&dtos) {
                Ok(j) => j,
                Err(_) => continue,
            };
            if sender.send(Message::Text(json.into())).await.is_err() {
                // Client disconnected.
                break;
            }
        }
    });

    // Task B: watch for client close/messages (we ignore content, just
    // detect disconnect so we can clean up).
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let Message::Close(_) = msg {
                break;
            }
        }
    });

    // If either task ends (disconnect), abort the other.
    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    }

    tracing::debug!("websocket connection closed");
}