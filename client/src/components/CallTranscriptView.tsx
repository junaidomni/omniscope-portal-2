import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Sparkles, X, RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";

interface CallTranscriptViewProps {
  callId: number;
  transcriptUrl?: string | null;
  summaryUrl?: string | null;
  onClose: () => void;
}

export function CallTranscriptView({ callId, transcriptUrl, summaryUrl, onClose }: CallTranscriptViewProps) {
  const [transcript, setTranscript] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const transcribeMutation = trpc.communications.transcribeCall.useMutation({
    onSuccess: (data) => {
      setTranscript(data.transcript);
      toast.success("Transcript generated successfully");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const summarizeMutation = trpc.communications.generateCallSummary.useMutation({
    onSuccess: (data) => {
      setSummary(data.summary);
      toast.success("Summary generated successfully");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Load existing transcript
  useState(() => {
    if (transcriptUrl) {
      setLoadingTranscript(true);
      fetch(transcriptUrl)
        .then((res) => res.json())
        .then((data) => {
          setTranscript(data);
          setLoadingTranscript(false);
        })
        .catch(() => {
          setLoadingTranscript(false);
        });
    }
  });

  // Load existing summary
  useState(() => {
    if (summaryUrl) {
      setLoadingSummary(true);
      fetch(summaryUrl)
        .then((res) => res.json())
        .then((data) => {
          setSummary(data);
          setLoadingSummary(false);
        })
        .catch(() => {
          setLoadingSummary(false);
        });
    }
  });

  const handleTranscribe = () => {
    transcribeMutation.mutate({ callId });
  };

  const handleSummarize = () => {
    summarizeMutation.mutate({ callId });
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[600px] bg-background border-l border-border shadow-lg z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-lg">Call Transcript & Summary</h2>
          <p className="text-sm text-muted-foreground">
            View transcript and AI-generated summary
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <Tabs defaultValue="transcript" className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-4">
          <TabsTrigger value="transcript" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Transcript
          </TabsTrigger>
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Summary
          </TabsTrigger>
        </TabsList>

        {/* Transcript Tab */}
        <TabsContent value="transcript" className="flex-1 flex flex-col mt-0">
          <ScrollArea className="flex-1 p-4">
            {!transcript && !transcriptUrl ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">No transcript available</p>
                <Button
                  onClick={handleTranscribe}
                  disabled={transcribeMutation.isPending}
                >
                  {transcribeMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Transcribing...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Generate Transcript
                    </>
                  )}
                </Button>
              </div>
            ) : loadingTranscript ? (
              <div className="text-center py-12">
                <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground">Loading transcript...</p>
              </div>
            ) : transcript ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">
                    {transcript.language?.toUpperCase() || "EN"}
                  </Badge>
                  <Button size="sm" variant="ghost">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
                <Separator />
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="whitespace-pre-wrap">{transcript.text}</p>
                </div>
                {transcript.segments && transcript.segments.length > 0 && (
                  <div className="mt-6">
                    <h3 className="font-semibold mb-3">Timestamped Segments</h3>
                    <div className="space-y-2">
                      {transcript.segments.map((segment: any, idx: number) => (
                        <Card key={idx} className="p-3">
                          <div className="flex items-start gap-3">
                            <Badge variant="secondary" className="text-xs">
                              {Math.floor(segment.start / 60)}:{String(Math.floor(segment.start % 60)).padStart(2, "0")}
                            </Badge>
                            <p className="text-sm flex-1">{segment.text}</p>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </ScrollArea>
        </TabsContent>

        {/* Summary Tab */}
        <TabsContent value="summary" className="flex-1 flex flex-col mt-0">
          <ScrollArea className="flex-1 p-4">
            {!summary && !summaryUrl ? (
              <div className="text-center py-12">
                <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">
                  {!transcript && !transcriptUrl
                    ? "Generate transcript first"
                    : "No summary available"}
                </p>
                <Button
                  onClick={handleSummarize}
                  disabled={summarizeMutation.isPending || (!transcript && !transcriptUrl)}
                >
                  {summarizeMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Summary
                    </>
                  )}
                </Button>
              </div>
            ) : loadingSummary ? (
              <div className="text-center py-12">
                <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground">Loading summary...</p>
              </div>
            ) : summary ? (
              <div className="space-y-6">
                {/* Overview */}
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Overview
                  </h3>
                  <p className="text-sm text-muted-foreground">{summary.overview}</p>
                </div>

                <Separator />

                {/* Key Points */}
                {summary.keyPoints && summary.keyPoints.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Key Points</h3>
                    <ul className="space-y-2">
                      {summary.keyPoints.map((point: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-amber-500 mt-1">•</span>
                          <span className="text-sm">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Decisions */}
                {summary.decisions && summary.decisions.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Decisions Made</h3>
                    <div className="space-y-2">
                      {summary.decisions.map((decision: string, idx: number) => (
                        <Card key={idx} className="p-3 bg-blue-500/5 border-blue-500/20">
                          <p className="text-sm">{decision}</p>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Items */}
                {summary.actionItems && summary.actionItems.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Action Items</h3>
                    <div className="space-y-2">
                      {summary.actionItems.map((item: any, idx: number) => (
                        <Card key={idx} className="p-3 bg-green-500/5 border-green-500/20">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm flex-1">{item.task}</p>
                            {item.assignee && (
                              <Badge variant="outline" className="text-xs">
                                {item.assignee}
                              </Badge>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Generated {new Date(summary.generatedAt).toLocaleString()}</span>
                  <Button size="sm" variant="ghost">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            ) : null}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
