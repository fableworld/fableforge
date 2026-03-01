use std::fs;
use std::io::Cursor;
use std::sync::mpsc::{channel, Sender, TryRecvError};
use std::thread;
use std::time::{Duration, Instant};
use rodio::{Decoder, OutputStream, Sink, Source};
use tauri::{AppHandle, Emitter, State};
use crate::core::error::FabaError;

/// Commands sent to the background audio thread.
enum AudioCommand {
    Play(String),
    Stop,
}

/// A thread-safe audio engine that manages a background playback thread.
/// This bypasses the Webview's audio stack to provide stable playback on Linux.
pub struct AudioEngine {
    tx: Sender<AudioCommand>,
}

impl AudioEngine {
    /// Creates a new AudioEngine and spawns its management thread.
    pub fn new(app_handle: AppHandle) -> Self {
        let (tx, rx) = channel::<AudioCommand>();

        thread::spawn(move || {
            let (_stream, stream_handle) = match OutputStream::try_default() {
                Ok(s) => s,
                Err(e) => {
                    eprintln!("[AudioEngine] Error: Could not initialize output: {}", e);
                    return;
                }
            };

            let mut current_sink: Option<Sink> = None;

            loop {
                let start_loop = Instant::now();
                
                // Check for new commands from the frontend
                match rx.try_recv() {
                    Ok(AudioCommand::Play(path)) => {
                        if let Some(sink) = current_sink.take() {
                            sink.stop();
                        }

                        // Read entire file into RAM to eliminate disk latency during playback
                        match fs::read(&path) {
                            Ok(bytes) => {
                                let cursor = Cursor::new(bytes);
                                match Decoder::new(cursor) {
                                    Ok(source) => {
                                        match Sink::try_new(&stream_handle) {
                                            Ok(sink) => {
                                                // Buffer the source to resist CPU-induced jitter
                                                sink.append(source.buffered());
                                                current_sink = Some(sink);
                                            }
                                            Err(e) => eprintln!("[AudioEngine] Sink Error: {}", e),
                                        }
                                    }
                                    Err(e) => eprintln!("[AudioEngine] Decoder Error: {}. Path: {}", e, path),
                                }
                            }
                            Err(e) => eprintln!("[AudioEngine] IO Error: {}. Path: {}", e, path),
                        }
                    }
                    Ok(AudioCommand::Stop) => {
                        if let Some(sink) = current_sink.take() {
                            sink.stop();
                        }
                    }
                    Err(TryRecvError::Disconnected) => break,
                    Err(TryRecvError::Empty) => {}
                }

                // Check if the current track has finished naturally
                if let Some(sink) = current_sink.as_ref() {
                    if sink.empty() {
                        current_sink = None;
                        let _ = app_handle.emit("audio-ended", ());
                    }
                }

                // Target ~20Hz polling frequency (50ms)
                let elapsed = start_loop.elapsed();
                if elapsed < Duration::from_millis(50) {
                    thread::sleep(Duration::from_millis(50) - elapsed);
                }
            }
        });

        Self { tx }
    }

    /// Requests the background thread to play a file from the given path.
    pub fn play(&self, path: &str) -> Result<(), FabaError> {
        self.tx
            .send(AudioCommand::Play(path.to_string()))
            .map_err(|_| FabaError::Custom("Audio thread disconnected".into()))
    }

    /// Requests the background thread to stop all current playback.
    pub fn stop(&self) -> Result<(), FabaError> {
        self.tx
            .send(AudioCommand::Stop)
            .map_err(|_| FabaError::Custom("Audio thread disconnected".into()))
    }
}

#[tauri::command]
pub async fn play_audio_native(
    state: State<'_, AudioEngine>,
    path: String,
) -> Result<(), FabaError> {
    state.play(&path)
}

#[tauri::command]
pub async fn stop_audio_native(
    state: State<'_, AudioEngine>,
) -> Result<(), FabaError> {
    state.stop()
}
