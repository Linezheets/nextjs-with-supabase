'use client';

import React, { useState } from 'react';

type AITask =
  | 'product_description'
  | 'pricing_advice'
  | 'store_bio'
  | 'newsletter'
  | 'campaign_copy';

type AIProvider = 'claude' | 'openai' | 'gemini';

interface TaskMetadata {
  title: string;
  description: string;
  placeholder: string;
  label: string;
}

const TASK_DETAILS: Record<AITask, TaskMetadata> = {
  product_description: {
    title: 'Product Description Writer',
    description: 'Generate luxury, wholesale-ready editorial copy for collections.',
    label: 'Product Details (Title, Materials, Fit, Category)',
    placeholder: 'e.g., Silk Midi Dress, 100% Mulberry Silk, relaxed fit, FW26 collection, tailored cuffs.',
  },
  pricing_advice: {
    title: 'B2B Pricing Advisor',
    description: 'Calculate and strategize wholesale selling price (WSP) and retail (RRP) margins.',
    label: 'Pricing Parameters (Cost price, Competitor benchmarks, Brand Tier)',
    placeholder: 'e.g., Production Cost: $45, Target Margin: 65%, Premium contemporary tier, Competitor retail: $180.',
  },
  store_bio: {
    title: 'Brand Profile Bio Generator',
    description: 'Craft sophisticated profiles designed to appeal to department store buyers.',
    label: 'Brand Identity & Aesthetic Keywords',
    placeholder: 'e.g., Minimalist sustainable luxury footwear brand based in Milan, focusing on organic leather and deadstock materials.',
  },
  newsletter: {
    title: 'Wholesale Newsletter Composer',
    description: 'Draft seasonal announcement updates targeted directly to boutique accounts.',
    label: 'Campaign Focus or Product Highlights',
    placeholder: 'e.g., Launching the Pre-Spring knitwear pre-orders. Early bird 5% volume discount valid until end of month.',
  },
  campaign_copy: {
    title: 'Buyer Outreach Copywriter',
    description: 'Write exclusive pitching emails to close terms with new retail stockists.',
    label: 'Pitch Value Proposition & Exclusive Incentives',
    placeholder: 'e.g., Introducing our high-margin basics line to West Coast multi-brand boutiques, offering immediate delivery.',
  },
};

