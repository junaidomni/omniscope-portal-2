import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload, FileText, Mic, FileJson, ArrowLeft, CheckCircle2,
  Loader2, AlertCircle, Sparkles, Calendar, Users, X, Plus,
  FileAudio, ClipboardPaste
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

type UploadMode = "text" | "file" | "audio";
type ProcessingStage = "idle" | "uploading" | "transcribing" | "analyzing" | "ingesting" | "complete" | "error";

const ACCEPTED_TEXT_FILES = ".txt,.md,.json,.csv";
const ACCEPTED_AUDIO_FILES = ".mp3,.wav,.webm,.ogg,.m4a";
const MAX_AUDIO_SIZE = 16 * 1024 * 1024; // 16MB

export default function TranscriptUpload() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<UploadMode>("text");
  const [stage, setStage] = useState<ProcessingStage>("idle");
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [transcriptText, setTranscriptText] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split("T")[0]);
  const [participants, setParticipants] = useState<string[]>([]);
  const [newParticipant, setNewParticipant] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Result state
  const [result, setResult] = useState<{
    meetingId?: number;
    brandedReportUrl?: string | null;
    transcriptLength?: number;
  } | null>(null);

  // Refs
  const textFileRef = useRef<HTMLInputElement>(null);
  const audioFileRef = useRef<HTMLInputElement>(null);

  // Mutations
  const uploadTranscript = trpc.ingestion.uploadTranscript.useMutation();
  const uploadAudioFile = trpc.ingestion.uploadAudioFile.useMutation();

  const addParticipant = useCallback(() => {
    const name = newParticipant.trim();
    if (name && !participants.includes(name)) {
      setParticipants(prev => [...prev, name]);
      setNewParticipant("");
    }
  }, [newParticipant, participants]);

  const removeParticipant = useCallback((name: string) => {
    setParticipants(prev => prev.filter(p => p !== name));
  }, []);

  const handleTextFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setTranscriptText(text);
      if (!meetingTitle) {
        // Auto-generate title from filename
        const name = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        setMeetingTitle(name);
      }
    };
    reader.readAsText(file);
  }, [meetingTitle]);

  const handleAudioFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_AUDIO_SIZE) {
      toast.error("Audio file must be under 16MB");
      return;
    }

    setSelectedFile(file);
    if (!meetingTitle) {
      const name = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setMeetingTitle(name);
    }
  }, [meetingTitle]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const isAudio = /\.(mp3|wav|webm|ogg|m4a)$/i.test(file.name);
    const isText = /\.(txt|md|json|csv)$/i.test(file.name);

    if (isAudio) {
      if (file.size > MAX_AUDIO_SIZE) {
        toast.error("Audio file must be under 16MB");
        return;
      }
      setMode("audio");
      setSelectedFile(file);
      if (!meetingTitle) {
        setMeetingTitle(file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));
      }
    } else if (isText) {
      setMode("file");
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setTranscriptText(ev.target?.result as string);
        if (!meetingTitle) {
          setMeetingTitle(file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));
        }
      };
      reader.readAsText(file);
    } else {
      toast.error("Unsupported file type. Use .txt, .md, .json, .csv, .mp3, .wav, .webm, .ogg, or .m4a");
    }
  }, [meetingTitle]);

  const handleSubmit = useCallback(async () => {
    setError(null);
    setResult(null);

    try {
      if (mode === "audio" && selectedFile) {
        // Step 1: Upload audio to S3
        setStage("uploading");
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]); // Remove data:...;base64, prefix
          };
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
        });

        const uploadResult = await uploadAudioFile.mutateAsync({
          fileName: selectedFile.name,
          fileData: base64,
          mimeType: selectedFile.type || "audio/mpeg",
        });

        // Step 2: Process through pipeline (audio → Whisper → LLM → ingestion)
        setStage("transcribing");
        await new Promise(r => setTimeout(r, 500)); // Brief visual pause
        setStage("analyzing");

        const processResult = await uploadTranscript.mutateAsync({
          content: uploadResult.url,
          inputType: "audio",
          meetingTitle: meetingTitle || undefined,
          meetingDate: meetingDate || undefined,
          participants: participants.length > 0 ? participants : undefined,
        });

        if (processResult.success) {
          setStage("complete");
          setResult(processResult);
          toast.success("Meeting processed successfully!");
        } else {
          setStage("error");
          setError(processResult.reason || "Processing failed");
        }
      } else {
        // Text or file mode
        const content = transcriptText.trim();
        if (content.length < 20) {
          toast.error("Please provide at least 20 characters of transcript content");
          return;
        }

        // Detect input type
        let inputType: "text" | "plaud_json" = "text";
        try {
          const parsed = JSON.parse(content);
          if (parsed && typeof parsed === "object" && (parsed.executiveSummary || parsed.participants)) {
            inputType = "plaud_json";
          }
        } catch {
          // Not JSON, that's fine
        }

        setStage("analyzing");

        const processResult = await uploadTranscript.mutateAsync({
          content,
          inputType,
          meetingTitle: meetingTitle || undefined,
          meetingDate: meetingDate || undefined,
          participants: participants.length > 0 ? participants : undefined,
        });

        if (processResult.success) {
          setStage("complete");
          setResult(processResult);
          toast.success("Meeting processed successfully!");
        } else {
          setStage("error");
          setError(processResult.reason || "Processing failed");
        }
      }
    } catch (err: any) {
      setStage("error");
      setError(err.message || "An unexpected error occurred");
      toast.error("Processing failed");
    }
  }, [mode, selectedFile, transcriptText, meetingTitle, meetingDate, participants, uploadAudioFile, uploadTranscript]);

  const resetForm = useCallback(() => {
    setStage("idle");
    setError(null);
    setResult(null);
    setTranscriptText("");
    setMeetingTitle("");
    setMeetingDate(new Date().toISOString().split("T")[0]);
    setParticipants([]);
    setSelectedFile(null);
  }, []);

  const isProcessing = ["uploading", "transcribing", "analyzing", "ingesting"].includes(stage);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/intelligence">
          <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Upload Transcript</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Upload a meeting transcript, recording, or Plaud export to generate intelligence
          </p>
        </div>
      </div>

      {/* Processing State */}
      {stage !== "idle" && stage !== "error" && (
        <Card className="bg-zinc-900/50 border-zinc-800 mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              {stage === "complete" ? (
                <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                </div>
              ) : (
                <div className="h-12 w-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 text-yellow-400 animate-spin" />
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  {["uploading", "transcribing", "analyzing", "complete"].map((s, i) => (
                    <div key={s} className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${
                        stage === s ? "bg-yellow-400 animate-pulse" :
                        ["uploading", "transcribing", "analyzing", "ingesting", "complete"].indexOf(stage) > i ? "bg-emerald-400" :
                        "bg-zinc-700"
                      }`} />
                      <span className={`text-xs ${
                        stage === s ? "text-yellow-400" :
                        ["uploading", "transcribing", "analyzing", "ingesting", "complete"].indexOf(stage) > i ? "text-emerald-400" :
                        "text-zinc-600"
                      }`}>
                        {s === "uploading" ? "Upload" : s === "transcribing" ? "Transcribe" : s === "analyzing" ? "Analyze" : "Done"}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-zinc-400">
                  {stage === "uploading" && "Uploading file to secure storage..."}
                  {stage === "transcribing" && "Transcribing audio with Whisper AI..."}
                  {stage === "analyzing" && "Running LLM intelligence analysis..."}
                  {stage === "ingesting" && "Ingesting into intelligence database..."}
                  {stage === "complete" && "Processing complete!"}
                </p>
              </div>
            </div>

            {/* Result */}
            {stage === "complete" && result && (
              <div className="mt-4 pt-4 border-t border-zinc-800">
                <div className="flex items-center gap-4">
                  {result.meetingId && (
                    <Link href={`/meeting/${result.meetingId}`}>
                      <Button className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium">
                        <FileText className="h-4 w-4 mr-2" />
                        View Intelligence Report
                      </Button>
                    </Link>
                  )}
                  <Button variant="outline" onClick={resetForm} className="border-zinc-700 text-zinc-400 hover:text-white">
                    Upload Another
                  </Button>
                </div>
                {result.transcriptLength && (
                  <p className="text-xs text-zinc-600 mt-2">
                    Processed {result.transcriptLength.toLocaleString()} characters of transcript
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {stage === "error" && error && (
        <Card className="bg-red-500/10 border-red-500/30 mb-6">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-red-300 font-medium">Processing Failed</p>
              <p className="text-xs text-red-400/80 mt-1">{error}</p>
              <Button variant="ghost" size="sm" onClick={resetForm} className="mt-2 text-red-400 hover:text-red-300">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Form */}
      {(stage === "idle" || stage === "error") && (
        <>
          {/* Input Mode Tabs */}
          <Tabs value={mode} onValueChange={(v) => { setMode(v as UploadMode); setSelectedFile(null); setTranscriptText(""); }}>
            <TabsList className="bg-zinc-900 border border-zinc-800 mb-6">
              <TabsTrigger value="text" className="data-[state=active]:bg-yellow-600/20 data-[state=active]:text-yellow-500">
                <ClipboardPaste className="h-4 w-4 mr-2" />
                Paste Text
              </TabsTrigger>
              <TabsTrigger value="file" className="data-[state=active]:bg-yellow-600/20 data-[state=active]:text-yellow-500">
                <FileText className="h-4 w-4 mr-2" />
                Upload File
              </TabsTrigger>
              <TabsTrigger value="audio" className="data-[state=active]:bg-yellow-600/20 data-[state=active]:text-yellow-500">
                <Mic className="h-4 w-4 mr-2" />
                Audio Recording
              </TabsTrigger>
            </TabsList>

            {/* Paste Text */}
            <TabsContent value="text">
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-white flex items-center gap-2">
                    <ClipboardPaste className="h-4 w-4 text-yellow-500" />
                    Paste Transcript or Meeting Notes
                  </CardTitle>
                  <p className="text-xs text-zinc-500">
                    Paste raw transcript text, meeting notes, or Plaud JSON export. The LLM will extract intelligence automatically.
                  </p>
                </CardHeader>
                <CardContent>
                  <textarea
                    value={transcriptText}
                    onChange={(e) => setTranscriptText(e.target.value)}
                    placeholder={`Paste your meeting transcript here...\n\nExample formats:\n\n[00:00] Speaker 1: Welcome everyone to today's meeting...\n[00:15] Speaker 2: Thank you. Let's discuss the Q4 pipeline...\n\nOr just paste raw meeting notes — the AI will figure it out.`}
                    className="w-full h-64 bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-yellow-600/50 resize-y font-mono"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-zinc-600">
                      {transcriptText.length.toLocaleString()} characters
                    </span>
                    {transcriptText.length > 0 && transcriptText.length < 20 && (
                      <span className="text-xs text-yellow-500">Minimum 20 characters required</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Upload File */}
            <TabsContent value="file">
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-white flex items-center gap-2">
                    <FileText className="h-4 w-4 text-yellow-500" />
                    Upload Transcript File
                  </CardTitle>
                  <p className="text-xs text-zinc-500">
                    Upload a .txt, .md, .json, or .csv file containing your meeting transcript or Plaud export.
                  </p>
                </CardHeader>
                <CardContent>
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => textFileRef.current?.click()}
                    className="border-2 border-dashed border-zinc-700 hover:border-yellow-600/50 rounded-xl p-12 text-center cursor-pointer transition-colors"
                  >
                    {selectedFile ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                          <FileText className="h-6 w-6 text-yellow-400" />
                        </div>
                        <div>
                          <p className="text-sm text-white font-medium">{selectedFile.name}</p>
                          <p className="text-xs text-zinc-500 mt-1">
                            {(selectedFile.size / 1024).toFixed(1)} KB • {transcriptText.length.toLocaleString()} characters loaded
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setTranscriptText(""); }}
                          className="text-zinc-400 hover:text-white">
                          <X className="h-4 w-4 mr-1" /> Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-zinc-800 flex items-center justify-center">
                          <Upload className="h-6 w-6 text-zinc-500" />
                        </div>
                        <div>
                          <p className="text-sm text-zinc-400">
                            <span className="text-yellow-500 font-medium">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-zinc-600 mt-1">.txt, .md, .json, .csv</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <input
                    ref={textFileRef}
                    type="file"
                    accept={ACCEPTED_TEXT_FILES}
                    onChange={handleTextFileSelect}
                    className="hidden"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Audio Recording */}
            <TabsContent value="audio">
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-white flex items-center gap-2">
                    <Mic className="h-4 w-4 text-yellow-500" />
                    Upload Audio Recording
                  </CardTitle>
                  <p className="text-xs text-zinc-500">
                    Upload a Plaud recording or any audio file. It will be transcribed via Whisper AI, then analyzed.
                  </p>
                </CardHeader>
                <CardContent>
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => audioFileRef.current?.click()}
                    className="border-2 border-dashed border-zinc-700 hover:border-yellow-600/50 rounded-xl p-12 text-center cursor-pointer transition-colors"
                  >
                    {selectedFile ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                          <FileAudio className="h-6 w-6 text-yellow-400" />
                        </div>
                        <div>
                          <p className="text-sm text-white font-medium">{selectedFile.name}</p>
                          <p className="text-xs text-zinc-500 mt-1">
                            {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                          className="text-zinc-400 hover:text-white">
                          <X className="h-4 w-4 mr-1" /> Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-zinc-800 flex items-center justify-center">
                          <Mic className="h-6 w-6 text-zinc-500" />
                        </div>
                        <div>
                          <p className="text-sm text-zinc-400">
                            <span className="text-yellow-500 font-medium">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-zinc-600 mt-1">.mp3, .wav, .webm, .ogg, .m4a (max 16MB)</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <input
                    ref={audioFileRef}
                    type="file"
                    accept={ACCEPTED_AUDIO_FILES}
                    onChange={handleAudioFileSelect}
                    className="hidden"
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Meeting Metadata */}
          <Card className="bg-zinc-900/50 border-zinc-800 mt-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-yellow-500" />
                Meeting Details
                <Badge variant="outline" className="ml-2 text-xs border-zinc-700 text-zinc-500">Optional</Badge>
              </CardTitle>
              <p className="text-xs text-zinc-500">
                Pre-fill details to improve accuracy. The AI will extract what it can from the transcript.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-500 mb-1.5 block">Meeting Title</label>
                  <Input
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    placeholder="e.g., OmniScope x Acme Corp — Partnership Discussion"
                    className="bg-zinc-950 border-zinc-800 text-sm text-white placeholder:text-zinc-600"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1.5 block">Meeting Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input
                      type="date"
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      className="bg-zinc-950 border-zinc-800 text-sm text-white pl-10"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">
                  <Users className="h-3 w-3 inline mr-1" />
                  Participants
                </label>
                <div className="flex gap-2">
                  <Input
                    value={newParticipant}
                    onChange={(e) => setNewParticipant(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addParticipant())}
                    placeholder="Add participant name..."
                    className="bg-zinc-950 border-zinc-800 text-sm text-white placeholder:text-zinc-600"
                  />
                  <Button onClick={addParticipant} variant="outline" size="icon" className="border-zinc-700 shrink-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {participants.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {participants.map(p => (
                      <Badge key={p} variant="secondary" className="bg-zinc-800 text-zinc-300 gap-1">
                        {p}
                        <button onClick={() => removeParticipant(p)} className="ml-1 hover:text-red-400">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="mt-6 flex items-center justify-between">
            <p className="text-xs text-zinc-600">
              Your transcript will be analyzed by AI to extract intelligence, action items, and summaries.
            </p>
            <Button
              onClick={handleSubmit}
              disabled={isProcessing || (mode === "audio" ? !selectedFile : transcriptText.length < 20)}
              className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium px-6"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Process Transcript
                </>
              )}
            </Button>
          </div>

          {/* How It Works */}
          <Card className="bg-zinc-900/30 border-zinc-800/50 mt-8">
            <CardContent className="p-6">
              <h3 className="text-sm font-medium text-zinc-400 mb-4">How It Works</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { icon: Upload, title: "Upload", desc: "Paste text, upload a file, or drop an audio recording" },
                  { icon: Mic, title: "Transcribe", desc: "Audio files are transcribed via Whisper AI (text files skip this)" },
                  { icon: Sparkles, title: "Analyze", desc: "LLM extracts intelligence, action items, risks, and opportunities" },
                  { icon: FileText, title: "Report", desc: "Full intelligence report generated with branded PDF export" },
                ].map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="h-8 w-8 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0">
                      <step.icon className="h-4 w-4 text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-zinc-300">{step.title}</p>
                      <p className="text-xs text-zinc-600 mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
