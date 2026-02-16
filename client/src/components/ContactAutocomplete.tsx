import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Search, Building2, Mail, X, UserPlus, ChevronDown, Check, Briefcase } from "lucide-react";

interface ContactResult {
  id: number;
  name: string;
  email: string | null;
  organization: string | null;
  category: string | null;
  photoUrl: string | null;
  title?: string | null;
}

/* ── Shared Helpers ────────────────────────────────────────── */

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const avatarGradients = [
  "from-amber-500 to-orange-600",
  "from-emerald-500 to-teal-600",
  "from-blue-500 to-indigo-600",
  "from-rose-500 to-pink-600",
  "from-violet-500 to-purple-600",
  "from-cyan-500 to-sky-600",
];

function getAvatarGradient(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarGradients[Math.abs(hash) % avatarGradients.length];
}

const categoryConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  client: { label: "Client", bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  prospect: { label: "Prospect", bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
  partner: { label: "Partner", bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  vendor: { label: "Vendor", bg: "bg-purple-500/10", text: "text-purple-400", dot: "bg-purple-400" },
  other: { label: "Contact", bg: "bg-zinc-500/10", text: "text-zinc-400", dot: "bg-zinc-400" },
};

function CategoryBadge({ category }: { category: string | null }) {
  const config = categoryConfig[category || "other"] || categoryConfig.other;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

function ContactAvatar({ name, photoUrl, size = "md" }: { name: string; photoUrl?: string | null; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = { sm: "h-7 w-7 text-[10px]", md: "h-9 w-9 text-xs", lg: "h-11 w-11 text-sm" };
  if (photoUrl) {
    return <img src={photoUrl} alt={name} className={`${sizeClasses[size]} rounded-full object-cover ring-2 ring-zinc-700/50`} />;
  }
  return (
    <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${getAvatarGradient(name)} flex items-center justify-center text-white font-bold ring-2 ring-zinc-700/50`}>
      {getInitials(name)}
    </div>
  );
}

/* ── Single Select ─────────────────────────────────────────── */

interface ContactAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (contact: ContactResult) => void;
  placeholder?: string;
  className?: string;
  allowFreeText?: boolean;
}

export function ContactAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Search contacts...",
  className = "",
  allowFreeText = false,
}: ContactAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState<ContactResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const searchQuery = query.length >= 1 ? query : undefined;
  const { data: results } = trpc.contacts.searchByName.useQuery(
    { query: searchQuery || "" },
    { enabled: !!searchQuery && isOpen }
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);
    setSelectedContact(null);
    if (val.length >= 1) setIsOpen(true);
    else setIsOpen(false);
  };

  const handleSelect = (contact: ContactResult) => {
    onChange(contact.name);
    setQuery(contact.name);
    setSelectedContact(contact);
    setIsOpen(false);
    onSelect?.(contact);
  };

  const handleClear = () => {
    onChange("");
    setQuery("");
    setSelectedContact(null);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // If a contact is selected, show a compact chip
  if (selectedContact) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 bg-zinc-900/80 border border-zinc-700/50 rounded-xl ${className}`}>
        <ContactAvatar name={selectedContact.name} photoUrl={selectedContact.photoUrl} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">{selectedContact.name}</div>
          {(selectedContact.organization || selectedContact.email) && (
            <div className="text-[11px] text-zinc-500 truncate">
              {selectedContact.organization || selectedContact.email}
            </div>
          )}
        </div>
        <CategoryBadge category={selectedContact.category} />
        <button type="button" onClick={handleClear} className="text-zinc-500 hover:text-zinc-300 transition-colors p-0.5">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => { if (query.length >= 1) setIsOpen(true); }}
          placeholder={placeholder}
          className={`w-full pl-10 pr-8 py-2.5 bg-zinc-900/80 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 transition-all ${className}`}
        />
        {value && (
          <button type="button" onClick={handleClear} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full bg-zinc-900 border border-zinc-700/50 rounded-xl shadow-2xl shadow-black/40 overflow-hidden">
          {results && results.length > 0 ? (
            <div className="max-h-72 overflow-y-auto py-1">
              {results.map((contact: ContactResult) => (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => handleSelect(contact)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-amber-500/5 transition-all text-left group"
                >
                  <ContactAvatar name={contact.name} photoUrl={contact.photoUrl} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white group-hover:text-amber-400 transition-colors truncate">
                        {contact.name}
                      </span>
                      <CategoryBadge category={contact.category} />
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {contact.organization && (
                        <span className="flex items-center gap-1 text-[11px] text-zinc-500 truncate">
                          <Building2 className="h-3 w-3 flex-shrink-0" />
                          {contact.organization}
                        </span>
                      )}
                      {contact.email && (
                        <span className="flex items-center gap-1 text-[11px] text-zinc-500 truncate">
                          <Mail className="h-3 w-3 flex-shrink-0" />
                          {contact.email}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : searchQuery ? (
            <div className="px-4 py-6 text-center">
              <Search className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-sm text-zinc-500">No contacts found for "{query}"</p>
              {allowFreeText && (
                <button
                  type="button"
                  onClick={() => { onChange(query); setIsOpen(false); }}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-zinc-300 transition-colors"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Use "{query}" as new name
                </button>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ── Multi-Select ──────────────────────────────────────────── */

interface ContactMultiSelectProps {
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
  className?: string;
}

export function ContactMultiSelect({
  selectedIds,
  onChange,
  placeholder = "Search contacts to add...",
  className = "",
}: ContactMultiSelectProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: results } = trpc.contacts.searchByName.useQuery(
    { query: query || "a", limit: 20 },
    { enabled: isOpen }
  );

  const { data: allContacts } = trpc.contacts.list.useQuery();
  const selectedContacts = allContacts?.filter((c: any) => selectedIds.includes(c.id)) || [];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (contact: ContactResult) => {
    if (!selectedIds.includes(contact.id)) {
      onChange([...selectedIds, contact.id]);
    }
    setQuery("");
  };

  const handleRemove = (id: number) => {
    onChange(selectedIds.filter((sid) => sid !== id));
  };

  const filteredResults = results?.filter((r: ContactResult) => !selectedIds.includes(r.id)) || [];

  return (
    <div ref={containerRef} className="relative">
      {/* Selected chips */}
      {selectedContacts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedContacts.map((c: any) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 bg-zinc-800/80 border border-zinc-700/50 rounded-lg text-xs"
            >
              <ContactAvatar name={c.name} photoUrl={c.photoUrl} size="sm" />
              <span className="text-white font-medium">{c.name}</span>
              <button type="button" onClick={() => handleRemove(c.id)} className="text-zinc-500 hover:text-red-400 transition-colors ml-0.5">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder={selectedIds.length === 0 ? placeholder : "Add more contacts..."}
          className={`w-full pl-10 pr-4 py-2.5 bg-zinc-900/80 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 transition-all ${className}`}
        />
      </div>

      {/* Dropdown */}
      {isOpen && filteredResults.length > 0 && (
        <div className="absolute z-50 mt-1.5 w-full bg-zinc-900 border border-zinc-700/50 rounded-xl shadow-2xl shadow-black/40 overflow-hidden">
          <div className="max-h-56 overflow-y-auto py-1">
            {filteredResults.map((contact: ContactResult) => (
              <button
                key={contact.id}
                type="button"
                onClick={() => handleSelect(contact)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-amber-500/5 transition-all text-left group"
              >
                <ContactAvatar name={contact.name} photoUrl={contact.photoUrl} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white group-hover:text-amber-400 transition-colors truncate">
                      {contact.name}
                    </span>
                    <CategoryBadge category={contact.category} />
                  </div>
                  {(contact.organization || contact.email) && (
                    <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                      {contact.organization || contact.email}
                    </div>
                  )}
                </div>
                <UserPlus className="h-4 w-4 text-zinc-600 group-hover:text-amber-500 transition-colors" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
