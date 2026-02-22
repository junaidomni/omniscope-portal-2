import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft, Edit2, Save, X, Upload, FileText, DollarSign,
  Calendar, Phone, Mail, MapPin, Briefcase, Building2, Loader2,
  Trash2, Download, AlertTriangle, User
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  inactive: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  terminated: "bg-red-500/20 text-red-400 border-red-500/30",
  on_leave: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const DOC_CATEGORIES = [
  { value: "contract", label: "Contract" },
  { value: "id_document", label: "ID Document" },
  { value: "tax_form", label: "Tax Form" },
  { value: "certification", label: "Certification" },
  { value: "onboarding", label: "Onboarding" },
  { value: "performance", label: "Performance" },
  { value: "payslip", label: "Payslip" },
  { value: "invoice", label: "Invoice" },
  { value: "receipt", label: "Receipt" },
  { value: "other", label: "Other" },
];

export default function EmployeeProfile() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const empId = Number(params.id);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [activeTab, setActiveTab] = useState("overview");

  const { data: employee, isLoading, refetch } = trpc.employees.getById.useQuery({ id: empId });
  const { data: payroll = [] } = trpc.payroll.getForEmployee.useQuery({ employeeId: empId });
  const { data: documents = [] } = trpc.hrDocuments.list.useQuery({ employeeId: empId });

  const updateMutation = trpc.employees.update.useMutation({
    onSuccess: () => { toast.success("Employee updated"); refetch(); setEditing(false); },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.employees.delete.useMutation({
    onSuccess: () => { toast.success("Employee deleted"); navigate("/hr"); },
    onError: (err) => toast.error(err.message),
  });
  const uploadPhotoMutation = trpc.employees.uploadPhoto.useMutation({
    onSuccess: () => { toast.success("Photo uploaded"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const photoInputRef = useRef<HTMLInputElement>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-600" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-zinc-400">Employee not found</p>
      </div>
    );
  }

  const startEdit = () => {
    setEditData({ ...employee });
    setEditing(true);
  };

  const saveEdit = () => {
    const { id, createdAt, updatedAt, payrollCount, documentCount, ...rest } = editData;
    updateMutation.mutate({ id: empId, ...rest });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("File too large (max 5MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadPhotoMutation.mutate({ id: empId, base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  };

  const tenure = () => {
    const hire = new Date(employee.hireDate);
    const now = new Date();
    const years = now.getFullYear() - hire.getFullYear();
    const months = now.getMonth() - hire.getMonth();
    if (years > 0) return `${years}y ${months >= 0 ? months : 12 + months}m`;
    return `${months >= 0 ? months : 12 + months}m`;
  };

  return (
    <div className="min-h-screen bg-black p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate("/hr")} className="text-zinc-400 hover:text-white">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
      </div>

      {/* Profile Header */}
      <div className="flex items-start gap-6 mb-8">
        <div className="relative group">
          <div className="h-24 w-24 rounded-xl bg-zinc-800 flex items-center justify-center overflow-hidden border-2 border-zinc-700">
            {employee.photoUrl ? (
              <img src={employee.photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-yellow-500">
                {employee.firstName?.[0]}{employee.lastName?.[0]}
              </span>
            )}
          </div>
          <button
            onClick={() => photoInputRef.current?.click()}
            className="absolute inset-0 bg-black/60 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          >
            <Upload className="h-5 w-5 text-white" />
          </button>
          <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-white">{employee.firstName} {employee.lastName}</h1>
            <Badge variant="outline" className={STATUS_COLORS[employee.status] || ""}>
              {employee.status?.replace("_", " ")}
            </Badge>
          </div>
          <p className="text-zinc-400">{employee.jobTitle}</p>
          {employee.department && <p className="text-zinc-500 text-sm">{employee.department}</p>}
          <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Hired {employee.hireDate}</span>
            <span>Tenure: {tenure()}</span>
            <span>{employee.payrollCount} payroll records</span>
            <span>{employee.documentCount} documents</span>
          </div>
        </div>

        <div className="flex gap-2">
          {editing ? (
            <>
              <Button onClick={saveEdit} className="bg-yellow-600 hover:bg-yellow-700 text-black" disabled={updateMutation.isPending}>
                <Save className="h-4 w-4 mr-2" /> Save
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)} className="border-zinc-700 text-zinc-400">
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={startEdit} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                <Edit2 className="h-4 w-4 mr-2" /> Edit
              </Button>
              <Button variant="outline" onClick={() => {
                if (confirm("Delete this employee? This cannot be undone.")) deleteMutation.mutate({ id: empId });
              }} className="border-red-800 text-red-400 hover:bg-red-900/30">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-zinc-900 border border-zinc-800 mb-6">
          <TabsTrigger value="overview" className="data-[state=active]:bg-yellow-600 data-[state=active]:text-black">Overview</TabsTrigger>
          <TabsTrigger value="documents" className="data-[state=active]:bg-yellow-600 data-[state=active]:text-black">Documents ({documents.length})</TabsTrigger>
          <TabsTrigger value="payroll" className="data-[state=active]:bg-yellow-600 data-[state=active]:text-black">Payroll ({payroll.length})</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview">
          <div className="grid grid-cols-2 gap-6">
            {/* Personal Info */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-yellow-500 flex items-center gap-2">
                  <User className="h-4 w-4" /> Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Email", field: "email", icon: Mail },
                  { label: "Phone", field: "phone", icon: Phone },
                  { label: "Date of Birth", field: "dateOfBirth", icon: Calendar },
                  { label: "Address", field: "address", icon: MapPin },
                  { label: "City", field: "city" },
                  { label: "State", field: "state" },
                  { label: "Country", field: "country" },
                ].map(({ label, field, icon: Icon }) => (
                  <div key={field} className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500 flex items-center gap-2">
                      {Icon && <Icon className="h-3 w-3" />} {label}
                    </span>
                    {editing ? (
                      <Input
                        value={editData[field] || ""}
                        onChange={(e) => setEditData((p: any) => ({ ...p, [field]: e.target.value }))}
                        className="w-48 h-7 text-xs bg-zinc-800 border-zinc-700 text-white"
                      />
                    ) : (
                      <span className="text-sm text-white">{(employee as any)[field] || "—"}</span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Employment Details */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-yellow-500 flex items-center gap-2">
                  <Briefcase className="h-4 w-4" /> Employment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Job Title", field: "jobTitle" },
                  { label: "Department", field: "department" },
                  { label: "Hire Date", field: "hireDate" },
                  { label: "Employment Type", field: "employmentType" },
                  { label: "Salary", field: "salary" },
                  { label: "Pay Frequency", field: "payFrequency" },
                  { label: "Currency", field: "currency" },
                ].map(({ label, field }) => (
                  <div key={field} className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">{label}</span>
                    {editing ? (
                      field === "employmentType" ? (
                        <Select value={editData[field] || ""} onValueChange={(v) => setEditData((p: any) => ({ ...p, [field]: v }))}>
                          <SelectTrigger className="w-48 h-7 text-xs bg-zinc-800 border-zinc-700 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-900 border-zinc-700">
                            <SelectItem value="full_time">Full Time</SelectItem>
                            <SelectItem value="part_time">Part Time</SelectItem>
                            <SelectItem value="contractor">Contractor</SelectItem>
                            <SelectItem value="intern">Intern</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : field === "status" ? (
                        <Select value={editData[field] || ""} onValueChange={(v) => setEditData((p: any) => ({ ...p, [field]: v }))}>
                          <SelectTrigger className="w-48 h-7 text-xs bg-zinc-800 border-zinc-700 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-900 border-zinc-700">
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                            <SelectItem value="on_leave">On Leave</SelectItem>
                            <SelectItem value="terminated">Terminated</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={editData[field] || ""}
                          onChange={(e) => setEditData((p: any) => ({ ...p, [field]: e.target.value }))}
                          className="w-48 h-7 text-xs bg-zinc-800 border-zinc-700 text-white"
                        />
                      )
                    ) : (
                      <span className="text-sm text-white">
                        {field === "employmentType" ? (employee as any)[field]?.replace("_", " ") : (employee as any)[field] || "—"}
                      </span>
                    )}
                  </div>
                ))}
                {/* Status (always show, editable) */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Status</span>
                  {editing ? (
                    <Select value={editData.status || ""} onValueChange={(v) => setEditData((p: any) => ({ ...p, status: v }))}>
                      <SelectTrigger className="w-48 h-7 text-xs bg-zinc-800 border-zinc-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-700">
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="on_leave">On Leave</SelectItem>
                        <SelectItem value="terminated">Terminated</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className={STATUS_COLORS[employee.status] || ""}>
                      {employee.status?.replace("_", " ")}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Emergency Contact */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-yellow-500 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Emergency Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Name", field: "emergencyContactName" },
                  { label: "Phone", field: "emergencyContactPhone" },
                  { label: "Relationship", field: "emergencyContactRelation" },
                ].map(({ label, field }) => (
                  <div key={field} className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">{label}</span>
                    {editing ? (
                      <Input
                        value={editData[field] || ""}
                        onChange={(e) => setEditData((p: any) => ({ ...p, [field]: e.target.value }))}
                        className="w-48 h-7 text-xs bg-zinc-800 border-zinc-700 text-white"
                      />
                    ) : (
                      <span className="text-sm text-white">{(employee as any)[field] || "—"}</span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Notes */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-yellow-500">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                {editing ? (
                  <textarea
                    value={editData.notes || ""}
                    onChange={(e) => setEditData((p: any) => ({ ...p, notes: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-md p-3 text-white text-sm min-h-[100px] focus:outline-none focus:ring-1 focus:ring-yellow-600"
                  />
                ) : (
                  <p className="text-sm text-zinc-300 whitespace-pre-wrap">{employee.notes || "No notes"}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* DOCUMENTS TAB */}
        <TabsContent value="documents">
          <DocumentsSection employeeId={empId} documents={documents} onRefetch={refetch} />
        </TabsContent>

        {/* PAYROLL TAB */}
        <TabsContent value="payroll">
          <PayrollSection employeeId={empId} payroll={payroll} employee={employee} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// DOCUMENTS SECTION

function DocumentsSection({ employeeId, documents, onRefetch }: { employeeId: number; documents: any[]; onRefetch: () => void }) {
  const [showUpload, setShowUpload] = useState(false);
  const [uploadData, setUploadData] = useState({ title: "", category: "other", notes: "" });
  const [file, setFile] = useState<File | null>(null);

  const uploadMutation = trpc.hrDocuments.upload.useMutation({
    onSuccess: () => { toast.success("Document uploaded"); onRefetch(); setShowUpload(false); setFile(null); setUploadData({ title: "", category: "other", notes: "" }); },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.hrDocuments.delete.useMutation({
    onSuccess: () => { toast.success("Document deleted"); onRefetch(); },
  });

  const handleUpload = async () => {
    if (!file || !uploadData.title) { toast.error("Title and file required"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("File too large (max 10MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMutation.mutate({
        employeeId,
        title: uploadData.title,
        category: uploadData.category as any,
        base64,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
        notes: uploadData.notes || undefined,
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-white">Documents</h3>
        <Dialog open={showUpload} onOpenChange={setShowUpload}>
          <DialogTrigger asChild>
            <Button className="bg-yellow-600 hover:bg-yellow-700 text-black">
              <Upload className="h-4 w-4 mr-2" /> Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-800">
            <DialogHeader>
              <DialogTitle className="text-white">Upload Document</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Title *</label>
                <Input value={uploadData.title} onChange={(e) => setUploadData(p => ({ ...p, title: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Category</label>
                <Select value={uploadData.category} onValueChange={(v) => setUploadData(p => ({ ...p, category: v }))}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    {DOC_CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">File *</label>
                <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Notes</label>
                <Input value={uploadData.notes} onChange={(e) => setUploadData(p => ({ ...p, notes: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
              <Button onClick={handleUpload} className="w-full bg-yellow-600 hover:bg-yellow-700 text-black" disabled={uploadMutation.isPending}>
                {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">No documents uploaded yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc: any) => (
            <div key={doc.id} className="flex items-center gap-4 p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
              <div className="h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                <FileText className="h-5 w-5 text-yellow-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm">{doc.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs">
                    {DOC_CATEGORIES.find(c => c.value === doc.category)?.label || doc.category}
                  </Badge>
                  {doc.fileName && <span className="text-xs text-zinc-500">{doc.fileName}</span>}
                  {doc.fileSize && <span className="text-xs text-zinc-600">{(doc.fileSize / 1024).toFixed(0)} KB</span>}
                </div>
              </div>
              <span className="text-xs text-zinc-500">{doc.uploadedByName}</span>
              <span className="text-xs text-zinc-600">{new Date(doc.createdAt).toLocaleDateString()}</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => window.open(doc.fileUrl, "_blank")} className="text-zinc-400 hover:text-white">
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => {
                  if (confirm("Delete this document?")) deleteMutation.mutate({ id: doc.id });
                }} className="text-zinc-400 hover:text-red-400">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// PAYROLL SECTION

function PayrollSection({ employeeId, payroll, employee }: { employeeId: number; payroll: any[]; employee: any }) {
  const [showAdd, setShowAdd] = useState(false);
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    payPeriodStart: "", payPeriodEnd: "", amount: "",
    currency: employee?.currency || "USD",
    paymentMethod: "bank_transfer" as const,
    paymentDate: "", status: "pending" as const, notes: "",
  });

  const createMutation = trpc.payroll.create.useMutation({
    onSuccess: () => {
      toast.success("Payroll record added");
      utils.payroll.getForEmployee.invalidate({ employeeId });
      utils.employees.getById.invalidate({ id: employeeId });
      setShowAdd(false);
      setForm({ payPeriodStart: "", payPeriodEnd: "", amount: "", currency: employee?.currency || "USD", paymentMethod: "bank_transfer", paymentDate: "", status: "pending", notes: "" });
    },
    onError: (err) => toast.error(err.message),
  });
  const updateMutation = trpc.payroll.update.useMutation({
    onSuccess: () => {
      toast.success("Updated");
      utils.payroll.getForEmployee.invalidate({ employeeId });
    },
  });
  const deleteMutation = trpc.payroll.delete.useMutation({
    onSuccess: () => {
      toast.success("Deleted");
      utils.payroll.getForEmployee.invalidate({ employeeId });
      utils.employees.getById.invalidate({ id: employeeId });
    },
  });

  const PAYMENT_STATUS_COLORS: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    paid: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    overdue: "bg-red-500/20 text-red-400 border-red-500/30",
    cancelled: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-white">Payroll Records</h3>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button className="bg-yellow-600 hover:bg-yellow-700 text-black">
              <Plus className="h-4 w-4 mr-2" /> Add Record
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-800">
            <DialogHeader>
              <DialogTitle className="text-white">Add Payroll Record</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Period Start *</label>
                  <Input type="date" value={form.payPeriodStart} onChange={(e) => setForm(p => ({ ...p, payPeriodStart: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white" />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Period End *</label>
                  <Input type="date" value={form.payPeriodEnd} onChange={(e) => setForm(p => ({ ...p, payPeriodEnd: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Amount *</label>
                  <Input value={form.amount} onChange={(e) => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="5000" className="bg-zinc-800 border-zinc-700 text-white" />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Currency</label>
                  <Input value={form.currency} onChange={(e) => setForm(p => ({ ...p, currency: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Payment Method</label>
                  <Select value={form.paymentMethod} onValueChange={(v: any) => setForm(p => ({ ...p, paymentMethod: v }))}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="crypto">Crypto</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="wire">Wire</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Payment Date</label>
                  <Input type="date" value={form.paymentDate} onChange={(e) => setForm(p => ({ ...p, paymentDate: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white" />
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Status</label>
                <Select value={form.status} onValueChange={(v: any) => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Notes</label>
                <Input value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
              <Button onClick={() => {
                if (!form.payPeriodStart || !form.payPeriodEnd || !form.amount) { toast.error("Fill required fields"); return; }
                createMutation.mutate({ employeeId, ...form, paymentDate: form.paymentDate || undefined, notes: form.notes || undefined });
              }} className="w-full bg-yellow-600 hover:bg-yellow-700 text-black" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Record"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {payroll.length === 0 ? (
        <div className="text-center py-12">
          <DollarSign className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">No payroll records yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {payroll.map((rec: any) => (
            <div key={rec.id} className="flex items-center gap-4 p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
              <div className="h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-yellow-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm">
                  {rec.currency} {Number(rec.amount).toLocaleString()}
                </p>
                <p className="text-xs text-zinc-500">
                  {rec.payPeriodStart} — {rec.payPeriodEnd}
                </p>
              </div>
              <Badge variant="outline" className={PAYMENT_STATUS_COLORS[rec.status] || ""}>
                {rec.status}
              </Badge>
              <span className="text-xs text-zinc-500">{rec.paymentMethod?.replace("_", " ")}</span>
              {rec.paymentDate && <span className="text-xs text-zinc-500">Paid {rec.paymentDate}</span>}
              <div className="flex gap-1">
                {rec.status === "pending" && (
                  <Button variant="ghost" size="sm" onClick={() => updateMutation.mutate({ id: rec.id, status: "paid", paymentDate: new Date().toISOString().split("T")[0] })} className="text-emerald-400 hover:text-emerald-300 text-xs">
                    Mark Paid
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => {
                  if (confirm("Delete this payroll record?")) deleteMutation.mutate({ id: rec.id });
                }} className="text-zinc-400 hover:text-red-400">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Need Plus icon
import { Plus } from "lucide-react";
