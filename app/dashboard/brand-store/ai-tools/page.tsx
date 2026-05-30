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

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Brand AI Studio</h1>
        <p className="text-slate-500 mt-1">
          Deploy AI assets optimized specifically for B2B wholesale workflows and boutique retail pitching.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Navigation Links */}
        <div className="space-y-2">
          <label className="text-sm font-semibold uppercase tracking-wider text-slate-400 block px-2">
            AI Tool Suite
          </label>
          {Object.entries(TASK_DETAILS).map(([key, value]) => (
            <button
              key={key}
              onClick={() => {
                setActiveTask(key as AITask);
                setPrompt('');
                setResult('');
                setError(null);
              }}
              className={`w-full text-left p-3 rounded-lg transition-all border ${
                activeTask === key
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="font-medium text-sm">{value.title}</div>
            </button>
          ))}
        </div>

        {/* Right Side: Inputs & Workspace Options */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-1">{currentTask.title}</h2>
            <p className="text-sm text-slate-500 mb-6">{currentTask.description}</p>

            <form onSubmit={handleGenerate} className="space-y-4">
              {/* Provider Selection */}
              <div className="grid grid-cols-3 gap-3 p-1 bg-slate-100 rounded-lg">
                {(['claude', 'openai', 'gemini'] as AIProvider[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProvider(p)}
                    className={`py-1.5 text-xs font-medium rounded-md capitalize transition-all ${
                      provider === p
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {p === 'claude' ? 'Claude' : p === 'openai' ? 'OpenAI GPT' : 'Gemini'}
                  </button>
                ))}
              </div>

              {/* Input Workspace */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">{currentTask.label}</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={currentTask.placeholder}
                  rows={5}
                  className="w-full rounded-lg border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
                />
              </div>

              {/* Error Output Banner */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* Form Actions */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading || !prompt.trim()}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm py-2.5 px-5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? 'Generating Strategy...' : 'Generate Copy'}
                </button>
              </div>
            </form>
          </div>

          {/* Execution Copy Result Viewer */}
          {(result || loading) && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                  AI Generated Output
                </h3>
                {result && (
                  <button
                    onClick={() => navigator.clipboard.writeText(result)}
                    className="text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 py-1 px-2.5 rounded shadow-sm transition-all"
                  >
                    Copy to Clipboard
                  </button>
                )}
              </div>
              
              {loading ? (
                <div className="space-y-2 py-4">
                  <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4"></div>
                  <div className="h-4 bg-slate-200 rounded animate-pulse w-5/6"></div>
                  <div className="h-4 bg-slate-200 rounded animate-pulse w-2/3"></div>
                </div>
              ) : (
                <div className="text-slate-800 text-sm whitespace-pre-wrap leading-relaxed bg-white p-4 rounded-lg border border-slate-150">
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
