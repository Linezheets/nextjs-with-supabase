'use client';

import { useRef, useState } from 'react';

export default function NewInquiryForm({
  action,
  brands,
  defaultBrand,
  defaultSubject,
}: {
  action        : (fd: FormData) => Promise<void>;
  brands        : string[];
  defaultBrand  : string;
  defaultSubject: string;
}) {
  const [customBrand, setCustomBrand] = useState(!brands.includes(defaultBrand) && defaultBrand !== '');
  const [pending, setPending]         = useState(false);
  const formRef                       = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    await action(fd);
    setPending(false);
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-10">

      {/* Brand */}
      <div>
        <label className="block text-[8px] uppercase tracking-[0.45em] mb-3" style={{ color: '#999' }}>
          Brand <span style={{ color: '#c9a84c' }}>*</span>
        </label>

        {brands.length > 0 && !customBrand ? (
          <>
            <div className="relative">
              <select
                name="brand_name"
                required
                defaultValue={defaultBrand}
                className="w-full border-b border-zinc-200 pb-2 text-[13px] bg-white outline-none
                           appearance-none focus:border-black transition-colors pr-6"
                style={{ color: '#333' }}
              >
                <option value="" disabled>Select a brand</option>
                {brands.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <span className="absolute right-0 top-1 text-[10px] pointer-events-none"
                    style={{ color: '#bbb' }}>▾</span>
            </div>
            <button
              type="button"
              onClick={() => setCustomBrand(true)}
              className="mt-3 text-[8px] uppercase tracking-[0.35em] hover:opacity-60 transition-opacity"
              style={{ color: '#bbb' }}
            >
              + Brand not listed? Enter manually
            </button>
          </>
        ) : (
          <>
            <input
              name="brand_name"
              type="text"
              required
              defaultValue={defaultBrand}
              placeholder="e.g. Maison Margiela"
              className="w-full border-b border-zinc-200 pb-2 text-[13px] bg-transparent outline-none
                         focus:border-black transition-colors placeholder:text-zinc-300"
              style={{ color: '#333' }}
            />
            {brands.length > 0 && (
              <button
                type="button"
                onClick={() => setCustomBrand(false)}
                className="mt-3 text-[8px] uppercase tracking-[0.35em] hover:opacity-60 transition-opacity"
                style={{ color: '#bbb' }}
              >
                ← Select from list
              </button>
            )}
          </>
        )}
      </div>

      {/* Subject */}
      <div>
        <label className="block text-[8px] uppercase tracking-[0.45em] mb-3" style={{ color: '#999' }}>
          Subject <span style={{ color: '#c9a84c' }}>*</span>
        </label>
        <input
          name="subject"
          type="text"
          required
          defaultValue={defaultSubject}
          placeholder="e.g. Wholesale pricing for SS27 collection"
          className="w-full border-b border-zinc-200 pb-2 text-[13px] bg-transparent outline-none
                     focus:border-black transition-colors placeholder:text-zinc-300"
          style={{ color: '#333' }}
        />
      </div>

      {/* Message */}
      <div>
        <label className="block text-[8px] uppercase tracking-[0.45em] mb-3" style={{ color: '#999' }}>
          Message <span style={{ color: '#c9a84c' }}>*</span>
        </label>
        <textarea
          name="body"
          required
          rows={7}
          placeholder={`Hello,\n\nI'm reaching out regarding…`}
          className="w-full border border-zinc-200 px-5 py-4 text-[13px] leading-[1.85] resize-none
                     outline-none focus:border-black transition-colors placeholder:text-zinc-300"
          style={{ color: '#333' }}
        />
      </div>

      {/* Hint */}
      <p className="text-[10px] leading-[1.8]" style={{ color: '#ccc' }}>
        Your message will be sent directly to the designer house.
        Include your store name, location, and any relevant details about your order needs.
      </p>

      {/* Submit */}
      <div className="flex items-center gap-6 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-block px-12 py-4 text-[8.5px] uppercase tracking-[0.5em]
                     bg-black text-white hover:bg-zinc-900 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          {pending ? 'Sending…' : 'Send Inquiry'}
        </button>
        <a href="/inquiries"
           className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
           style={{ color: '#bbb', fontFamily: 'system-ui, sans-serif' }}>
          Cancel
        </a>
      </div>

    </form>
  );
}
