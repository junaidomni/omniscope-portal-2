import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import PortalLayout from "./components/PortalLayout";
import Dashboard from "./pages/Dashboard";
import MeetingDetail from "./pages/MeetingDetail";
import Meetings from "./pages/Meetings";
import ToDo from "./pages/ToDo";
import AskOmniScope from "./pages/AskOmniScope";
import CalendarView from "./pages/CalendarView";
import AdminPanel from "./pages/AdminPanel";
import UserManagement from "./pages/UserManagement";
import AccessDenied from "./pages/AccessDenied";
import DailyReport from "./pages/DailyReport";
import WeeklyReport from "./pages/WeeklyReport";
import ContactProfile from "./pages/ContactProfile";
import Contacts from "./pages/Contacts";
import Onboarding from "./pages/Onboarding";
import HRHub from "./pages/HRHub";
import EmployeeProfile from "./pages/EmployeeProfile";
import PayrollHub from "./pages/PayrollHub";
import Companies from "./pages/Companies";
import CompanyProfile from "./pages/CompanyProfile";
import MailModule from "./pages/MailModule";
import Setup from "./pages/Setup";

function Router() {
  return (
    <PortalLayout>
      <Switch>
        <Route path={"/"} component={Dashboard} />
        <Route path="/meetings" component={Meetings} />
        <Route path="/meeting/:id" component={MeetingDetail} />
        <Route path="/contacts" component={Contacts} />
        <Route path="/contact/:id" component={ContactProfile} />
        <Route path="/companies" component={Companies} />
        <Route path="/company/:id" component={CompanyProfile} />
        <Route path="/mail" component={MailModule} />
        <Route path="/setup" component={Setup} />
        <Route path="/integrations">{() => { window.location.href = "/setup?tab=integrations"; return null; }}</Route>
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/tasks" component={ToDo} />
        <Route path="/hr" component={HRHub} />
        <Route path="/hr/employee/:id" component={EmployeeProfile} />
        <Route path="/hr/payroll" component={PayrollHub} />
          <Route path="/ask" component={AskOmniScope} />
          <Route path="/calendar" component={CalendarView} />
          <Route path="/admin" component={AdminPanel} />
          <Route path="/admin/users" component={UserManagement} />
          <Route path="/reports/daily" component={DailyReport} />
          <Route path="/reports/weekly" component={WeeklyReport} />
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
