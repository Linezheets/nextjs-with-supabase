'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

type Job = {
  id          : string;
  filename    : string;
  status      : string;
  rows_parsed : number;
  rows_created: number;
  rows_skipped: number;
  errors      : { row: number; message: string }[] | string;
  created_at  : string;
  completed_at: string | null;
};

type PreviewRow = {
  title?: string | null;
  sku?: string | null;
  category?: string | null;
  wsp_usd?: string | null;
  srp?: string | null;
  color?: string | null;
  sizes?: string | null;
  stock_total?: string | null;
};

const GOLD  = '#c9a84c';
const SERIF = 'var(--font-serif), Georgia, "Times New Roman", serif';
const MONO  = 'DM Mono, ui-monospace, monospace';
const SANS  = 'system-ui, -apple-system, sans-serif';

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  done      : { bg: '#f0faf4', color: '#2d7a4f' },
  processing: { bg: '#fff8e1', color: GOLD       },
  failed    : { bg: '#fff0f0', color: '#c0392b'  },
};

export default function LinesheetClient({ initialJobs }: { initialJobs: Record<string, unknown>[] }) {
  const [jobs, setJobs]           = useState<Job[]>(initialJobs as Job[]);
  const [file, setFile]           = useState<File | null>(null);
  const [preview, setPreview]     = useState<{ headers: string[]; preview: PreviewRow[]; total_rows: number; column_mapping: Record<string,string> } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [polling, setPolling]     = useState<string | null>(null);
  const [err, setErr]             = useState('');
  const [drag, setDrag]           = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pollJob = useCallback(async (jobId: string) => {
    const res  = await fetch(`/api/linesheets/jobs/${jobId}`);
    const json = await res.json() as Job;
    if (!res.ok) { setPolling(null); return; }
    setJobs(js => js.map(j => j.id === jobId ? json : j));
    if (json.status !== 'processing') setPolling(null);
  }, []);

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(() => pollJob(polling), 2000);
    return () => clearInterval(interval);
  }, [polling, pollJob]);

  async function handleFileSelect(f: File) {
    setFile(f);
    setPreview(null);
    setErr('');
    // Load preview
    const fd = new FormData();
    fd.append('file', f);
    const res  = await fetch('/api/linesheets/parse-preview', { method: 'POST', body: fd });
    const json = await res.json();
    if (!res.ok) { setErr(json.error); return; }
    setPreview(json);
  }

  async function handleImport() {
    if (!file) return;
    setUploading(true);
    setErr('');
    const fd = new FormData();
    fd.append('file', file);
    const res  = await fetch('/api/linesheets/parse', { method: 'POST', body: fd });
    const json = await res.json();
    setUploading(false);
    if (!res.ok) { setErr(json.error); return; }

    const newJob: Job = {
      id: json.jobId, filename: file.name, status: 'processing',
      rows_parsed: 0, rows_created: 0, rows_skipped: 0, errors: [],
      created_at: new Date().toISOString(), completed_at: null,
    };
    setJobs(js => [newJob, ...js]);
    setFile(null);
    setPreview(null);
    setPolling(json.jobId);
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '40px 64px 32px' }}>
        <p style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.5em', color: '#bbb', textTransform: 'uppercase', marginBottom: 8 }}>
          Brand Store / Linesheets
        </p>
        <h1 style={{ fontFamily: SERIF, fontSize: '28px', fontWeight: 400, color: '#111' }}>
          Import Linesheet
        </h1>
        <p style={{ fontFamily: SANS, fontSize: '12px', color: '#888', marginTop: 4 }}>
          Upload Excel (.xlsx, .xls) or CSV — products are matched by SKU and created or updated automatically.
        </p>
      </div>

      <div style={{ padding: '40px 64px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' }}>
        {/* Upload panel */}
        <div>
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${drag ? GOLD : '#e5e5e5'}`,
              padding: '48px 32px', textAlign: 'center', cursor: 'pointer', background: '#fff',
              transition: 'border-color 0.2s',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={drag ? GOLD : '#ccc'} strokeWidth="1.5" style={{ margin: '0 auto 16px' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <p style={{ fontFamily: SERIF, fontSize: '16px', color: '#111', marginBottom: 8 }}>
              {file ? file.name : 'Drop your linesheet here'}
            </p>
            <p style={{ fontFamily: SANS, fontSize: '11px', color: '#bbb' }}>
              {file ? `${(file.size / 1024).toFixed(0)} KB` : 'xlsx · xls · csv · ods · max 25 MB'}
            </p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.ods" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
          </div>

          {err && <p style={{ color: '#df1b41', fontFamily: SANS, fontSize: '12px', marginTop: 12 }}>{err}</p>}

          {file && (
            <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
              <button onClick={handleImport} disabled={uploading}
                style={{ flex: 1, background: uploading ? '#ccc' : '#111', color: '#fff', border: 'none', padding: '12px 0', fontFamily: SANS, fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', cursor: uploading ? 'default' : 'pointer' }}>
                {uploading ? 'Importing…' : 'Import to Catalogue'}
              </button>
              <button onClick={() => { setFile(null); setPreview(null); }}
                style={{ padding: '12px 20px', background: '#fff', border: '1px solid #e5e5e5', fontFamily: SANS, fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', cursor: 'pointer', color: '#888' }}>
                Clear
              </button>
            </div>
          )}

          {/* Column mapping */}
          {preview && (
            <div style={{ marginTop: 24, background: '#fff', padding: 20, border: '1px solid #f0f0f0' }}>
              <p style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.4em', textTransform: 'uppercase', color: '#bbb', marginBottom: 12 }}>
                Column Mapping · {preview.total_rows} rows detected
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {Object.entries(preview.column_mapping).map(([field, col]) => (
                  <div key={field} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontFamily: MONO, fontSize: '10px', color: '#888', minWidth: 80 }}>{field}</span>
                    <span style={{ fontSize: '10px', color: GOLD, fontFamily: MONO }}>→ {col}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Preview table */}
        {preview && preview.preview.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #f0f0f0', overflowX: 'auto' }}>
            <p style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.4em', textTransform: 'uppercase', color: '#bbb', padding: '16px 20px 8px' }}>
              Preview (first 20 rows)
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                  {['Title','SKU','Category','WSP','SRP','Stock'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontFamily: SANS, fontSize: '8px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#bbb', fontWeight: 400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #fafafa' }}>
                    <td style={{ padding: '8px 12px', fontFamily: SERIF, color: '#111', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.title ?? '—'}</td>
                    <td style={{ padding: '8px 12px', fontFamily: MONO, color: '#888' }}>{row.sku ?? '—'}</td>
                    <td style={{ padding: '8px 12px', fontFamily: SANS, color: '#666' }}>{row.category ?? '—'}</td>
                    <td style={{ padding: '8px 12px', fontFamily: MONO, color: '#111' }}>{row.wsp_usd ?? '—'}</td>
                    <td style={{ padding: '8px 12px', fontFamily: MONO, color: '#666' }}>{row.srp ?? '—'}</td>
                    <td style={{ padding: '8px 12px', fontFamily: MONO, color: '#666' }}>{row.stock_total ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Import history */}
      <div style={{ padding: '0 64px 64px' }}>
        <p style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.4em', textTransform: 'uppercase', color: '#bbb', marginBottom: 16 }}>Import History</p>
        {jobs.length === 0 ? (
          <p style={{ fontFamily: SANS, fontSize: '12px', color: '#bbb' }}>No imports yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {jobs.map(job => {
              const badge  = STATUS_COLOR[job.status] ?? STATUS_COLOR.processing;
              const errs   = typeof job.errors === 'string' ? JSON.parse(job.errors || '[]') : (job.errors ?? []);
              return (
                <div key={job.id} style={{ background: '#fff', padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: 24, alignItems: 'center' }}>
                  <span style={{ fontFamily: SERIF, fontSize: '13px', color: '#111' }}>{job.filename}</span>
                  <span style={{ fontFamily: MONO, fontSize: '11px', color: '#888' }}>
                    {job.rows_created} created · {job.rows_skipped} skipped
                  </span>
                  {errs.length > 0 && (
                    <span style={{ fontFamily: SANS, fontSize: '10px', color: '#df1b41' }}>{errs.length} errors</span>
                  )}
                  <span style={{ fontFamily: SANS, fontSize: '11px', color: '#aaa' }}>
                    {new Date(job.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{ ...badge, padding: '3px 10px', fontSize: '8px', letterSpacing: '0.3em', textTransform: 'uppercase', fontFamily: SANS }}>
                    {job.status === 'processing' ? '⏳ Processing…' : job.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
