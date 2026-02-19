import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import PortalLayout from "./components/PortalLayout";

// Domain wrappers
import CommandCenter from "./pages/domains/CommandCenter";
import Intelligence from "./pages/domains/Intelligence";
import Communications from "./pages/domains/Communications";
import Operations from "./pages/domains/Operations";
import Relationships from "./pages/domains/Relationships";

// Standalone pages (not wrapped in domain tabs)
import AskOmniScope from "./pages/AskOmniScope";
import AdminPanel from "./pages/AdminPanel";
import UserManagement from "./pages/UserManagement";
import AccessDenied from "./pages/AccessDenied";
import Onboarding from "./pages/Onboarding";
import HRHub from "./pages/HRHub";
import EmployeeProfile from "./pages/EmployeeProfile";
import PayrollHub from "./pages/PayrollHub";
import Setup from "./pages/Setup";
import ActivityLog from "./pages/ActivityLog";
import DedupSweep from "./pages/DedupSweep";

function Router() {
  return (
    <PortalLayout>
      <Switch>
        {/* Command Center domain */}
        <Route path="/" component={CommandCenter} />
        <Route path="/overview" component={CommandCenter} />
        <Route path="/reports/daily" component={CommandCenter} />
        <Route path="/reports/weekly" component={CommandCenter} />

        {/* Intelligence domain */}
        <Route path="/intelligence" component={Intelligence} />
        <Route path="/meetings" component={Intelligence} />
        <Route path="/meeting/:id" component={Intelligence} />
        <Route path="/vault" component={Intelligence} />
        <Route path="/vault/doc/:id" component={Intelligence} />
        <Route path="/templates" component={Intelligence} />
        <Route path="/pipeline" component={Intelligence} />

        {/* Communications domain */}
        <Route path="/communications" component={Communications} />
        <Route path="/mail" component={Communications} />
        <Route path="/mail/analytics" component={Communications} />
        <Route path="/calendar" component={Communications} />

        {/* Operations domain */}
        <Route path="/operations" component={Operations} />
        <Route path="/tasks" component={Operations} />

        {/* Relationships domain */}
        <Route path="/relationships" component={Relationships} />
        <Route path="/contacts" component={Relationships} />
        <Route path="/contact/:id" component={Relationships} />
        <Route path="/companies" component={Relationships} />
        <Route path="/company/:id" component={Relationships} />
        <Route path="/pending-review" component={Relationships} />

        {/* Standalone pages */}
        <Route path="/ask" component={AskOmniScope} />
        <Route path="/setup" component={Setup} />
        <Route path="/integrations">{() => { window.location.href = "/setup?tab=integrations"; return null; }}</Route>
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/hr" component={HRHub} />
        <Route path="/hr/employee/:id" component={EmployeeProfile} />
        <Route path="/hr/payroll" component={PayrollHub} />
        <Route path="/admin" component={AdminPanel} />
        <Route path="/admin/users" component={UserManagement} />
        <Route path="/admin/activity-log" component={ActivityLog} />
        <Route path="/admin/dedup" component={DedupSweep} />
        <Route path="/access-denied" component={AccessDenied} />

        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </PortalLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
