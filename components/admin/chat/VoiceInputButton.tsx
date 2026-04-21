"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";

import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type VoiceInputButtonProps = {
  disabled?: boolean;
  onTranscript: (text: string) => void;
};

/**
 * Mic button that records audio via MediaRecorder and POSTs it to the
 * transcribe endpoint. The resulting text is passed back via onTranscript so
 * the parent can append it to the message input.
 *
 * Browser support: MediaRecorder works on Chrome, Edge, Firefox, Safari 14.1+.
 * The chosen mimeType falls back gracefully — Chrome produces webm/opus,
 * Safari produces mp4/aac. Whisper accepts both.
 */
export function VoiceInputButton({
  disabled,
  onTranscript
}: VoiceInputButtonProps) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      // Clean up any live stream on unmount
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function pickMimeType(): string | undefined {
    if (typeof MediaRecorder === "undefined") return undefined;
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus"
    ];
    for (const type of candidates) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return undefined;
  }

  async function startRecording() {
    if (recording || transcribing) return;

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      toast.error("Microphone access is not available in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      });

      recorder.addEventListener("stop", () => {
        void handleRecordingStop(recorder.mimeType || "audio/webm");
      });

      recorder.start();
      setRecording(true);
    } catch (error) {
      const message =
        error instanceof Error && error.name === "NotAllowedError"
          ? "Microphone permission denied. Enable it in your browser settings."
          : "Could not start recording.";
      toast.error(message);
      stopTracks();
    }
  }

  function stopTracks() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }

  async function handleRecordingStop(mimeType: string) {
    setRecording(false);
    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];
    stopTracks();

    if (blob.size === 0) {
      toast.error("No audio was captured.");
      return;
    }

    setTranscribing(true);
    try {
      const ext =
        mimeType.includes("mp4") ? "mp4"
        : mimeType.includes("ogg") ? "ogg"
        : "webm";
      const formData = new FormData();
      formData.append("audio", blob, `recording.${ext}`);

      const response = await fetchWithCsrf("/api/admin/chat/transcribe", {
        method: "POST",
        body: formData
      });

      const data = (await response.json()) as {
        text?: string;
        error?: string;
        hint?: string;
      };

      if (!response.ok) {
        toast.error(data.error || "Failed to transcribe audio.");
        return;
      }

      const text = (data.text || "").trim();
      if (!text) {
        toast.error("Didn't catch that — try speaking again.");
        return;
      }

      onTranscript(text);
    } catch {
      toast.error("Failed to transcribe audio.");
    } finally {
      setTranscribing(false);
    }
  }

  function stopRecording() {
    if (!recording) return;
    recorderRef.current?.stop();
  }

  const busy = transcribing;
  const active = recording;

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      disabled={disabled || busy}
      onClick={() => (active ? stopRecording() : void startRecording())}
      className={cn(
        "h-11 w-11 shrink-0",
        active && "text-steel-bright"
      )}
      title={
        active
          ? "Stop recording"
          : busy
            ? "Transcribing..."
            : "Record voice message"
      }
      aria-label={active ? "Stop recording" : "Record voice message"}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : active ? (
        <Square className="h-4 w-4 fill-current" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
}
