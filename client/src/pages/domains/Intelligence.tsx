import DomainLayout from "@/components/DomainLayout";
import { Route, Switch } from "wouter";
import Meetings from "@/pages/Meetings";
import MeetingDetail from "@/pages/MeetingDetail";
import TranscriptUpload from "@/pages/TranscriptUpload";
import Vault from "@/pages/Vault";
import DocumentViewer from "@/pages/DocumentViewer";
import Templates from "@/pages/Templates";
import Pipeline from "@/pages/Pipeline";

const tabs = [
  { id: "meetings", label: "Meetings", path: "/intelligence", matchPaths: ["/intelligence", "/meeting", "/upload-transcript"] },
  { id: "vault", label: "Vault", path: "/vault", matchPaths: ["/vault", "/vault/doc"] },
  { id: "templates", label: "Templates", path: "/templates", matchPaths: ["/templates"] },
  { id: "pipeline", label: "Pipeline", path: "/pipeline", matchPaths: ["/pipeline"] },
];

export default function Intelligence() {
  return (
    <DomainLayout title="Intelligence" tabs={tabs}>
      <Switch>
        <Route path="/intelligence" component={Meetings} />
        <Route path="/meeting/:id" component={MeetingDetail} />
        <Route path="/upload-transcript" component={TranscriptUpload} />
        <Route path="/vault" component={Vault} />
        <Route path="/vault/doc/:id" component={DocumentViewer} />
        <Route path="/templates" component={Templates} />
        <Route path="/pipeline" component={Pipeline} />
      </Switch>
    </DomainLayout>
  );
}