export default function AIStudioPage() {
  const [activeTask, setActiveTask] = useState<AITask>('product_description');
  const [provider, setProvider] = useState<AIProvider>('claude');
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setResult('');

    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: activeTask,
          prompt: prompt.trim(),
          provider,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong during generation.');
      }

      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const currentTask = TASK_DETAILS[activeTask];

  const GOLD  = '#c9a84c';
  const SERIF = 'var(--font-serif), Georgia, serif';
  const MONO  = 'var(--font-mono), "DM Mono", monospace';

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
      {/* Header */}
      <div>
        <p className="text-[7.5px] uppercase tracking-[0.5em] mb-3" style={{ color: GOLD, fontFamily: MONO }}>
          Brand Studio · AI
        </p>
        <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(26px,3.5vw,34px)', fontWeight: 400, letterSpacing: '-0.01em', color: '#111' }}>
          Brand AI Studio
        </h1>
        <p className="text-[12px] leading-[1.9] mt-3" style={{ color: '#777', fontFamily: MONO, maxWidth: 560 }}>
          Deploy AI assets optimized specifically for B2B wholesale workflows and boutique retail pitching.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left Side: Tool suite */}
        <div>
          <p className="text-[7.5px] uppercase tracking-[0.5em] mb-4 px-1" style={{ color: '#999', fontFamily: MONO }}>
            AI Tool Suite
          </p>
          <div className="space-y-px">
            {Object.entries(TASK_DETAILS).map(([key, value]) => {
              const active = activeTask === key;
              return (
                <button
                  key={key}
                  onClick={() => {
                    setActiveTask(key as AITask);
                    setPrompt('');
                    setResult('');
                    setError(null);
                  }}
                  className="w-full text-left px-4 py-3 border transition-colors"
                  style={{
                    fontFamily : MONO,
                    fontSize   : 11,
                    borderColor: active ? GOLD : '#eee',
                    background : active ? 'rgba(201,168,76,0.08)' : '#fff',
                    color      : active ? '#111' : '#777',
                  }}
                >
                  {value.title}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side: Inputs & Workspace */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border p-6" style={{ borderColor: '#eee' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 400, color: '#111', marginBottom: 4 }}>
              {currentTask.title}
            </h2>
            <p className="text-[12px] leading-[1.7] mb-6" style={{ color: '#777', fontFamily: MONO }}>
              {currentTask.description}
            </p>

            <form onSubmit={handleGenerate} className="space-y-5">
              {/* Provider Selection */}
              <div>
                <p className="text-[7.5px] uppercase tracking-[0.4em] mb-2" style={{ color: '#999', fontFamily: MONO }}>
                  AI Provider
                </p>
                <div className="grid grid-cols-3 border" style={{ borderColor: '#eee' }}>
                  {(['claude', 'openai', 'gemini'] as AIProvider[]).map((p, i) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setProvider(p)}
                      className="py-2 text-[10px] uppercase tracking-[0.2em] transition-colors"
                      style={{
                        fontFamily : MONO,
                        borderLeft : i === 0 ? 'none' : '1px solid #eee',
                        background : provider === p ? '#111' : '#fff',
                        color      : provider === p ? '#fff' : '#777',
                      }}
                    >
                      {p === 'claude' ? 'Claude' : p === 'openai' ? 'OpenAI' : 'Gemini'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Workspace */}
              <div className="space-y-2">
                <label className="block text-[7.5px] uppercase tracking-[0.4em]" style={{ color: '#999', fontFamily: MONO }}>
                  {currentTask.label}
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={currentTask.placeholder}
                  rows={5}
                  className="w-full border p-3 text-[13px] outline-none resize-none focus:border-[#c9a84c] transition-colors placeholder:text-zinc-400"
                  style={{ borderColor: '#ddd', color: '#222', fontFamily: MONO }}
                />
              </div>

              {/* Error Output Banner */}
              {error && (
                <div className="p-3 border text-[12px]" style={{ background: '#fff5f5', borderColor: '#f0d4d4', color: '#c0392b', fontFamily: MONO }}>
                  {error}
                </div>
              )}

              {/* Form Actions */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading || !prompt.trim()}
                  className="text-[8px] uppercase tracking-[0.4em] py-3 px-7 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity hover:opacity-80"
                  style={{ background: '#111', color: '#fff', fontFamily: MONO, fontWeight: 500 }}
                >
                  {loading ? 'Generating…' : 'Generate Copy'}
                </button>
              </div>
            </form>
          </div>

          {/* Result Viewer */}
          {(result || loading) && (
            <div className="bg-white border p-6 space-y-3" style={{ borderColor: '#eee' }}>
              <div className="flex items-center justify-between">
                <p className="text-[7.5px] uppercase tracking-[0.5em]" style={{ color: GOLD, fontFamily: MONO }}>
                  AI Generated Output
                </p>
                {result && (
                  <button
                    onClick={() => navigator.clipboard.writeText(result)}
                    className="text-[8px] uppercase tracking-[0.3em] py-1.5 px-3 border transition-colors hover:bg-[#fafafa]"
                    style={{ color: '#555', borderColor: '#eee', fontFamily: MONO }}
                  >
                    Copy
                  </button>
                )}
              </div>

              {loading ? (
                <div className="space-y-2 py-4">
                  <div className="h-3 animate-pulse w-3/4" style={{ background: '#f0f0f0' }} />
                  <div className="h-3 animate-pulse w-5/6" style={{ background: '#f0f0f0' }} />
                  <div className="h-3 animate-pulse w-2/3" style={{ background: '#f0f0f0' }} />
                </div>
              ) : (
                <div className="text-[13px] whitespace-pre-wrap leading-relaxed p-4 border" style={{ background: '#fafafa', borderColor: '#eee', color: '#222', fontFamily: MONO }}>
                  {result}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
