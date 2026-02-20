import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { OrgProvider, useOrg } from "./contexts/OrgContext";
import PortalLayout from "./components/PortalLayout";
import AdminLayout from "./components/AdminLayout";

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
import OrgOnboarding from "./pages/OrgOnboarding";
import Organizations from "./pages/Organizations";

// Admin Hub pages
import AdminHubDashboard from "./pages/admin-hub/Dashboard";
import AdminHubOrganizations from "./pages/admin-hub/Organizations";
import AdminHubPeople from "./pages/admin-hub/People";
import AdminHubIntegrations from "./pages/admin-hub/Integrations";
import AdminHubFeatures from "./pages/admin-hub/Features";
import AdminHubAudit from "./pages/admin-hub/AuditLog";
import AdminHubAnalytics from "./pages/admin-hub/Analytics";
import AdminHubHealth from "./pages/admin-hub/Health";
import AdminHubSettings from "./pages/admin-hub/Settings";

/**
 * Workspace Router — the standard PortalLayout shell.
 * Active when a specific org is selected.
 */
function WorkspaceRouter() {
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
        <Route path="/org/new" component={OrgOnboarding} />
        <Route path="/organizations" component={Organizations} />
        <Route path="/hr" component={HRHub} />
        <Route path="/hr/employee/:id" component={EmployeeProfile} />
        <Route path="/hr/payroll" component={PayrollHub} />
        <Route path="/admin" component={AdminPanel} />
        <Route path="/admin/users" component={UserManagement} />
        <Route path="/admin/activity-log" component={ActivityLog} />
        <Route path="/admin/dedup" component={DedupSweep} />
        <Route path="/access-denied" component={AccessDenied} />

        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </PortalLayout>
  );
}

/**
 * Admin Hub Router — the Super Admin shell.
 * Active when "All Organizations" is selected (currentOrg === null)
 * or when navigating to /admin-hub/* routes directly.
 */
function AdminHubRouter() {
  return (
    <AdminLayout>
      <Switch>
        <Route path="/admin-hub" component={AdminHubDashboard} />
        <Route path="/admin-hub/organizations" component={AdminHubOrganizations} />
        <Route path="/admin-hub/people" component={AdminHubPeople} />
        <Route path="/admin-hub/integrations" component={AdminHubIntegrations} />
        <Route path="/admin-hub/features" component={AdminHubFeatures} />
        <Route path="/admin-hub/audit" component={AdminHubAudit} />
        <Route path="/admin-hub/analytics" component={AdminHubAnalytics} />
        <Route path="/admin-hub/health" component={AdminHubHealth} />
        <Route path="/admin-hub/settings" component={AdminHubSettings} />
        <Route component={AdminHubDashboard} />
      </Switch>
    </AdminLayout>
  );
}

/**
 * Shell Switcher — determines which shell to render based on
 * the current org context and the URL path.
 */
function ShellSwitcher() {
  const [location] = useLocation();
  const { currentOrg } = useOrg();

  // If the URL is an /admin-hub/* route, always show AdminLayout
  if (location.startsWith("/admin-hub")) {
    return <AdminHubRouter />;
  }

  // If no org is selected (All Organizations mode), redirect to admin hub
  if (currentOrg === null && location === "/") {
    // Redirect to admin hub dashboard
    window.location.replace("/admin-hub");
    return null;
  }

  // Default: workspace mode
  return <WorkspaceRouter />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <OrgProvider>
            <Toaster />
            <ShellSwitcher />
          </OrgProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
