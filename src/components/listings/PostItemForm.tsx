'use client'

// src/components/listings/PostItemForm.tsx
// Client component — renders the "Post an Item" form and wires it to the
// createListingAction Server Action via React's useActionState.

import { useActionState, useRef, useState, useEffect } from 'react'
import { Loader2, Upload, X } from 'lucide-react'
import { createListingAction } from '@/actions/listings'
import type { ListingActionResult } from '@/types/listings'

const initialState: ListingActionResult = { error: null }

export default function PostItemForm() {
  const [state, formAction, pending] = useActionState(createListingAction, initialState)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Revoke the blob URL when it changes or the component unmounts to prevent memory leaks.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    // Validate the generated URL is a safe blob: scheme before rendering it in src.
    setPreviewUrl(url.startsWith('blob:') ? url : null)
  }

  function clearPhoto() {
    setPreviewUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <form action={formAction} encType="multipart/form-data" className="space-y-6">
      {state.error && (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {state.error}
        </div>
      )}

      {/* Title */}
      <div>
        <label htmlFor="title" className="mb-1 block text-sm font-medium text-gray-700">
          Item title <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={120}
          placeholder="e.g. DeWalt Power Drill"
          className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">
          Description <span className="text-red-500">*</span>
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={4}
          maxLength={2000}
          placeholder="Describe the item's condition, features, and anything a borrower should know…"
          className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
      </div>

      {/* Photo */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Photo <span className="text-gray-400 font-normal">(optional)</span>
        </label>

        {previewUrl ? (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl.startsWith('blob:') ? previewUrl : ''}
              alt="Preview"
              className="h-40 w-40 rounded-md object-cover border border-gray-200"
            />
            <button
              type="button"
              onClick={clearPhoto}
              className="absolute -right-2 -top-2 rounded-full bg-white p-0.5 shadow border border-gray-200 text-gray-500 hover:text-red-600"
              aria-label="Remove photo"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <label
            htmlFor="photo"
            className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-8 text-center hover:border-green-400 hover:bg-green-50 transition-colors"
          >
            <Upload className="mb-2 h-6 w-6 text-gray-400" />
            <span className="text-sm text-gray-500">Click to upload a photo</span>
            <span className="mt-1 text-xs text-gray-400">JPEG, PNG, WebP — max 5 MB</span>
          </label>
        )}

        <input
          ref={fileInputRef}
          id="photo"
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileChange}
          className="sr-only"
        />
      </div>

      {/* Borrowing Rules */}
      <div>
        <label htmlFor="borrowing_rules" className="mb-1 block text-sm font-medium text-gray-700">
          Borrowing rules <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          id="borrowing_rules"
          name="borrowing_rules"
          rows={3}
          maxLength={500}
          placeholder="e.g. Handle with care. No disassembly. Clean before returning."
          className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
      </div>

      {/* Return by date */}
      <div>
        <label htmlFor="return_by_date" className="mb-1 block text-sm font-medium text-gray-700">
          Return by <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          id="return_by_date"
          name="return_by_date"
          type="date"
          className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
        <p className="mt-1 text-xs text-gray-400">
          The latest date by which the borrower must return this item.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {pending ? 'Posting…' : 'Post item'}
      </button>
    </form>
  )
}
