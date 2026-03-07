import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { DataTable, type TableColumn } from "@/components/shared/data-table";
import { FormField, FormSection } from "@/components/shared/form-primitives";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

type TextRecord = {
  id: string;
  name: string;
  level: "A1" | "A2" | "B1" | "B2" | "C1";
  lineCount: number;
  clipCount: number;
  readiness: "Ready" | "Needs clips" | "Needs transcript";
  updatedAt: string;
};

type DialogMode = "new" | "edit" | "delete" | null;

const textRows: TextRecord[] = [
  {
    id: "text-1",
    name: "Local Weather Update",
    level: "A2",
    lineCount: 42,
    clipCount: 42,
    readiness: "Ready",
    updatedAt: "Mar 07, 2026",
  },
  {
    id: "text-2",
    name: "Medical Intake Instructions",
    level: "B2",
    lineCount: 68,
    clipCount: 55,
    readiness: "Needs clips",
    updatedAt: "Mar 05, 2026",
  },
  {
    id: "text-3",
    name: "Election Recap Podcast",
    level: "C1",
    lineCount: 97,
    clipCount: 97,
    readiness: "Ready",
    updatedAt: "Mar 03, 2026",
  },
];

const tableColumns: TableColumn<TextRecord>[] = [
  {
    id: "name",
    header: "Text",
    cell: (row) => (
      <div>
        <p className="font-semibold text-slate-900">{row.name}</p>
        <p className="text-xs text-slate-500">Updated {row.updatedAt}</p>
      </div>
    ),
  },
  {
    id: "level",
    header: "Level",
    className: "w-20",
    cell: (row) => <span className="font-medium">{row.level}</span>,
  },
  {
    id: "assets",
    header: "Assets",
    className: "w-40",
    cell: (row) => (
      <span className="text-slate-700">
        {row.lineCount} lines / {row.clipCount} clips
      </span>
    ),
  },
  {
    id: "readiness",
    header: "Readiness",
    className: "w-44",
    cell: (row) => {
      const tone =
        row.readiness === "Ready"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-700";

      return <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}>{row.readiness}</span>;
    },
  },
];

export function TextsView() {
  const [mode, setMode] = useState<DialogMode>(null);
  const [selectedText, setSelectedText] = useState<TextRecord | null>(null);
  const [levelFilter, setLevelFilter] = useState<"ALL" | TextRecord["level"]>("ALL");

  const rows = useMemo(() => {
    if (levelFilter === "ALL") {
      return textRows;
    }

    return textRows.filter((row) => row.level === levelFilter);
  }, [levelFilter]);

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-300 bg-slate-50 p-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Texts</h2>
          <p className="mt-1 text-sm text-slate-700">Shared text list pattern for create, edit, delete, and readiness checks.</p>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            Level
            <select
              value={levelFilter}
              onChange={(event) => setLevelFilter(event.target.value as "ALL" | TextRecord["level"])}
              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
            >
              <option value="ALL">All</option>
              <option value="A1">A1</option>
              <option value="A2">A2</option>
              <option value="B1">B1</option>
              <option value="B2">B2</option>
              <option value="C1">C1</option>
            </select>
          </label>

          <Button
            onClick={() => {
              setSelectedText(null);
              setMode("new");
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Text
          </Button>
        </div>
      </header>

      <DataTable
        title="Texts Inventory"
        subtitle="Table and action patterns shared across core views."
        columns={[
          ...tableColumns,
          {
            id: "actions",
            header: "Actions",
            className: "w-36",
            cell: (row) => (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded-md border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-100"
                  onClick={() => {
                    setSelectedText(row);
                    setMode("edit");
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 p-1.5 text-rose-700 hover:bg-rose-50"
                  onClick={() => {
                    setSelectedText(row);
                    setMode("delete");
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ),
          },
        ]}
        rows={rows}
        getRowKey={(row) => row.id}
      />

      <TextFormDialog open={mode === "new" || mode === "edit"} mode={mode} text={selectedText} onClose={() => setMode(null)} />

      <DeleteTextDialog
        open={mode === "delete"}
        text={selectedText}
        onCancel={() => setMode(null)}
        onConfirm={() => {
          setMode(null);
        }}
      />
    </section>
  );
}

type TextFormDialogProps = {
  open: boolean;
  mode: DialogMode;
  text: TextRecord | null;
  onClose: () => void;
};

function TextFormDialog({ open, mode, text, onClose }: TextFormDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
      title={mode === "edit" ? "Edit Text" : "New Text"}
      description="Reusable form sections for transcript and clip workflows."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onClose}>{mode === "edit" ? "Save Changes" : "Create Text"}</Button>
        </>
      }
    >
      <form className="space-y-3" onSubmit={(event) => event.preventDefault()}>
        <FormSection title="Metadata" description="Baseline form structure to be reused by create and edit flows.">
          <FormField label="Name" htmlFor="text-name">
            <input
              id="text-name"
              defaultValue={text?.name || ""}
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
              placeholder="Radio interview transcript"
            />
          </FormField>

          <FormField label="Level" htmlFor="text-level">
            <select
              id="text-level"
              defaultValue={text?.level || "B1"}
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="A1">A1</option>
              <option value="A2">A2</option>
              <option value="B1">B1</option>
              <option value="B2">B2</option>
              <option value="C1">C1</option>
            </select>
          </FormField>
        </FormSection>

        <FormSection title="Source Files" description="Validation and upload handling plug in here in later phases.">
          <FormField label="Transcript file" htmlFor="text-transcript" hint=".txt accepted in current plan">
            <input id="text-transcript" className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm" placeholder="/files/transcript.txt" />
          </FormField>

          <FormField label="Audio clips directory" htmlFor="text-clips" hint="Folder with one clip per transcript line">
            <input id="text-clips" className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm" placeholder="/audio/market-dialogue" />
          </FormField>
        </FormSection>
      </form>
    </Dialog>
  );
}

type DeleteTextDialogProps = {
  open: boolean;
  text: TextRecord | null;
  onCancel: () => void;
  onConfirm: () => void;
};

function DeleteTextDialog({ open, text, onCancel, onConfirm }: DeleteTextDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onCancel();
        }
      }}
      title="Delete Text"
      description="Shared confirm dialog pattern used by destructive actions."
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>
            Keep Text
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </>
      }
      size="sm"
    >
      <p className="text-sm text-slate-700">
        Are you sure you want to remove <span className="font-semibold text-slate-900">{text?.name || "this text"}</span>? This will
        also remove attached scheduling and session history.
      </p>
    </Dialog>
  );
}
