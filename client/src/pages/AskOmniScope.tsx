import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Loader2, Calendar, Users, Building2 } from "lucide-react";
import { Link } from "wouter";

export default function AskOmniScope() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any>(null);
  
  const askMutation = trpc.ask.ask.useMutation({
    onSuccess: (data) => {
      setResults(data);
    },
  });

  const handleAsk = () => {
    if (!query.trim()) return;
    askMutation.mutate({ query });
  };

  const handleSuggestedQuestion = (question: string) => {
    setQuery(question);
    askMutation.mutate({ query: question });
  };

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 mb-4">
          <Sparkles className="h-8 w-8 text-yellow-600" />
          <h1 className="text-4xl font-bold text-white">Ask OmniScope</h1>
        </div>
        <p className="text-zinc-400 text-lg">
          Search your intelligence vault with natural language
        </p>
      </div>

      {/* Search Input */}
      <Card className="bg-zinc-900/50 border-zinc-800 mb-8">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
              placeholder="Ask anything... e.g., 'Show me all meetings with Obi' or 'What opportunities did we identify in Dubai?'"
              className="flex-1 bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-yellow-600"
              disabled={askMutation.isPending}
            />
            <Button
              onClick={handleAsk}
              disabled={!query.trim() || askMutation.isPending}
              className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium"
            >
              {askMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Ask
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Example Questions */}
      {!results && !askMutation.isPending && (
        <Card className="bg-zinc-900/50 border-zinc-800 mb-8">
          <CardHeader>
            <CardTitle className="text-lg text-white">Try asking...</CardTitle>
            <CardDescription className="text-zinc-400">Click any question to search</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                "Show me all meetings with Paul",
                "What opportunities did we identify in UAE?",
                "Find meetings about OTC Liquidity",
                "What risks were mentioned in banking discussions?",
                "Show me meetings from this week",
                "Find all discussions with family offices",
              ].map((question, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestedQuestion(question)}
                  className="text-left p-3 rounded-lg bg-zinc-800/30 border border-zinc-800 hover:border-yellow-600/30 hover:bg-zinc-800/50 transition-all text-sm text-zinc-300"
                >
                  {question}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-6">
          {/* Answer */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-600" />
                Answer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-zinc-300 leading-relaxed">{results.answer}</p>
            </CardContent>
          </Card>

          {/* Relevant Meetings */}
          {results.meetings && results.meetings.length > 0 && (
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg text-white">
                  Relevant Meetings ({results.meetings.length})
                </CardTitle>
                <CardDescription className="text-zinc-400">
                  Click any meeting to view full details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {results.meetings.map((meeting: any) => (
                    <Link key={meeting.id} href={`/meeting/${meeting.id}`}>
                      <div className="p-4 rounded-lg bg-zinc-800/30 border border-zinc-800 hover:border-yellow-600/30 hover:bg-zinc-800/50 transition-all cursor-pointer">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="text-white font-medium mb-1">
                              {meeting.participants.join(', ')}
                            </h4>
                            <div className="flex items-center gap-3 text-xs text-zinc-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(meeting.meetingDate).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </span>
                              {meeting.participants.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {meeting.participants.length} participants
                                </span>
                              )}
                            </div>
                          </div>
                          {meeting.organizations && meeting.organizations.length > 0 && (
                            <Badge variant="outline" className="border-zinc-700 text-zinc-400">
                              <Building2 className="h-3 w-3 mr-1" />
                              {meeting.organizations[0]}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-zinc-400 line-clamp-2">
                          {meeting.executiveSummary}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Suggested Follow-up Questions */}
          {results.suggestedQuestions && results.suggestedQuestions.length > 0 && (
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg text-white">You might also want to ask...</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {results.suggestedQuestions.map((question: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestedQuestion(question)}
                      className="w-full text-left p-3 rounded-lg bg-zinc-800/30 border border-zinc-800 hover:border-yellow-600/30 hover:bg-zinc-800/50 transition-all text-sm text-zinc-300"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Error State */}
      {askMutation.isError && (
        <Card className="bg-red-900/20 border-red-800">
          <CardContent className="pt-6">
            <p className="text-red-400">
              Failed to process your question. Please try again.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
