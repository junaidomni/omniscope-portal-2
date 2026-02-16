import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search as SearchIcon, Calendar, User, Building2, MapPin } from "lucide-react";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLead, setSelectedLead] = useState<string | undefined>();
  
  const { data: meetings, isLoading: meetingsLoading } = trpc.meetings.list.useQuery({
    primaryLead: selectedLead,
    limit: 20,
    offset: 0,
  }, {
    enabled: isAuthenticated,
  });

  const { data: users } = trpc.users.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mb-4">
              <h1 className="text-3xl font-bold text-primary">OmniScope</h1>
              <p className="text-sm text-muted-foreground mt-1">Intelligence Portal</p>
            </div>
            <CardTitle>Secure Access Required</CardTitle>
            <CardDescription>
              This portal is restricted to authorized OmniScope team members.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() => window.location.href = getLoginUrl()}
            >
              Sign In with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Call Intelligence Reports</h1>
          <p className="text-muted-foreground mt-1">
            All Markets. One Scope.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search meetings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant={selectedLead === undefined ? "default" : "outline"}
              onClick={() => setSelectedLead(undefined)}
            >
              All
            </Button>
            {users?.map((u) => (
              <Button
                key={u.id}
                variant={selectedLead === u.name ? "default" : "outline"}
                onClick={() => setSelectedLead(u.name || undefined)}
              >
                {u.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Meetings List */}
        {meetingsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : meetings && meetings.length > 0 ? (
          <div className="grid gap-4">
            {meetings.map((meeting) => {
              const participants = JSON.parse(meeting.participants || '[]');
              const organizations = JSON.parse(meeting.organizations || '[]');
              
              return (
                <Link key={meeting.id} href={`/meeting/${meeting.id}`}>
                  <Card className="hover:border-primary transition-colors cursor-pointer">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {formatDate(meeting.meetingDate)}
                            </span>
                            <Badge variant="outline" className="ml-2">
                              {meeting.sourceType}
                            </Badge>
                          </div>
                          <CardTitle className="text-xl">
                            Meeting with {organizations.length > 0 ? organizations.join(', ') : participants.join(', ')}
                          </CardTitle>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          <span>{meeting.primaryLead}</span>
                        </div>
                        {organizations.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Building2 className="h-4 w-4" />
                            <span>{organizations.length} {organizations.length === 1 ? 'organization' : 'organizations'}</span>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-foreground line-clamp-2">
                        {meeting.executiveSummary}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No meetings found. Start by creating your first meeting report.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
